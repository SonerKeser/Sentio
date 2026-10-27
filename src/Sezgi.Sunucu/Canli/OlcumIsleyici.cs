using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Hublar;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Canli;

/// <summary>
/// Gelen her ölçümün izlediği yol: doğrulama → yumuşatma → kurallar → kalıcı kayıt → bildirimler.
/// Öğrenci kamerası, galeri analizi ve simülasyon aynı hattı kullanır.
/// </summary>
public sealed class OlcumIsleyici(
    OkumaYazici yazici,
    IDbContextFactory<SezgiVeritabani> fabrika,
    IHubContext<OgretmenHub> ogretmenHub,
    IHubContext<OgrenciHub> ogrenciHub,
    TimeProvider saat,
    ILogger<OlcumIsleyici> gunluk)
{
    /// <summary>İstemci ayarlanan aralıktan sık gönderirse fazlası yok sayılır.</summary>
    private const long EnKisaAralikMs = 300;

    public long SimdiMs => saat.GetUtcNow().ToUnixTimeMilliseconds();

    public async Task IsleAsync(CanliOturum oturum, CanliKatilimci katilimci, OkumaGirdisi girdi)
    {
        var olasiliklar = Duygular.Normallestir(girdi.D);
        if (olasiliklar is null) return;
        var dikkat = Sinirla(girdi.Dikkat);
        var goz = Sinirla(girdi.Goz);
        var simdi = SimdiMs;
        var ayarlar = oturum.Ayarlar;

        List<KuralSonucu> sonuclar;
        lock (katilimci.Kilit)
        {
            if (katilimci.Ayrildi || katilimci.Duraklatildi) return;
            if (katilimci.SonOkumaMs is { } son && simdi - son < EnKisaAralikMs) return;

            var kayit = katilimci.Isle(olasiliklar, dikkat, goz, girdi.Yuz, simdi);
            sonuclar = KuralMotoru.Degerlendir(katilimci.Kural, katilimci.Yumusak, kayit, [.. katilimci.Gecmis.Son(40)], ayarlar);
        }

        yazici.Ekle(Okuma.Olustur(oturum.Id, katilimci.Id, simdi, olasiliklar, dikkat, goz, girdi.Yuz));

        foreach (var sonuc in sonuclar)
        {
            await KuralUyarisiYayinlaAsync(oturum, katilimci, sonuc);
        }
    }

    public async Task KuralUyarisiYayinlaAsync(CanliOturum oturum, CanliKatilimci? katilimci, KuralSonucu sonuc)
    {
        var ayarlar = oturum.Ayarlar;
        var ogrenciyeIlet = katilimci is { Kaynak: KatilimciKaynagi.Kamera } && ayarlar.DurtmeAcik;
        var ad = katilimci?.GorunenAd(ayarlar.Anonim);

        if (katilimci is not null)
        {
            lock (katilimci.Kilit)
            {
                katilimci.UyariSayisi++;
                if (sonuc.Tur == UyariTuru.OlumsuzIfade) katilimci.UyariDuygusu = sonuc.Duygu;
            }
        }

        var uyari = new Uyari
        {
            OturumId = oturum.Id,
            KatilimciId = katilimci?.Id,
            Tur = sonuc.Tur,
            Duygu = sonuc.Duygu,
            Oran = sonuc.Oran,
            Mesaj = KuralMotoru.Metin(sonuc, ad),
            OgrenciyeIletildi = ogrenciyeIlet,
            Zaman = saat.GetUtcNow().UtcDateTime,
        };
        await KaydetVeYayinlaAsync(oturum, uyari, ad);

        if (ogrenciyeIlet && katilimci is not null)
        {
            var durtme = new DurtmeBildirimi(TurAdi(sonuc.Tur), sonuc.Duygu, null, "sistem", uyari.Zaman);
            await ogrenciHub.Clients.Group(OgrenciHub.KatilimciGrubu(katilimci.Id)).SendAsync("Durtme", durtme);
        }
    }

    /// <summary>Öğretmenin bir öğrenciye ya da tüm sınıfa gönderdiği mesaj.</summary>
    public async Task OgretmenMesajiAsync(CanliOturum oturum, CanliKatilimci? katilimci, string metin)
    {
        var ad = katilimci?.GorunenAd(oturum.Ayarlar.Anonim);
        var uyari = new Uyari
        {
            OturumId = oturum.Id,
            KatilimciId = katilimci?.Id,
            Tur = UyariTuru.OgretmenMesaji,
            Mesaj = katilimci is null ? $"Sınıfa: {metin}" : $"{ad}: {metin}",
            OgrenciyeIletildi = true,
            Zaman = saat.GetUtcNow().UtcDateTime,
        };
        await KaydetVeYayinlaAsync(oturum, uyari, ad);

        var durtme = new DurtmeBildirimi(TurAdi(UyariTuru.OgretmenMesaji), null, metin, oturum.OgretmenAdi, uyari.Zaman);
        var grup = katilimci is null ? OgrenciHub.OturumGrubu(oturum.Id) : OgrenciHub.KatilimciGrubu(katilimci.Id);
        await ogrenciHub.Clients.Group(grup).SendAsync("Durtme", durtme);
    }

    private async Task KaydetVeYayinlaAsync(CanliOturum oturum, Uyari uyari, string? ad)
    {
        try
        {
            await using var db = await fabrika.CreateDbContextAsync();
            db.Uyarilar.Add(uyari);
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            gunluk.LogWarning(ex, "Uyarı kaydedilemedi: {Mesaj}", uyari.Mesaj);
            return;
        }

        var bildirim = Bildirim(uyari, ad);
        oturum.UyariEkle(bildirim);
        await ogretmenHub.Clients.Group(OgretmenHub.Grup(oturum.Id)).SendAsync("Uyari", bildirim);
    }

    public static UyariBildirimi Bildirim(Uyari u, string? ad) =>
        new(u.Id, u.KatilimciId, ad, u.Tur, u.Duygu, u.Mesaj, u.Oran, u.OgrenciyeIletildi, u.Zaman);

    public static string TurAdi(UyariTuru tur) => tur switch
    {
        UyariTuru.OlumsuzIfade => "olumsuzIfade",
        UyariTuru.DikkatDagildi => "dikkatDagildi",
        UyariTuru.KameradaYok => "kameradaYok",
        UyariTuru.Uyuklama => "uyuklama",
        UyariTuru.SinifOlumsuz => "sinifOlumsuz",
        UyariTuru.SinifDikkat => "sinifDikkat",
        _ => "ogretmenMesaji",
    };

    private static float Sinirla(float deger) => float.IsFinite(deger) ? Math.Clamp(deger, 0f, 1f) : 0f;
}
