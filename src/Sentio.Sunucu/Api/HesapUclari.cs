using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Guvenlik;
using Sentio.Sunucu.Hizmetler;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Api;

public static class HesapUclari
{
    public const int EnKisaParola = 8;
    private static readonly PasswordHasher<Ogretmen> Ozetleyici = new();

    public static void Esle(WebApplication app)
    {
        var hesap = app.MapGroup("/api/hesap").WithTags("Hesap");

        hesap.MapGet("/durum", async (ClaimsPrincipal kullanici, SentioVeritabani db) =>
        {
            var kurulumGerekli = !await db.Ogretmenler.AnyAsync();
            OgretmenBilgisi? ogretmen = null;
            if (kullanici.Identity?.IsAuthenticated == true && kullanici.Identity.AuthenticationType == Yetki.CerezSemasi)
            {
                var o = await db.Ogretmenler.FindAsync(kullanici.OgretmenId());
                if (o is not null) ogretmen = Bilgi(o);
            }
            return new HesapDurumu(kurulumGerekli, ogretmen, Surum.Metin);
        });

        hesap.MapPost("/kurulum", async (KurulumIstegi istek, HttpContext http, SentioVeritabani db) =>
        {
            if (await db.Ogretmenler.AnyAsync()) return Hata.Yanit("Kurulum zaten tamamlanmış.", StatusCodes.Status409Conflict);
            if (Dogrula(istek.KullaniciAdi, istek.AdSoyad, istek.Parola) is { } hata) return Hata.Yanit(hata);

            var ogretmen = new Ogretmen { KullaniciAdi = istek.KullaniciAdi.Trim(), AdSoyad = Metin.Ad(istek.AdSoyad, 128), Yonetici = true };
            ogretmen.ParolaOzeti = Ozetleyici.HashPassword(ogretmen, istek.Parola);
            db.Ogretmenler.Add(ogretmen);
            await db.SaveChangesAsync();
            await OturumAcAsync(http, ogretmen);
            return Results.Ok(Bilgi(ogretmen));
        }).RequireRateLimiting(HizSiniri.Giris);

        hesap.MapPost("/giris", async (GirisIstegi istek, HttpContext http, SentioVeritabani db) =>
        {
            var ad = (istek.KullaniciAdi ?? "").Trim();
            var ogretmen = await db.Ogretmenler.FirstOrDefaultAsync(o => o.KullaniciAdi == ad);
            if (ogretmen is null || Ozetleyici.VerifyHashedPassword(ogretmen, ogretmen.ParolaOzeti, istek.Parola ?? "") == PasswordVerificationResult.Failed)
            {
                return Hata.Yanit("Kullanıcı adı ya da parola hatalı.", StatusCodes.Status401Unauthorized);
            }
            await OturumAcAsync(http, ogretmen);
            return Results.Ok(Bilgi(ogretmen));
        }).RequireRateLimiting(HizSiniri.Giris);

        hesap.MapPost("/cikis", async (HttpContext http) =>
        {
            await http.SignOutAsync(Yetki.CerezSemasi);
            return Results.NoContent();
        });

        hesap.MapPost("/parola", async (ParolaDegistirmeIstegi istek, ClaimsPrincipal kullanici, SentioVeritabani db) =>
        {
            var ogretmen = await db.Ogretmenler.FindAsync(kullanici.OgretmenId());
            if (ogretmen is null) return Results.Unauthorized();
            if (Ozetleyici.VerifyHashedPassword(ogretmen, ogretmen.ParolaOzeti, istek.Mevcut ?? "") == PasswordVerificationResult.Failed)
            {
                return Hata.Yanit("Mevcut parola hatalı.");
            }
            if ((istek.Yeni ?? "").Length < EnKisaParola) return Hata.Yanit($"Yeni parola en az {EnKisaParola} karakter olmalı.");
            ogretmen.ParolaOzeti = Ozetleyici.HashPassword(ogretmen, istek.Yeni!);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(Yetki.Ogretmen).RequireRateLimiting(HizSiniri.Giris);

        var ogretmenler = app.MapGroup("/api/ogretmenler").WithTags("Öğretmenler").RequireAuthorization(Yetki.Yonetici);

        ogretmenler.MapGet("/", async (SentioVeritabani db) =>
            (await db.Ogretmenler.OrderBy(o => o.AdSoyad).ToListAsync()).Select(Bilgi));

        ogretmenler.MapPost("/", async (OgretmenEklemeIstegi istek, SentioVeritabani db) =>
        {
            if (Dogrula(istek.KullaniciAdi, istek.AdSoyad, istek.Parola) is { } hata) return Hata.Yanit(hata);
            var ad = istek.KullaniciAdi.Trim();
            if (await db.Ogretmenler.AnyAsync(o => o.KullaniciAdi == ad)) return Hata.Yanit("Bu kullanıcı adı kullanılıyor.", StatusCodes.Status409Conflict);
            var ogretmen = new Ogretmen { KullaniciAdi = ad, AdSoyad = Metin.Ad(istek.AdSoyad, 128), Yonetici = istek.Yonetici };
            ogretmen.ParolaOzeti = Ozetleyici.HashPassword(ogretmen, istek.Parola);
            db.Ogretmenler.Add(ogretmen);
            await db.SaveChangesAsync();
            return Results.Ok(Bilgi(ogretmen));
        });

        ogretmenler.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal kullanici, SentioVeritabani db,
            CanliOturumDeposu depo, OturumYoneticisi yonetici) =>
        {
            if (id == kullanici.OgretmenId()) return Hata.Yanit("Kendi hesabınızı silemezsiniz.");
            foreach (var canli in depo.Hepsi.Where(o => o.OgretmenId == id).ToList()) await yonetici.BitirAsync(canli.Id);
            var silinen = await db.Ogretmenler.Where(o => o.Id == id).ExecuteDeleteAsync();
            return silinen > 0 ? Results.NoContent() : Results.NotFound();
        });
    }

    private static string? Dogrula(string? kullaniciAdi, string? adSoyad, string? parola)
    {
        var ad = (kullaniciAdi ?? "").Trim();
        if (ad.Length is < 3 or > 64 || !ad.All(c => char.IsLetterOrDigit(c) || c is '.' or '_' or '-'))
        {
            return "Kullanıcı adı 3-64 karakter olmalı; harf, rakam, nokta, alt çizgi ve tire kullanılabilir.";
        }
        if (Metin.Ad(adSoyad, 128).Length < 2) return "Ad soyad girin.";
        if ((parola ?? "").Length < EnKisaParola) return $"Parola en az {EnKisaParola} karakter olmalı.";
        return null;
    }

    private static async Task OturumAcAsync(HttpContext http, Ogretmen ogretmen)
    {
        List<Claim> talepler =
        [
            new(ClaimTypes.NameIdentifier, ogretmen.Id.ToString()),
            new(ClaimTypes.Name, ogretmen.KullaniciAdi),
            new(Yetki.AdTalebi, ogretmen.AdSoyad),
        ];
        if (ogretmen.Yonetici) talepler.Add(new Claim(ClaimTypes.Role, Yetki.YoneticiRolu));
        var kimlik = new ClaimsIdentity(talepler, Yetki.CerezSemasi);
        await http.SignInAsync(Yetki.CerezSemasi, new ClaimsPrincipal(kimlik), new AuthenticationProperties { IsPersistent = true });
    }

    private static OgretmenBilgisi Bilgi(Ogretmen o) => new(o.Id, o.KullaniciAdi, o.AdSoyad, o.Yonetici);
}
