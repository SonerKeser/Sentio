using Microsoft.AspNetCore.SignalR;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Hublar;

namespace Sezgi.Sunucu.Canli;

/// <summary>Her saniye sınıfın anlık görüntüsünü üretir, öğretmen paneline yayınlar ve sınıf geneli kuralları çalıştırır.</summary>
public sealed class CanliYayinci(
    CanliOturumDeposu depo,
    OlcumIsleyici isleyici,
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
                    var anlik = Olustur(oturum, isleyici.SimdiMs);
                    if (Volatile.Read(ref oturum.Izleyici) > 0)
                    {
                        await ogretmenHub.Clients.Group(OgretmenHub.Grup(oturum.Id)).SendAsync("Anlik", anlik, iptal);
                    }

                    var s = anlik.Sinif;
                    var yuzuGorunen = anlik.Katilimcilar.Count(k => k.Durum == "aktif" && k.Yuz);
                    foreach (var sonuc in KuralMotoru.SinifiDegerlendir(oturum.SinifKural, yuzuGorunen, s.OlumsuzOran, s.Dikkat, anlik.ZamanMs, oturum.Ayarlar))
                    {
                        await isleyici.KuralUyarisiYayinlaAsync(oturum, null, sonuc);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    gunluk.LogError(ex, "Oturum {Oturum} için anlık görüntü üretilemedi.", oturum.Id);
                }
            }
        }
    }

    public static AnlikGoruntu Olustur(CanliOturum oturum, long simdiMs)
    {
        var ayarlar = oturum.Ayarlar;
        var katilimcilar = new List<KatilimciAnligi>(oturum.Katilimcilar.Count);
        var dagilim = new float[Duygular.Sayi];
        var (aktif, yuzlu, olumsuz) = (0, 0, 0);
        var (dikkatToplam, valansToplam, katilimToplam) = (0f, 0f, 0f);

        foreach (var k in oturum.Katilimcilar.Values.OrderBy(k => k.SiraNo))
        {
            KatilimciAnligi anlik;
            lock (k.Kilit)
            {
                var durum = k.Durum(simdiMs);
                if (durum == "ayrildi") continue;

                var baskin = Duygular.Baskin(k.Yumusak);
                var valans = Duygular.Valans(k.Yumusak);
                var katilim = Duygular.Katilim(k.Dikkat, valans, k.Yuz);
                var iz = k.Gecmis.Son(40).Select(g => MathF.Round(Duygular.Katilim(g.Dikkat, g.Valans, g.Yuz), 2)).ToArray();
                anlik = new KatilimciAnligi(
                    k.Id, k.GorunenAd(ayarlar.Anonim), k.Kaynak, durum,
                    [.. k.Yumusak.Select(d => MathF.Round(d, 3))], baskin,
                    MathF.Round(k.Dikkat, 3), MathF.Round(k.Goz, 3), k.Yuz,
                    MathF.Round(valans, 3), MathF.Round(katilim, 3), iz, k.SonOkumaMs,
                    k.UyariDuygusu, k.UyariSayisi, k.DisKimlik);

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

        return new AnlikGoruntu(oturum.Id, simdiMs, sinif, katilimcilar);
    }
}
