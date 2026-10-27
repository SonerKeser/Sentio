using System.Diagnostics;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Guvenlik;
using Sezgi.Sunucu.Raporlar;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Api;

public sealed record AnalitikSinif(string? Ad, int DersSayisi);

public sealed record AnalitikDers(
    Guid Id, string Baslik, string? SinifAdi, DateTime Tarih, double SureSn, int KatilimciSayisi, float Dikkat, float Katilim,
    float Valans, float OlumsuzOran, float[] Dagilim, float? AnlamaOrani, int UyariSayisi, int AnlamadimSayisi, int SoruSayisi);

public sealed record AnalitikEgilim(Guid OturumId, float Katilim, float Dikkat);

public sealed record AnalitikOgrenci(
    string Ad, int DersSayisi, float Dikkat, float Katilim, float Valans, float YuzOrani, Duygu? Baskin,
    int UyariSayisi, int AnlamadimSayisi, IReadOnlyList<AnalitikEgilim> Egilim);

public sealed record AnalitikOzet(int DersSayisi, double ToplamSureSn, float Dikkat, float Katilim, float? AnlamaOrani, int OgrenciSayisi);

public sealed record Analitik(
    IReadOnlyList<AnalitikSinif> Siniflar,
    string? SeciliSinif,
    AnalitikOzet Ozet,
    IReadOnlyList<AnalitikDers> Dersler,
    IReadOnlyList<AnalitikOgrenci> Ogrenciler);

public static class AnalitikUclari
{
    private const int EnFazlaDers = 200;

