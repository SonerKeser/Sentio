using Microsoft.AspNetCore.SignalR;
using Sentio.Sunucu.Alan;
using Sentio.Sunucu.Hizmetler;
using Sentio.Sunucu.Hublar;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Canli;

/// <summary>
/// Her saniye sınıfın anlık görüntüsünü üretir, öğretmen paneline yayınlar, sınıf geneli kuralları çalıştırır
/// ve süresi dolan molayı bitirir.
/// </summary>
public sealed class CanliYayinci(
    CanliOturumDeposu depo,
    OlcumIsleyici isleyici,
    EtkilesimYoneticisi etkilesim,
    IHubContext<OgretmenHub> ogretmenHub,
    ILogger<CanliYayinci> gunluk) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken iptal)
    {
        using var zamanlayici = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await zamanlayici.WaitForNextTickAsync(iptal))
        {
            foreach (var oturum in depo.Hepsi)
            {
                try
                {
                    await IsleAsync(oturum, iptal);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    gunluk.LogError(ex, "Oturum {Oturum} için anlık görüntü üretilemedi.", oturum.Id);
                }
            }
        }
    }

    private async Task IsleAsync(CanliOturum oturum, CancellationToken iptal)
    {
        var simdi = isleyici.SimdiMs;
        var molaBitis = Volatile.Read(ref oturum.MolaBitisMs);
        if (molaBitis > 0 && simdi >= molaBitis) await etkilesim.MolaBitirAsync(oturum);

        var anlik = Olustur(oturum, simdi, etkilesim);
        if (Volatile.Read(ref oturum.Izleyici) > 0)
        {
            await ogretmenHub.Clients.Group(OgretmenHub.Grup(oturum.Id)).SendAsync("Anlik", anlik, iptal);
        }
        if (oturum.MoladaMi) return;

        var s = anlik.Sinif;
        var yuzuGorunen = anlik.Katilimcilar.Count(k => k.Durum == "aktif" && k.Yuz);
        var sonuclar = KuralMotoru.SinifiDegerlendir(oturum.SinifKural, yuzuGorunen, s.OlumsuzOran, s.Dikkat, anlik.ZamanMs, oturum.Ayarlar);
        if (KuralMotoru.SinifAnlamadiDegerlendir(oturum.SinifKural, s.Aktif, anlik.Etkilesim.Anlamadim, simdi) is { } anlamadi)
        {
            sonuclar.Add(anlamadi);
        }
        foreach (var sonuc in sonuclar)
        {
            await isleyici.KuralUyarisiYayinlaAsync(oturum, null, sonuc);
        }
    }

    public static AnlikGoruntu Olustur(CanliOturum oturum, long simdiMs, EtkilesimYoneticisi etkilesim)
    {
        var ayarlar = oturum.Ayarlar;
        var sinyaller = etkilesim.AktifSinyaller(oturum, simdiMs);
        var katilimcilar = new List<KatilimciAnligi>(oturum.Katilimcilar.Count);
        var dagilim = new float[Duygular.Sayi];
        var (aktif, yuzlu, olumsuz) = (0, 0, 0);
        var (dikkatToplam, valansToplam, katilimToplam) = (0f, 0f, 0f);
        var molada = oturum.MoladaMi;

        foreach (var k in oturum.Katilimcilar.Values.OrderBy(k => k.SiraNo))
        {
            KatilimciAnligi anlik;
            lock (k.Kilit)
            {
                var durum = k.Durum(simdiMs);
                if (durum == "ayrildi") continue;
                if (molada && durum is "aktif" or "bekliyor") durum = "molada";

                var baskin = Duygular.Baskin(k.Yumusak);
                var valans = Duygular.Valans(k.Yumusak);
                var katilim = Duygular.Katilim(k.Dikkat, valans, k.Yuz);
                var iz = k.Gecmis.Son(40).Select(g => MathF.Round(Duygular.Katilim(g.Dikkat, g.Valans, g.Yuz), 2)).ToArray();
                anlik = new KatilimciAnligi(
                    k.Id, k.GorunenAd(ayarlar.Anonim), k.Kaynak, durum,
                    [.. k.Yumusak.Select(d => MathF.Round(d, 3))], baskin,
                    MathF.Round(k.Dikkat, 3), MathF.Round(k.Goz, 3), k.Yuz,
                    MathF.Round(valans, 3), MathF.Round(katilim, 3), iz, k.SonOkumaMs,
                    k.UyariDuygusu, k.UyariSayisi, k.DisKimlik,
                    EtkilesimYoneticisi.EnOnemliSinyal(sinyaller, k.Id));

                if (durum == "aktif")
                {
                    aktif++;
                    if (k.Yuz)
                    {
                        yuzlu++;
                        for (var i = 0; i < Duygular.Sayi; i++) dagilim[i] += k.Yumusak[i];
                        dikkatToplam += k.Dikkat;
                        valansToplam += valans;
                        if (KuralMotoru.OlumsuzMu(k.Yumusak, ayarlar, out _)) olumsuz++;
                    }
                    katilimToplam += katilim;
                }
            }
            katilimcilar.Add(anlik);
        }

        if (yuzlu > 0)
        {
            for (var i = 0; i < Duygular.Sayi; i++) dagilim[i] = MathF.Round(dagilim[i] / yuzlu, 3);
        }

        var sinif = new SinifOzeti(
            katilimcilar.Count,
            aktif,
            dagilim,
            yuzlu > 0 ? Duygular.Baskin(dagilim) : null,
            yuzlu > 0 ? MathF.Round(dikkatToplam / yuzlu, 3) : 0f,
            yuzlu > 0 ? MathF.Round(valansToplam / yuzlu, 3) : 0f,
            aktif > 0 ? MathF.Round(katilimToplam / aktif, 3) : 0f,
            yuzlu > 0 ? MathF.Round(olumsuz / (float)yuzlu, 3) : 0f);

        return new AnlikGoruntu(oturum.Id, simdiMs, sinif, katilimcilar, etkilesim.Durum(oturum, simdiMs));
    }
}
