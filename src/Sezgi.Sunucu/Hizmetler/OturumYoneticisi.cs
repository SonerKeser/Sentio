using System.Security.Cryptography;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Guvenlik;
using Sezgi.Sunucu.Hublar;
using Sezgi.Sunucu.Raporlar;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Hizmetler;

/// <summary>Oturum yaşam döngüsü: oluşturma, katılım, ayar değişikliği ve bitiş.</summary>
public sealed class OturumYoneticisi(
    CanliOturumDeposu depo,
    IDbContextFactory<SezgiVeritabani> fabrika,
    IHubContext<OgretmenHub> ogretmenHub,
    IHubContext<OgrenciHub> ogrenciHub,
    SimulasyonYoneticisi simulasyon,
    EtkilesimYoneticisi etkilesim,
    IServiceScopeFactory kapsamlar,
    ILogger<OturumYoneticisi> gunluk)
{
    public const string SilinmisAd = "Silinmiş katılımcı";

    /// <summary>Karışabilecek karakterler (0/O, 1/I/L) çıkarılmış alfabe.</summary>
    private const string KodAlfabesi = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public async Task<Oturum> OlusturAsync(Guid ogretmenId, string ogretmenAdi, OturumOlusturmaIstegi istek)
    {
        var ayarlar = istek.Ayarlar ?? new OturumAyarlari();
        ayarlar.Dogrula();
        var oturum = new Oturum
        {
            OgretmenId = ogretmenId,
            Baslik = Metin.Ad(istek.Baslik, 160),
            SinifAdi = Metin.Ad(istek.SinifAdi, 80) is { Length: > 0 } s ? s : null,
            KatilimKodu = KodUret(),
            Ayarlar = ayarlar,
        };

        await using var db = await fabrika.CreateDbContextAsync();
        db.Oturumlar.Add(oturum);
        await db.SaveChangesAsync();
        depo.Ekle(oturum, ogretmenAdi);
        return oturum;
    }

    public async Task<KatilimYaniti?> KatilAsync(string kod, string ad)
    {
        var oturum = depo.KodaGoreBul(kod);
        if (oturum is null) return null;

        var jeton = Yetki.JetonUret();
        var katilimci = new Katilimci
        {
            OturumId = oturum.Id,
            Ad = ad,
            SiraNo = oturum.SonrakiSiraNo(),
            Kaynak = KatilimciKaynagi.Kamera,
            JetonOzeti = Yetki.JetonOzeti(jeton),
        };
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            db.Katilimcilar.Add(katilimci);
            await db.SaveChangesAsync();
        }
        depo.KatilimciEkle(oturum, katilimci);

        return new KatilimYaniti(katilimci.Id, jeton, oturum.Id, oturum.Baslik, oturum.SinifAdi, oturum.OgretmenAdi,
            katilimci.Ad, OgrenciAyarlari(oturum.Ayarlar));
    }

    public async Task KatilimciAyrildiAsync(CanliOturum oturum, CanliKatilimci katilimci, bool verileriSil = false)
    {
        lock (katilimci.Kilit) katilimci.Ayrildi = true;
        await etkilesim.SinyalGeriAlAsync(oturum, katilimci.Id, SinyalTuru.Soru);
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            var kayit = await db.Katilimcilar.FindAsync(katilimci.Id);
            if (kayit is null) return;
            kayit.AyrilmaZamani = DateTime.UtcNow;
            if (kayit.JetonOzeti is not null) depo.JetonuIptalEt(kayit.JetonOzeti);
            if (verileriSil)
            {
                kayit.Ad = SilinmisAd;
                kayit.JetonOzeti = null;
            }
            await db.SaveChangesAsync();
        }
        if (!verileriSil) return;

        lock (katilimci.Kilit) katilimci.Ad = SilinmisAd;
        oturum.UyarilariKaldir(katilimci.Id);
        oturum.AktifYoklama?.Yanitlar.TryRemove(katilimci.Id, out _);
        lock (oturum.EtkilesimKilidi) oturum.Sinyaller.RemoveAll(s => s.KatilimciId == katilimci.Id);
        await KatilimciVerileriniSilAsync(katilimci.Id);
        // Toplu yazıcı kuyruğunda bekleyen son ölçümler de yazıldıktan sonra temizlensin.
        _ = Task.Delay(TimeSpan.FromSeconds(3)).ContinueWith(_ => KatilimciVerileriniSilAsync(katilimci.Id), TaskScheduler.Default);
    }

    private async Task KatilimciVerileriniSilAsync(Guid katilimciId)
    {
        try
        {
            await using var db = await fabrika.CreateDbContextAsync();
            await db.Okumalar.Where(o => o.KatilimciId == katilimciId).ExecuteDeleteAsync();
            await db.Uyarilar.Where(u => u.KatilimciId == katilimciId).ExecuteDeleteAsync();
            await db.Sinyaller.Where(s => s.KatilimciId == katilimciId).ExecuteDeleteAsync();
            await db.YoklamaYanitlari.Where(y => y.KatilimciId == katilimciId).ExecuteDeleteAsync();
            await db.KatilimciIstatistikleri.Where(k => k.KatilimciId == katilimciId).ExecuteDeleteAsync();
        }
        catch (Exception ex)
        {
            gunluk.LogError(ex, "Katılımcı {Katilimci} verileri silinemedi.", katilimciId);
        }
    }

    public async Task<OturumAyarlari?> AyarlariGuncelleAsync(Guid oturumId, OturumAyarlari yeni)
    {
        yeni.Dogrula();
        await using var db = await fabrika.CreateDbContextAsync();
        var oturum = await db.Oturumlar.FindAsync(oturumId);
        if (oturum is null) return null;
        oturum.Ayarlar = yeni.Kopya();
        await db.SaveChangesAsync();

        if (depo.Bul(oturumId) is { } canli)
        {
            canli.Ayarlar = yeni.Kopya();
            await ogrenciHub.Clients.Group(OgrenciHub.OturumGrubu(oturumId)).SendAsync("Ayarlar", OgrenciAyarlari(yeni));
            await ogretmenHub.Clients.Group(OgretmenHub.Grup(oturumId)).SendAsync("OturumGuncellendi", Detay(canli));
        }
        return yeni;
    }

    public async Task<bool> BitirAsync(Guid oturumId)
    {
        await simulasyon.DurdurAsync(oturumId);
        if (depo.Bul(oturumId) is { } acik) await etkilesim.KapatAsync(acik);
        await using var db = await fabrika.CreateDbContextAsync();
        var oturum = await db.Oturumlar.FindAsync(oturumId);
        if (oturum is null) return false;
        if (oturum.Durum == OturumDurumu.Canli)
        {
            oturum.Durum = OturumDurumu.Bitti;
            oturum.BitisZamani = DateTime.UtcNow;
            await db.Katilimcilar
                .Where(k => k.OturumId == oturumId && k.AyrilmaZamani == null)
                .ExecuteUpdateAsync(s => s.SetProperty(k => k.AyrilmaZamani, oturum.BitisZamani));
            await db.SaveChangesAsync();
        }

        if (depo.Kaldir(oturumId) is { } canli)
        {
            await ogrenciHub.Clients.Group(OgrenciHub.OturumGrubu(oturumId)).SendAsync("OturumBitti");
            await ogretmenHub.Clients.Group(OgretmenHub.Grup(oturumId)).SendAsync("OturumBitti", Detay(canli, OturumDurumu.Bitti, oturum.BitisZamani));
        }
        await IstatistikleriKaydetAsync(oturumId);
        return true;
    }

    /// <summary>Dönem analitiği için dersin özetini hesaplayıp saklar.</summary>
    public async Task IstatistikleriKaydetAsync(Guid oturumId)
    {
        try
        {
            await using var kapsam = kapsamlar.CreateAsyncScope();
            await kapsam.ServiceProvider.GetRequiredService<IstatistikHesaplayici>().KaydetAsync(oturumId, CancellationToken.None);
        }
        catch (Exception ex)
        {
            gunluk.LogError(ex, "Ders {Oturum} istatistikleri hesaplanamadı.", oturumId);
        }
    }

    public async Task<bool> SilAsync(Guid oturumId)
    {
        if (depo.Bul(oturumId) is not null) await BitirAsync(oturumId);
        await using var db = await fabrika.CreateDbContextAsync();
        return await db.Oturumlar.Where(o => o.Id == oturumId).ExecuteDeleteAsync() > 0;
    }

    public OturumDetayi Detay(CanliOturum o, OturumDurumu durum = OturumDurumu.Canli, DateTime? bitis = null) =>
        new(o.Id, o.Baslik, o.SinifAdi, o.KatilimKodu, durum, o.OlusturmaZamani, bitis, o.Ayarlar, o.OgretmenAdi,
            simulasyon.Calisiyor(o.Id));

    public static OgrenciAyarlari OgrenciAyarlari(OturumAyarlari a) => new(a.OrneklemeMs, a.OgrenciKendiniGorsun, a.DurtmeAcik);

    private string KodUret()
    {
        Span<char> kod = stackalloc char[6];
        for (var deneme = 0; deneme < 100; deneme++)
        {
            for (var i = 0; i < kod.Length; i++) kod[i] = KodAlfabesi[RandomNumberGenerator.GetInt32(KodAlfabesi.Length)];
            var aday = new string(kod);
            if (!depo.KodKullaniliyor(aday)) return aday;
        }
        throw new InvalidOperationException("Benzersiz katılım kodu üretilemedi.");
    }
}