    public static void Esle(WebApplication app)
    {
        app.MapGet("/api/analitik", async (string? sinif, ClaimsPrincipal kullanici, SezgiVeritabani db, IServiceScopeFactory kapsamlar, CancellationToken iptal) =>
        {
            var ogretmenId = kullanici.OgretmenId();
            var biten = db.Oturumlar.Where(o => o.OgretmenId == ogretmenId && o.Durum == OturumDurumu.Bitti);

            // 1.1 öncesi biten derslerin özeti ilk açılışta hesaplanır.
            var eksikler = await biten.Where(o => !db.OturumIstatistikleri.Any(i => i.OturumId == o.Id))
                .OrderByDescending(o => o.OlusturmaZamani).Select(o => o.Id).Take(EnFazlaDers).ToListAsync(iptal);
            foreach (var id in eksikler)
            {
                await using var kapsam = kapsamlar.CreateAsyncScope();
                await kapsam.ServiceProvider.GetRequiredService<IstatistikHesaplayici>().KaydetAsync(id, iptal);
            }

            var siniflar = await biten.GroupBy(o => o.SinifAdi).Select(g => new AnalitikSinif(g.Key, g.Count()))
                .ToListAsync(iptal);
            var secili = sinif == "-" ? null : sinif;
            var sorgu = sinif is null ? biten : biten.Where(o => o.SinifAdi == secili);

            var dersler = await sorgu
                .OrderByDescending(o => o.OlusturmaZamani)
                .Take(EnFazlaDers)
                .Join(db.OturumIstatistikleri, o => o.Id, i => i.OturumId, (o, i) => new { o.Id, o.Baslik, o.SinifAdi, o.OlusturmaZamani, i })
                .ToListAsync(iptal);
            var dersListesi = dersler
                .OrderBy(d => d.OlusturmaZamani)
                .Where(d => d.i.OkumaSayisi > 0)
                .Select(d => new AnalitikDers(d.Id, d.Baslik, d.SinifAdi, d.OlusturmaZamani, d.i.SureSn, d.i.KatilimciSayisi,
                    d.i.Dikkat, d.i.Katilim, d.i.Valans, d.i.OlumsuzOran, [.. d.i.Dagilim], d.i.AnlamaOrani, d.i.UyariSayisi,
                    d.i.AnlamadimSayisi, d.i.SoruSayisi))
                .ToList();

            var dersKimlikleri = dersListesi.Select(d => d.Id).ToList();
            var sira = dersListesi.Select((d, i) => (d.Id, i)).ToDictionary(x => x.Id, x => x.i);
            var kayitlar = await db.KatilimciIstatistikleri
                .Where(k => dersKimlikleri.Contains(k.OturumId) && k.AdAnahtari != null && k.OkumaSayisi > 0)
                .ToListAsync(iptal);
            var ogrenciler = kayitlar
                .GroupBy(k => k.AdAnahtari!)
                .Select(g =>
                {
                    var sirali = g.OrderBy(k => sira[k.OturumId]).ToList();
                    var agirlik = (float)g.Sum(k => k.OkumaSayisi);
                    float Ort(Func<KatilimciIstatistigi, float> f) => MathF.Round(g.Sum(k => f(k) * k.OkumaSayisi) / agirlik, 3);
                    return new AnalitikOgrenci(
                        sirali[^1].Ad,
                        g.Count(),
                        Ort(k => k.Dikkat),
                        Ort(k => k.Katilim),
                        Ort(k => k.Valans),
                        Ort(k => k.YuzOrani),
                        g.Where(k => k.Baskin is not null).GroupBy(k => k.Baskin).OrderByDescending(x => x.Count()).FirstOrDefault()?.Key,
                        g.Sum(k => k.UyariSayisi),
                        g.Sum(k => k.AnlamadimSayisi),
                        [.. sirali.Select(k => new AnalitikEgilim(k.OturumId, k.Katilim, k.Dikkat))]);
                })
                .OrderBy(o => o.Katilim)
                .ToList();

            var anlama = dersListesi.Where(d => d.AnlamaOrani is not null).Select(d => d.AnlamaOrani!.Value).ToList();
            var ozet = new AnalitikOzet(
                dersListesi.Count,
                dersListesi.Sum(d => d.SureSn),
                dersListesi.Count > 0 ? MathF.Round(dersListesi.Average(d => d.Dikkat), 3) : 0f,
                dersListesi.Count > 0 ? MathF.Round(dersListesi.Average(d => d.Katilim), 3) : 0f,
                anlama.Count > 0 ? MathF.Round(anlama.Average(), 3) : null,
                ogrenciler.Count);

            return new Analitik([.. siniflar.OrderByDescending(s => s.DersSayisi)], sinif, ozet, dersListesi, ogrenciler);
        }).WithTags("Analitik").RequireAuthorization(Yetki.Ogretmen);

        var yonetim = app.MapGroup("/api/yonetim").WithTags("Yönetim").RequireAuthorization(Yetki.Yonetici);

        yonetim.MapGet("/durum", async (SezgiVeritabani db, CanliOturumDeposu depo, IOptions<SezgiAyarlari> ayarlar, IWebHostEnvironment ortam) =>
        {
            var cevrimici = depo.Hepsi.Sum(o => o.Katilimcilar.Values.Count(k =>
            {
                lock (k.Kilit) return k.BaglantiSayisi > 0 && !k.Ayrildi;
            }));
            return new SunucuDurumu(
                Surum.Metin,
                (long)(DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalSeconds,
                depo.Hepsi.Count(),
                cevrimici,
                VeritabaniBoyutu(VeriKlasoru(ayarlar.Value, ortam)),
                await db.Ogretmenler.CountAsync(),
                await db.Oturumlar.CountAsync(),
                await db.Okumalar.LongCountAsync());
        });

        // SQLite'ın VACUUM INTO komutu, sunucu çalışırken tutarlı bir yedek dosyası üretir.
        yonetim.MapGet("/yedek", async (SezgiVeritabani db, IOptions<SezgiAyarlari> ayarlar, IWebHostEnvironment ortam, HttpContext http) =>
        {
            var gecici = Path.Combine(Path.GetTempPath(), $"sezgi-yedek-{Guid.NewGuid():N}.db");
            await db.Database.ExecuteSqlRawAsync("VACUUM INTO {0}", gecici);
            http.Response.RegisterForDispose(new GeciciDosya(gecici));
            var ad = $"sezgi-yedek-{DateTime.Now:yyyyMMdd-HHmm}.db";
            return Results.File(new FileStream(gecici, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete), "application/vnd.sqlite3", ad);
        });
    }

    private static string VeriKlasoru(SezgiAyarlari a, IWebHostEnvironment ortam) => Path.GetFullPath(a.VeriKlasoru, ortam.ContentRootPath);

    private static long VeritabaniBoyutu(string klasor)
    {
        if (!Directory.Exists(klasor)) return 0;
        return new DirectoryInfo(klasor).EnumerateFiles("sezgi.db*").Sum(f => f.Length);
    }

    private sealed class GeciciDosya(string yol) : IDisposable
    {
        public void Dispose()
        {
            try
            {
                File.Delete(yol);
            }
            catch (IOException)
            {
            }
        }
    }
}
