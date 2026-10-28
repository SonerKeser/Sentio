using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Canli;

/// <summary>Süren oturumların bellek içi durumu. Sunucu yeniden başlarsa veritabanından geri yüklenir.</summary>
public sealed class CanliOturumDeposu
{
    private readonly ConcurrentDictionary<Guid, CanliOturum> _oturumlar = new();
    private readonly ConcurrentDictionary<string, Guid> _kodlar = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, (Guid OturumId, Guid KatilimciId)> _jetonlar = new(StringComparer.Ordinal);

    public IEnumerable<CanliOturum> Hepsi => _oturumlar.Values;

    public CanliOturum? Bul(Guid oturumId) => _oturumlar.GetValueOrDefault(oturumId);

    public CanliOturum? KodaGoreBul(string kod) =>
        _kodlar.TryGetValue(KodNormallestir(kod), out var id) ? Bul(id) : null;

    public bool KodKullaniliyor(string kod) => _kodlar.ContainsKey(kod);

    public (CanliOturum Oturum, CanliKatilimci Katilimci)? JetonaGoreBul(string jetonOzeti)
    {
        if (!_jetonlar.TryGetValue(jetonOzeti, out var kimlik)) return null;
        var oturum = Bul(kimlik.OturumId);
        if (oturum is null || !oturum.Katilimcilar.TryGetValue(kimlik.KatilimciId, out var katilimci)) return null;
        return (oturum, katilimci);
    }

    public CanliOturum Ekle(Oturum oturum, string ogretmenAdi)
    {
        var canli = new CanliOturum(oturum, ogretmenAdi);
        _oturumlar[oturum.Id] = canli;
        _kodlar[oturum.KatilimKodu] = oturum.Id;
        foreach (var k in oturum.Katilimcilar) KatilimciEkle(canli, k);
        return canli;
    }

    public CanliKatilimci KatilimciEkle(CanliOturum oturum, Katilimci k)
    {
        var canli = new CanliKatilimci(k.Id, k.OturumId, k.Ad, k.SiraNo, k.Kaynak, k.DisKimlik)
        {
            Ayrildi = k.AyrilmaZamani is not null,
        };
        oturum.Katilimcilar[k.Id] = canli;
        if (k.JetonOzeti is not null && k.AyrilmaZamani is null) _jetonlar[k.JetonOzeti] = (k.OturumId, k.Id);
        if (k.DisKimlik is not null) oturum.GaleriIzleri[k.DisKimlik] = k.Id;
        return canli;
    }

    public void JetonuIptalEt(string jetonOzeti) => _jetonlar.TryRemove(jetonOzeti, out _);

    public CanliOturum? Kaldir(Guid oturumId)
    {
        if (!_oturumlar.TryRemove(oturumId, out var oturum)) return null;
        _kodlar.TryRemove(oturum.KatilimKodu, out _);
        foreach (var (ozet, kimlik) in _jetonlar)
        {
            if (kimlik.OturumId == oturumId) _jetonlar.TryRemove(ozet, out _);
        }
        return oturum;
    }

    public async Task YukleAsync(SentioVeritabani db, CancellationToken iptal)
    {
        var oturumlar = await db.Oturumlar
            .Include(o => o.Katilimcilar)
            .Include(o => o.Ogretmen)
            .Where(o => o.Durum == OturumDurumu.Canli)
            .AsSplitQuery()
            .ToListAsync(iptal);

        foreach (var oturum in oturumlar)
        {
            var canli = Ekle(oturum, oturum.Ogretmen?.AdSoyad ?? "");
            var uyarilar = await db.Uyarilar
                .Where(u => u.OturumId == oturum.Id)
                .OrderByDescending(u => u.Id)
                .Take(100)
                .ToListAsync(iptal);
            canli.UyarilariYukle(uyarilar.AsEnumerable().Reverse().Select(u =>
                OlcumIsleyici.Bildirim(u, u.KatilimciId is { } kid && canli.Katilimcilar.TryGetValue(kid, out var k)
                    ? k.GorunenAd(canli.Ayarlar.Anonim) : null)));
            await EtkilesimiYukleAsync(db, canli, iptal);
        }
    }

    /// <summary>Sunucu ders sürerken yeniden başlarsa açık yoklama, bölümler, mola ve söz istekleri geri gelir.</summary>
    private static async Task EtkilesimiYukleAsync(SentioVeritabani db, CanliOturum canli, CancellationToken iptal)
    {
        static long Ms(DateTime d) => new DateTimeOffset(DateTime.SpecifyKind(d, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

        foreach (var b in await db.Bolumler.Where(b => b.OturumId == canli.Id).OrderBy(b => b.Baslangic).ToListAsync(iptal))
        {
            var bolum = new CanliBolum(b.Id, b.Ad, b.Mola, Ms(b.Baslangic), b.PlanlananBitis is { } p ? Ms(p) : null);
            if (b.Bitis is { } bitis) bolum.BitisMs = Ms(bitis);
            else if (b.Mola && bolum.MolaBitisMs is { } molaBitis) canli.MolaBitisMs = molaBitis;
            canli.Bolumler.Add(bolum);
        }

        var yoklama = await db.Yoklamalar.Include(y => y.Yanitlar)
            .Where(y => y.OturumId == canli.Id && y.Bitis == null)
            .OrderByDescending(y => y.Baslangic)
            .FirstOrDefaultAsync(iptal);
        if (yoklama is not null)
        {
            var aktif = new CanliYoklama(yoklama.Id, yoklama.Tur, yoklama.Soru, [.. yoklama.Secenekler], Ms(yoklama.Baslangic));
            foreach (var y in yoklama.Yanitlar) aktif.Yanitlar[y.KatilimciId] = y.Secim;
            canli.AktifYoklama = aktif;
        }

        foreach (var s in await db.Sinyaller.Where(s => s.OturumId == canli.Id && s.Tur == SinyalTuru.Soru && s.KapanmaZamani == null).ToListAsync(iptal))
        {
            canli.Sinyaller.Add(new CanliSinyal(s.Id, s.KatilimciId, s.Tur, s.Metin, Ms(s.Zaman)));
        }
    }

    public static string KodNormallestir(string kod) => kod.Trim().Replace(" ", "").Replace("-", "").ToUpperInvariant();
}
