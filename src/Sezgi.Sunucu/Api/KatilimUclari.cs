using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Claims;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.Options;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Guvenlik;
using Sezgi.Sunucu.Hizmetler;

namespace Sezgi.Sunucu.Api;

public static class KatilimUclari
{
    public static void Esle(WebApplication app)
    {
        var g = app.MapGroup("/api").WithTags("Katılım");

        g.MapGet("/katil/{kod}", (string kod, CanliOturumDeposu depo) =>
            depo.KodaGoreBul(kod) is { } o
                ? Results.Ok(new KatilimOnizleme(o.Baslik, o.SinifAdi, o.OgretmenAdi))
                : Hata.Yanit("Bu kodla süren bir ders bulunamadı. Kodu öğretmeninizden kontrol edin.", StatusCodes.Status404NotFound))
            .RequireRateLimiting(HizSiniri.Katilim);

        g.MapPost("/katil", async (KatilimIstegi istek, OturumYoneticisi yonetici) =>
        {
            var ad = Metin.Ad(istek.Ad);
            if (ad.Length < 2) return Hata.Yanit("Adınızı girin.");
            var yanit = await yonetici.KatilAsync(istek.Kod ?? "", ad);
            return yanit is null
                ? Hata.Yanit("Bu kodla süren bir ders bulunamadı. Kodu öğretmeninizden kontrol edin.", StatusCodes.Status404NotFound)
                : Results.Ok(yanit);
        }).RequireRateLimiting(HizSiniri.Katilim);

        // Sayfa yenilendiğinde öğrenci istemcisi elindeki jetonla oturumunu sürdürür.
        g.MapGet("/katilimci/ben", (ClaimsPrincipal kullanici, CanliOturumDeposu depo) =>
        {
            var ozet = kullanici.FindFirstValue(Yetki.JetonOzetiTalebi);
            if (ozet is null || depo.JetonaGoreBul(ozet) is not { } b) return Results.NotFound();
            return Results.Ok(new KatilimYaniti(b.Katilimci.Id, "", b.Oturum.Id, b.Oturum.Baslik, b.Oturum.SinifAdi,
                b.Oturum.OgretmenAdi, b.Katilimci.Ad, OturumYoneticisi.OgrenciAyarlari(b.Oturum.Ayarlar)));
        }).RequireAuthorization(Yetki.Katilimci);
    }
}

public static class SistemUclari
{
    public static void Esle(WebApplication app)
    {
        app.MapGet("/saglik", () => Results.Ok(new { durum = "hazir", ad = "Sezgi", surum = Surum.Metin }))
            .WithTags("Sistem");

        app.MapGet("/api/sistem", (IServer sunucu, IOptions<SezgiAyarlari> ayarlar, IWebHostEnvironment ortam) =>
        {
            var a = ayarlar.Value;
            var adresler = string.IsNullOrWhiteSpace(a.GenelAdres)
                ? YerelAdresler(sunucu)
                : [a.GenelAdres.TrimEnd('/')];
            return new SistemBilgisi("Sezgi", Surum.Metin, adresler, Indirmeler(IndirmeKlasoru(a, ortam)));
        }).WithTags("Sistem");
    }

    public static string IndirmeKlasoru(SezgiAyarlari a, IWebHostEnvironment ortam) =>
        Path.GetFullPath(a.IndirmeKlasoru, ortam.ContentRootPath);

    private static List<IndirmeDosyasi> Indirmeler(string klasor)
    {
        if (!Directory.Exists(klasor)) return [];
        return [.. new DirectoryInfo(klasor).EnumerateFiles()
            .Where(f => !f.Name.StartsWith('.'))
            .OrderBy(f => f.Name)
            .Select(f => new IndirmeDosyasi(f.Name, f.Length, "/indirmeler/" + Uri.EscapeDataString(f.Name)))];
    }

    /// <summary>Öğrencilerin aynı ağdan bağlanabileceği adresler (ör. http://192.168.1.20:5757).</summary>
    public static List<string> YerelAdresler(IServer sunucu)
    {
        var dinlenen = sunucu.Features.Get<IServerAddressesFeature>()?.Addresses ?? [];
        var sonuc = new List<string>();
        foreach (var adres in dinlenen)
        {
            if (!Uri.TryCreate(adres.Replace("*", "0.0.0.0").Replace("+", "0.0.0.0"), UriKind.Absolute, out var uri)) continue;
            var host = uri.Host.Trim('[', ']');
            var hepsi = host is "0.0.0.0" or "::";
            if (!hepsi)
            {
                if (host is "localhost" || IPAddress.TryParse(host, out var ip) && IPAddress.IsLoopback(ip)) continue;
                sonuc.Add($"{uri.Scheme}://{uri.Authority}");
                continue;
            }
            foreach (var ip in AgArayuzleri()) sonuc.Add($"{uri.Scheme}://{ip}:{uri.Port}");
        }
        return [.. sonuc.Distinct()];
    }

    private static IEnumerable<string> AgArayuzleri()
    {
        IEnumerable<NetworkInterface> arayuzler;
        try
        {
            arayuzler = NetworkInterface.GetAllNetworkInterfaces();
        }
        catch (NetworkInformationException)
        {
            yield break;
        }

        // Ağ geçidi olan gerçek bağdaştırıcılar önce; Hyper-V, WSL, VMware gibi sanal bağdaştırıcılar sona.
        static bool SanalMi(NetworkInterface n) =>
            new[] { "virtual", "vethernet", "vmware", "hyper-v", "wsl", "virtualbox", "docker" }
                .Any(k => n.Description.Contains(k, StringComparison.OrdinalIgnoreCase) || n.Name.Contains(k, StringComparison.OrdinalIgnoreCase));

        foreach (var ni in arayuzler
                     .Where(n => n.OperationalStatus == OperationalStatus.Up
                                 && n.NetworkInterfaceType is not (NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel))
                     .OrderByDescending(n => n.GetIPProperties().GatewayAddresses.Count > 0)
                     .ThenBy(SanalMi))
        {
            foreach (var u in ni.GetIPProperties().UnicastAddresses)
            {
                if (u.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(u.Address)
                    && !u.Address.ToString().StartsWith("169.254."))
                {
                    yield return u.Address.ToString();
                }
            }
        }
    }
}
