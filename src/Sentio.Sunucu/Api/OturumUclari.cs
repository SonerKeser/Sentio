using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Guvenlik;
using Sentio.Sunucu.Hizmetler;
using Sentio.Sunucu.Raporlar;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Api;

public static class OturumUclari
{
    public static void Esle(WebApplication app)
    {
        var g = app.MapGroup("/api/oturumlar").WithTags("Oturumlar").RequireAuthorization(Yetki.Ogretmen);

        g.MapGet("/", async (ClaimsPrincipal kullanici, SentioVeritabani db, CanliOturumDeposu depo, TimeProvider saat) =>
        {
            var id = kullanici.OgretmenId();
            var liste = await db.Oturumlar
                .Where(o => o.OgretmenId == id)
                .OrderByDescending(o => o.OlusturmaZamani)
                .Take(300)
                .Select(o => new
                {
                    o.Id, o.Baslik, o.SinifAdi, o.KatilimKodu, o.Durum, o.OlusturmaZamani, o.BitisZamani,
                    KatilimciSayisi = o.Katilimcilar.Count,
                    UyariSayisi = db.Uyarilar.Count(u => u.OturumId == o.Id && u.Tur != UyariTuru.OgretmenMesaji),
                })
                .ToListAsync();

            var simdi = saat.GetUtcNow().ToUnixTimeMilliseconds();
            return liste.Select(o => new OturumOzeti(o.Id, o.Baslik, o.SinifAdi, o.KatilimKodu, o.Durum, o.OlusturmaZamani,
                o.BitisZamani, o.KatilimciSayisi, AktifSayisi(depo.Bul(o.Id), simdi), o.UyariSayisi));
        });

        g.MapPost("/", async (OturumOlusturmaIstegi istek, ClaimsPrincipal kullanici, OturumYoneticisi yonetici, CanliOturumDeposu depo) =>
        {
            if (Metin.Ad(istek.Baslik, 160).Length < 2) return Hata.Yanit("Ders başlığı girin.");
            var oturum = await yonetici.OlusturAsync(kullanici.OgretmenId(), kullanici.FindFirstValue(Yetki.AdTalebi) ?? "", istek);
            return Results.Ok(yonetici.Detay(depo.Bul(oturum.Id)!));
        });

        g.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal kullanici, SentioVeritabani db, CanliOturumDeposu depo, OturumYoneticisi yonetici) =>
        {
            var oturum = await YetkiliOturumAsync(db, id, kullanici, ogretmenle: true);
            if (oturum is null) return Results.NotFound();
            if (depo.Bul(id) is { } canli) return Results.Ok(yonetici.Detay(canli));
            return Results.Ok(new OturumDetayi(oturum.Id, oturum.Baslik, oturum.SinifAdi, oturum.KatilimKodu, oturum.Durum,
                oturum.OlusturmaZamani, oturum.BitisZamani, oturum.Ayarlar, oturum.Ogretmen?.AdSoyad ?? "", false));
        });

        g.MapPut("/{id:guid}/ayarlar", async (Guid id, OturumAyarlari ayarlar, ClaimsPrincipal kullanici, SentioVeritabani db, OturumYoneticisi yonetici) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            return Results.Ok(await yonetici.AyarlariGuncelleAsync(id, ayarlar));
        });

        g.MapPost("/{id:guid}/bitir", async (Guid id, ClaimsPrincipal kullanici, SentioVeritabani db, OturumYoneticisi yonetici) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            await yonetici.BitirAsync(id);
            return Results.NoContent();
        });

        g.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal kullanici, SentioVeritabani db, OturumYoneticisi yonetici) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            await yonetici.SilAsync(id);
            return Results.NoContent();
        });

        g.MapPost("/{id:guid}/simulasyon", async (Guid id, SimulasyonIstegi istek, ClaimsPrincipal kullanici, SentioVeritabani db,
            SimulasyonYoneticisi simulasyon, CanliOturumDeposu depo) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            if (depo.Bul(id) is null) return Hata.Yanit("Simülasyon yalnızca süren bir oturumda başlatılabilir.");
            var eklenen = await simulasyon.BaslatAsync(id, istek.KisiSayisi);
            return Results.Ok(new { eklenen });
        });

        g.MapDelete("/{id:guid}/simulasyon", async (Guid id, ClaimsPrincipal kullanici, SentioVeritabani db, SimulasyonYoneticisi simulasyon) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            await simulasyon.DurdurAsync(id);
            return Results.NoContent();
        });

        g.MapGet("/{id:guid}/rapor", async (Guid id, int? aralik, ClaimsPrincipal kullanici, SentioVeritabani db, RaporOlusturucu olusturucu, CancellationToken iptal) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            var sonuc = await olusturucu.OlusturAsync(id, aralik, iptal);
            return sonuc is null ? Results.NotFound() : Results.Ok(sonuc.Value.Rapor);
        });

        g.MapGet("/{id:guid}/rapor.xlsx", async (Guid id, int? aralik, ClaimsPrincipal kullanici, SentioVeritabani db, RaporOlusturucu olusturucu, CancellationToken iptal) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            var sonuc = await olusturucu.OlusturAsync(id, aralik, iptal);
            if (sonuc is null) return Results.NotFound();
            var (rapor, okumalar, adlar) = sonuc.Value;
            var icerik = ExcelDisaAktarici.Olustur(rapor, okumalar, adlar);
            return Results.File(icerik, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{DosyaAdi(rapor)}.xlsx");
        });

        g.MapGet("/{id:guid}/okumalar.csv", async (Guid id, ClaimsPrincipal kullanici, SentioVeritabani db, RaporOlusturucu olusturucu, CancellationToken iptal) =>
        {
            if (await YetkiliOturumAsync(db, id, kullanici) is null) return Results.NotFound();
            var sonuc = await olusturucu.OlusturAsync(id, null, iptal);
            if (sonuc is null) return Results.NotFound();
            var (rapor, okumalar, adlar) = sonuc.Value;
            return Results.File(ExcelDisaAktarici.Csv(okumalar, adlar), "text/csv; charset=utf-8", $"{DosyaAdi(rapor)}.csv");
        });
    }

    /// <summary>Oturum yoksa ya da öğretmene ait değilse null döner; yöneticiler tüm oturumlara erişebilir.</summary>
    private static async Task<Oturum?> YetkiliOturumAsync(SentioVeritabani db, Guid id, ClaimsPrincipal kullanici, bool ogretmenle = false)
    {
        var sorgu = db.Oturumlar.AsNoTracking();
        if (ogretmenle) sorgu = sorgu.Include(o => o.Ogretmen);
        var oturum = await sorgu.FirstOrDefaultAsync(o => o.Id == id);
        if (oturum is null) return null;
        return oturum.OgretmenId == kullanici.OgretmenId() || kullanici.YoneticiMi() ? oturum : null;
    }

    private static int AktifSayisi(CanliOturum? oturum, long simdi)
    {
        if (oturum is null) return 0;
        var adet = 0;
        foreach (var k in oturum.Katilimcilar.Values)
        {
            lock (k.Kilit)
            {
                if (k.Durum(simdi) == "aktif") adet++;
            }
        }
        return adet;
    }

    private static string DosyaAdi(Rapor rapor)
    {
        var gecersiz = Path.GetInvalidFileNameChars();
        var ad = new string([.. rapor.Oturum.Baslik.Select(c => gecersiz.Contains(c) ? '_' : c)]).Trim();
        return $"Sentio - {ad} - {DateTime.SpecifyKind(rapor.Oturum.Baslangic, DateTimeKind.Utc).ToLocalTime():yyyy-MM-dd HH.mm}";
    }
}
