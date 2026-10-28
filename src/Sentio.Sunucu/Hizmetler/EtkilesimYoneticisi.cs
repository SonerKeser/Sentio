using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Hublar;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Hizmetler;

/// <summary>
/// Dersin etkileşim katmanı: öğrencinin kendi beyanı (sinyaller), hızlı yoklamalar, ders bölümleri ve mola.
/// Öğretmen ve öğrenci merkezleri ile sanal sınıf aynı yöntemleri kullanır.
/// </summary>
public sealed class EtkilesimYoneticisi(
    IDbContextFactory<SentioVeritabani> fabrika,
    IHubContext<OgrenciHub> ogrenciHub,
    TimeProvider saat)
{
    /// <summary>"Anlamadım" ve "Yavaşlar mısınız" bu süre sonra kendiliğinden düşer; söz isteği yanıtlanana dek kalır.</summary>
    public const long SinyalOmruMs = 90_000;
    public const long SinyalAraligiMs = 3_000;
    public const int EnUzunMola = 60;

    private static readonly string[] AnlamaSecenekleri = ["Anladım", "Kısmen", "Anlamadım"];
    private static readonly string[] EvetHayirSecenekleri = ["Evet", "Hayır"];
    private static readonly string[] PuanSecenekleri = ["1", "2", "3", "4", "5"];

    private long SimdiMs => saat.GetUtcNow().ToUnixTimeMilliseconds();
    private DateTime Simdi => saat.GetUtcNow().UtcDateTime;

    // Sinyaller

    public async Task<bool> SinyalGonderAsync(CanliOturum oturum, CanliKatilimci katilimci, SinyalTuru tur, string? metin)
    {
        var simdi = SimdiMs;
        metin = tur == SinyalTuru.Soru ? Metin.Ad(metin, 200) is { Length: > 0 } m ? m : null : null;
        if (oturum.MoladaMi) return false;

        lock (katilimci.Kilit)
        {
            if (katilimci.Ayrildi || simdi - katilimci.SonSinyalMs < SinyalAraligiMs) return false;
            katilimci.SonSinyalMs = simdi;
        }

        CanliSinyal? mevcut;
        lock (oturum.EtkilesimKilidi)
        {
            mevcut = oturum.Sinyaller.FirstOrDefault(s => s.KatilimciId == katilimci.Id && s.Tur == tur && !SuresiDolmus(s, simdi));
            if (mevcut is not null && tur != SinyalTuru.Soru)
            {
                // Aynı beyanın yinelenmesi yeni kayıt değil, süresinin uzatılmasıdır.
                oturum.Sinyaller.Remove(mevcut);
                oturum.Sinyaller.Add(mevcut with { ZamanMs = simdi });
                return true;
            }
        }

        await using var db = await fabrika.CreateDbContextAsync();
        if (mevcut is not null)
        {
            await db.Sinyaller.Where(s => s.Id == mevcut.Id).ExecuteUpdateAsync(u => u.SetProperty(s => s.Metin, metin));
            lock (oturum.EtkilesimKilidi)
            {
                oturum.Sinyaller.Remove(mevcut);
                oturum.Sinyaller.Add(mevcut with { Metin = metin });
            }
            return true;
        }

        var kayit = new Sinyal { OturumId = oturum.Id, KatilimciId = katilimci.Id, Tur = tur, Metin = metin, Zaman = Simdi };
        db.Sinyaller.Add(kayit);
        await db.SaveChangesAsync();
        lock (oturum.EtkilesimKilidi) oturum.Sinyaller.Add(new CanliSinyal(kayit.Id, katilimci.Id, tur, metin, simdi));
        return true;
    }

    public Task SinyalGeriAlAsync(CanliOturum oturum, Guid katilimciId, SinyalTuru tur) =>
        SinyalleriKapatAsync(oturum, s => s.KatilimciId == katilimciId && s.Tur == tur, ogrenciyeBildir: false);

    /// <summary>Öğretmen söz isteğini yanıtladı: öğrencinin eli iner.</summary>
    public Task SinyalYanitlaAsync(CanliOturum oturum, long sinyalId) =>
        SinyalleriKapatAsync(oturum, s => s.Id == sinyalId, ogrenciyeBildir: true);

    /// <summary>Öğretmen konuyu yeniden açtı: bu türdeki tüm beyanlar sıfırlanır.</summary>
    public Task SinyalleriTemizleAsync(CanliOturum oturum, SinyalTuru tur) =>
        SinyalleriKapatAsync(oturum, s => s.Tur == tur, ogrenciyeBildir: true);

    private async Task SinyalleriKapatAsync(CanliOturum oturum, Func<CanliSinyal, bool> kosul, bool ogrenciyeBildir)
    {
        List<CanliSinyal> kapanan;
        lock (oturum.EtkilesimKilidi)
        {
            kapanan = [.. oturum.Sinyaller.Where(kosul)];
            oturum.Sinyaller.RemoveAll(s => kapanan.Contains(s));
        }
        if (kapanan.Count == 0) return;

        var kimlikler = kapanan.Select(s => s.Id).ToList();
        var simdi = Simdi;
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            await db.Sinyaller.Where(s => kimlikler.Contains(s.Id) && s.KapanmaZamani == null)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.KapanmaZamani, simdi));
        }

        if (!ogrenciyeBildir) return;
        foreach (var s in kapanan)
        {
            await ogrenciHub.Clients.Group(OgrenciHub.KatilimciGrubu(s.KatilimciId)).SendAsync("SinyalKapandi", s.Tur);
        }
    }

    public List<CanliSinyal> AktifSinyaller(CanliOturum oturum, long simdiMs)
    {
        lock (oturum.EtkilesimKilidi)
        {
            oturum.Sinyaller.RemoveAll(s => SuresiDolmus(s, simdiMs));
            return [.. oturum.Sinyaller];
        }
    }

    private static bool SuresiDolmus(CanliSinyal s, long simdiMs) => s.Tur != SinyalTuru.Soru && simdiMs - s.ZamanMs > SinyalOmruMs;

    // Yoklamalar

    public static (string Soru, string[] Secenekler)? YoklamaHazirla(YoklamaTuru tur, string? soru, string[]? secenekler)
    {
        var temizSoru = Metin.Ad(soru, 200);
        string[] liste;
        switch (tur)
        {
            case YoklamaTuru.Anlama:
                liste = AnlamaSecenekleri;
                if (temizSoru.Length == 0) temizSoru = "Konu anlaşıldı mı?";
                break;
            case YoklamaTuru.EvetHayir:
                liste = EvetHayirSecenekleri;
                break;
            case YoklamaTuru.Puan:
                liste = PuanSecenekleri;
                if (temizSoru.Length == 0) temizSoru = "Bu bölümü 1-5 arasında puanlar mısın?";
                break;
            case YoklamaTuru.Coktan:
                liste = [.. (secenekler ?? []).Select(x => Metin.Ad(x, 60)).Where(x => x.Length > 0).Take(6)];
                if (liste.Length == 0) liste = ["A", "B", "C", "D"];
                if (liste.Length < 2) return null;
                break;
            default:
                return null;
        }
        return temizSoru.Length == 0 ? null : (temizSoru, liste);
    }

    public async Task<YoklamaDurumu?> YoklamaBaslatAsync(CanliOturum oturum, YoklamaTuru tur, string? soru, string[]? secenekler)
    {
        if (YoklamaHazirla(tur, soru, secenekler) is not { } hazir) return null;
        await YoklamaKapatAsync(oturum);

        var yoklama = new Yoklama { OturumId = oturum.Id, Tur = tur, Soru = hazir.Soru, Secenekler = [.. hazir.Secenekler], Baslangic = Simdi };
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            db.Yoklamalar.Add(yoklama);
            await db.SaveChangesAsync();
        }

        var canli = new CanliYoklama(yoklama.Id, tur, hazir.Soru, hazir.Secenekler, SimdiMs);
        oturum.AktifYoklama = canli;
        await ogrenciHub.Clients.Group(OgrenciHub.OturumGrubu(oturum.Id))
            .SendAsync("Yoklama", new YoklamaBildirimi(canli.Id, tur, canli.Soru, canli.Secenekler, null));
        return YoklamaDurumu(canli);
    }

    public async Task YoklamaKapatAsync(CanliOturum oturum)
    {
        var yoklama = oturum.AktifYoklama;
        if (yoklama is null) return;
        oturum.AktifYoklama = null;
        var simdi = Simdi;
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            await db.Yoklamalar.Where(y => y.Id == yoklama.Id).ExecuteUpdateAsync(u => u.SetProperty(y => y.Bitis, simdi));
        }
        await ogrenciHub.Clients.Group(OgrenciHub.OturumGrubu(oturum.Id)).SendAsync("YoklamaKapandi", yoklama.Id);
    }

    public async Task<bool> YoklamaYanitlaAsync(CanliOturum oturum, CanliKatilimci katilimci, Guid yoklamaId, int secim)
    {
        var yoklama = oturum.AktifYoklama;
        if (yoklama is null || yoklama.Id != yoklamaId || secim < 0 || secim >= yoklama.Secenekler.Length) return false;
        lock (katilimci.Kilit)
        {
            if (katilimci.Ayrildi) return false;
        }
        yoklama.Yanitlar[katilimci.Id] = secim;

        await using var db = await fabrika.CreateDbContextAsync();
        var guncellenen = await db.YoklamaYanitlari
            .Where(y => y.YoklamaId == yoklamaId && y.KatilimciId == katilimci.Id)
            .ExecuteUpdateAsync(u => u.SetProperty(y => y.Secim, secim).SetProperty(y => y.Zaman, Simdi));
        if (guncellenen == 0)
        {
            db.YoklamaYanitlari.Add(new YoklamaYaniti { YoklamaId = yoklamaId, KatilimciId = katilimci.Id, Secim = secim, Zaman = Simdi });
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Aynı anda gelen iki yanıt: ikincisi güncelleme olarak yazılır.
                await db.YoklamaYanitlari
                    .Where(y => y.YoklamaId == yoklamaId && y.KatilimciId == katilimci.Id)
                    .ExecuteUpdateAsync(u => u.SetProperty(y => y.Secim, secim));
            }
        }
        return true;
    }

    public static YoklamaDurumu YoklamaDurumu(CanliYoklama y) =>
        new(y.Id, y.Tur, y.Soru, y.Secenekler, y.Sayilar(), y.Yanitlar.Count, y.BaslangicMs);

    public static YoklamaBildirimi? OgrenciYoklamasi(CanliOturum oturum, Guid katilimciId)
    {
        var y = oturum.AktifYoklama;
        return y is null ? null : new YoklamaBildirimi(y.Id, y.Tur, y.Soru, y.Secenekler, y.Yanitlar.TryGetValue(katilimciId, out var s) ? s : null);
    }

    // Bölümler ve mola

    public async Task<BolumDurumu?> BolumBaslatAsync(CanliOturum oturum, string ad)
    {
        ad = Metin.Ad(ad, 80);
        if (ad.Length == 0) return null;
        var molaBitti = await AktifBolumuKapatAsync(oturum);
        var bolum = await BolumEkleAsync(oturum, ad, mola: false, molaBitisMs: null);
        if (molaBitti) await ogrenciHub.Clients.Group(OgrenciHub.OturumGrubu(oturum.Id)).SendAsync("Mola", (MolaBildirimi?)null);
        return bolum.Durum();
    }

    public async Task<BolumDurumu> MolaBaslatAsync(CanliOturum oturum, int dakika)
    {
        dakika = Math.Clamp(dakika, 1, EnUzunMola);
        await AktifBolumuKapatAsync(oturum);
        await YoklamaKapatAsync(oturum);
        await SinyalleriKapatAsync(oturum, s => s.Tur != SinyalTuru.Soru, ogrenciyeBildir: true);

        var bitis = SimdiMs + dakika * 60_000L;
        var bolum = await BolumEkleAsync(oturum, "Mola", mola: true, molaBitisMs: bitis);
        Volatile.Write(ref oturum.MolaBitisMs, bitis);

        // Moladan dönüşte eski olumsuz ifade süreleri sayılmasın.
        foreach (var k in oturum.Katilimcilar.Values)
        {
            lock (k.Kilit) k.Kural.Sifirla();
        }
        await ogrenciHub.Clients.Group(OgrenciHub.OturumGrubu(oturum.Id)).SendAsync("Mola", new MolaBildirimi(bitis));
        return bolum.Durum();
    }

    /// <summary>Mola bitince moladan önceki bölüm kaldığı yerden sürer.</summary>
    public async Task MolaBitirAsync(CanliOturum oturum)
    {
        if (!oturum.MoladaMi) return;
        string ad;
        lock (oturum.EtkilesimKilidi)
        {
            ad = oturum.Bolumler.LastOrDefault(b => !b.Mola)?.Ad ?? "Ders";
        }
        await BolumBaslatAsync(oturum, ad);
    }

    /// <summary>Ders biterken açık yoklama ve bölüm kapatılır.</summary>
    public async Task KapatAsync(CanliOturum oturum)
    {
        await YoklamaKapatAsync(oturum);
        await AktifBolumuKapatAsync(oturum);
    }

    private async Task<CanliBolum> BolumEkleAsync(CanliOturum oturum, string ad, bool mola, long? molaBitisMs)
    {
        var kayit = new Bolum
        {
            OturumId = oturum.Id,
            Ad = ad,
            Mola = mola,
            Baslangic = Simdi,
            PlanlananBitis = molaBitisMs is { } b ? DateTimeOffset.FromUnixTimeMilliseconds(b).UtcDateTime : null,
        };
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            db.Bolumler.Add(kayit);
            await db.SaveChangesAsync();
        }
        var canli = new CanliBolum(kayit.Id, ad, mola, SimdiMs, molaBitisMs);
        lock (oturum.EtkilesimKilidi) oturum.Bolumler.Add(canli);
        return canli;
    }

    /// <summary>Açık bölümü kapatır; kapanan bölüm mola idiyse true döner.</summary>
    private async Task<bool> AktifBolumuKapatAsync(CanliOturum oturum)
    {
        CanliBolum? aktif;
        lock (oturum.EtkilesimKilidi)
        {
            aktif = oturum.Bolumler.LastOrDefault(b => b.BitisMs is null);
            if (aktif is not null) aktif.BitisMs = SimdiMs;
        }
        if (aktif is null) return false;
        if (aktif.Mola) Volatile.Write(ref oturum.MolaBitisMs, 0);

        var simdi = Simdi;
        await using var db = await fabrika.CreateDbContextAsync();
        await db.Bolumler.Where(b => b.Id == aktif.Id).ExecuteUpdateAsync(u => u.SetProperty(b => b.Bitis, simdi));
        return aktif.Mola;
    }

    // Anlık görüntü

    public EtkilesimDurumu Durum(CanliOturum oturum, long simdiMs)
    {
        var sinyaller = AktifSinyaller(oturum, simdiMs);
        var anonim = oturum.Ayarlar.Anonim;
        string Ad(Guid id) => oturum.Katilimcilar.TryGetValue(id, out var k) ? k.GorunenAd(anonim) : "?";

        List<BolumDurumu> bolumler;
        lock (oturum.EtkilesimKilidi) bolumler = [.. oturum.Bolumler.Select(b => b.Durum())];

        return new EtkilesimDurumu(
            [.. sinyaller.Where(s => s.Tur == SinyalTuru.Soru).OrderBy(s => s.ZamanMs)
                .Select(s => new SinyalBildirimi(s.Id, s.KatilimciId, Ad(s.KatilimciId), s.Tur, s.Metin, s.ZamanMs))],
            sinyaller.Where(s => s.Tur == SinyalTuru.Anlamadim).Select(s => s.KatilimciId).Distinct().Count(),
            sinyaller.Where(s => s.Tur == SinyalTuru.Yavasla).Select(s => s.KatilimciId).Distinct().Count(),
            oturum.AktifYoklama is { } y ? YoklamaDurumu(y) : null,
            bolumler.LastOrDefault(b => b.BitisMs is null),
            bolumler);
    }

    /// <summary>Katılımcının karosunda gösterilecek en önemli açık sinyal.</summary>
    public static SinyalTuru? EnOnemliSinyal(IEnumerable<CanliSinyal> sinyaller, Guid katilimciId)
    {
        SinyalTuru? sonuc = null;
        foreach (var s in sinyaller)
        {
            if (s.KatilimciId != katilimciId) continue;
            if (s.Tur == SinyalTuru.Soru) return SinyalTuru.Soru;
            if (s.Tur == SinyalTuru.Anlamadim || sonuc is null) sonuc = s.Tur;
        }
        return sonuc;
    }

    public OgrenciDurumu OgrenciDurumu(CanliOturum oturum, CanliKatilimci katilimci)
    {
        var simdi = SimdiMs;
        var acik = AktifSinyaller(oturum, simdi).Where(s => s.KatilimciId == katilimci.Id).Select(s => s.Tur).Distinct().ToArray();
        var mola = Volatile.Read(ref oturum.MolaBitisMs);
        return new OgrenciDurumu(OturumYoneticisi.OgrenciAyarlari(oturum.Ayarlar), OgrenciYoklamasi(oturum, katilimci.Id),
            mola > 0 ? new MolaBildirimi(mola) : null, acik);
    }
}
