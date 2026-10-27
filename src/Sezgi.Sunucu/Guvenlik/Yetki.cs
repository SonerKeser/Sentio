using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Sezgi.Sunucu.Canli;

namespace Sezgi.Sunucu.Guvenlik;

public static class Yetki
{
    public const string CerezSemasi = "SezgiCerez";
    public const string KatilimciSemasi = "SezgiKatilimci";

    public const string Ogretmen = "Ogretmen";
    public const string Yonetici = "Yonetici";
    public const string Katilimci = "Katilimci";

    public const string YoneticiRolu = "yonetici";
    public const string AdTalebi = "ad";
    public const string JetonOzetiTalebi = "jeton";

    public static Guid OgretmenId(this ClaimsPrincipal kullanici) =>
        Guid.Parse(kullanici.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static bool YoneticiMi(this ClaimsPrincipal kullanici) => kullanici.IsInRole(YoneticiRolu);

    /// <summary>URL'de taşınabilir, 256 bit rastgele katılım jetonu.</summary>
    public static string JetonUret() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string JetonOzeti(string jeton) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(jeton)));

    private static string Base64UrlEncode(byte[] veri) =>
        Convert.ToBase64String(veri).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

/// <summary>
/// Öğrenci istemcisini katılım jetonuyla doğrular. Jeton "Authorization: Bearer" başlığında ya da
/// WebSocket bağlantılarında tarayıcı başlık gönderemediği için <c>access_token</c> sorgu parametresinde gelir.
/// </summary>
public sealed class KatilimciKimlikDogrulama(
    IOptionsMonitor<AuthenticationSchemeOptions> secenekler,
    ILoggerFactory gunluk,
    UrlEncoder kodlayici,
    CanliOturumDeposu depo) : AuthenticationHandler<AuthenticationSchemeOptions>(secenekler, gunluk, kodlayici)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? jeton = null;
        var baslik = Request.Headers.Authorization.ToString();
        if (baslik.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) jeton = baslik[7..].Trim();
        else if (Request.Path.StartsWithSegments("/hub")) jeton = Request.Query["access_token"];

        if (string.IsNullOrEmpty(jeton)) return Task.FromResult(AuthenticateResult.NoResult());

        var ozet = Yetki.JetonOzeti(jeton);
        if (depo.JetonaGoreBul(ozet) is not { } bulunan)
        {
            return Task.FromResult(AuthenticateResult.Fail("Katılım jetonu geçersiz ya da oturum sona ermiş."));
        }

        var kimlik = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, bulunan.Katilimci.Id.ToString()),
            new Claim("oturum", bulunan.Oturum.Id.ToString()),
            new Claim(Yetki.JetonOzetiTalebi, ozet),
        ], Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(kimlik), Scheme.Name)));
    }
}
