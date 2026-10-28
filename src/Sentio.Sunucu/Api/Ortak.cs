using System.Reflection;

namespace Sentio.Sunucu.Api;

public static class Hata
{
    /// <summary>İstemcinin <c>detail</c> alanını kullanıcıya gösterdiği RFC 7807 yanıtı.</summary>
    public static IResult Yanit(string mesaj, int kod = StatusCodes.Status400BadRequest) =>
        Results.Problem(detail: mesaj, statusCode: kod);
}

public static class HizSiniri
{
    public const string Giris = "giris";
    public const string Katilim = "katilim";
}

public static class Surum
{
    public static readonly string Metin =
        typeof(Surum).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0]
        ?? typeof(Surum).Assembly.GetName().Version?.ToString(3)
        ?? "1.0.0";
}
