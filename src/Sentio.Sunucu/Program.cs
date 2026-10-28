using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting.WindowsServices;
using Sentio.Sunucu;
using Sentio.Sunucu.Api;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Guvenlik;
using Sentio.Sunucu.Hizmetler;
using Sentio.Sunucu.Hublar;
using Sentio.Sunucu.Raporlar;
using Sentio.Sunucu.Veri;

// Yayımlanmış paket hangi klasörden başlatılırsa başlatılsın wwwroot ve veri klasörü exe'nin yanında aranır.
var icerikKoku = Directory.Exists(Path.Combine(AppContext.BaseDirectory, "wwwroot")) ? AppContext.BaseDirectory : null;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = icerikKoku });

builder.Host.UseWindowsService(o => o.ServiceName = "Sentio");
builder.Host.UseSystemd();

EskiAdUyumu.AyarlariTasi(builder.Configuration);
var sentio = builder.Configuration.GetSection(SentioAyarlari.Bolum).Get<SentioAyarlari>() ?? new SentioAyarlari();
builder.Services.Configure<SentioAyarlari>(builder.Configuration.GetSection(SentioAyarlari.Bolum));

var veriKlasoru = Path.GetFullPath(sentio.VeriKlasoru, builder.Environment.ContentRootPath);
Directory.CreateDirectory(veriKlasoru);
var baglanti = builder.Configuration.GetConnectionString("Sentio");
if (baglanti is null)
{
    EskiAdUyumu.VeritabaniniTasi(veriKlasoru);
    baglanti = $"Data Source={Path.Combine(veriKlasoru, "sentio.db")}";
}

builder.Services.AddDbContextFactory<SentioVeritabani>(o => o.UseSqlite(baglanti));
builder.Services.AddScoped(sp => sp.GetRequiredService<IDbContextFactory<SentioVeritabani>>().CreateDbContext());

var anahtarlar = builder.Services.AddDataProtection()
    .SetApplicationName("Sentio")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(veriKlasoru, "anahtarlar")));
if (OperatingSystem.IsWindows()) anahtarlar.ProtectKeysWithDpapi(protectToLocalMachine: true);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<CanliOturumDeposu>();
builder.Services.AddSingleton<OkumaYazici>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<OkumaYazici>());
builder.Services.AddSingleton<OlcumIsleyici>();
builder.Services.AddSingleton<SimulasyonYoneticisi>();
builder.Services.AddSingleton<EtkilesimYoneticisi>();
builder.Services.AddSingleton<OturumYoneticisi>();
builder.Services.AddHostedService<CanliYayinci>();
builder.Services.AddHostedService<VeriTemizleyici>();
builder.Services.AddHostedService<AgDuyurucu>();
builder.Services.AddScoped<RaporOlusturucu>();
builder.Services.AddScoped<IstatistikHesaplayici>();

builder.Services.AddAuthentication(Yetki.CerezSemasi)
    .AddCookie(Yetki.CerezSemasi, o =>
    {
        o.Cookie.Name = "sentio_oturum";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        o.ExpireTimeSpan = TimeSpan.FromHours(12);
        o.SlidingExpiration = true;
        o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
        o.Events.OnValidatePrincipal = async c =>
        {
            // Silinen öğretmenin çerezi bir sonraki istekte geçersiz olur.
            var db = c.HttpContext.RequestServices.GetRequiredService<SentioVeritabani>();
            if (c.Principal is null || !await db.Ogretmenler.AnyAsync(o => o.Id == c.Principal.OgretmenId()))
            {
                c.RejectPrincipal();
                await c.HttpContext.SignOutAsync(Yetki.CerezSemasi);
            }
        };
    })
    .AddScheme<AuthenticationSchemeOptions, KatilimciKimlikDogrulama>(Yetki.KatilimciSemasi, null);

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Yetki.Ogretmen, p => p.AddAuthenticationSchemes(Yetki.CerezSemasi).RequireAuthenticatedUser())
    .AddPolicy(Yetki.Yonetici, p => p.AddAuthenticationSchemes(Yetki.CerezSemasi).RequireRole(Yetki.YoneticiRolu))
    .AddPolicy(Yetki.Katilimci, p => p.AddAuthenticationSchemes(Yetki.KatilimciSemasi).RequireAuthenticatedUser());

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(HizSiniri.Giris, h => RateLimitPartition.GetFixedWindowLimiter(
        h.Connection.RemoteIpAddress?.ToString() ?? "?",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    // Okullarda bütün sınıf tek bir NAT adresinden gelebilir; sınır kaba kuvvet denemesini durduracak kadar düşük tutulur.
    o.AddPolicy(HizSiniri.Katilim, h => RateLimitPartition.GetFixedWindowLimiter(
        h.Connection.RemoteIpAddress?.ToString() ?? "?",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 150, Window = TimeSpan.FromMinutes(1) }));
});

var enumDonusturucu = new JsonStringEnumConverter(JsonNamingPolicy.CamelCase);
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(enumDonusturucu));
builder.Services.AddSignalR(o =>
    {
        o.MaximumReceiveMessageSize = 256 * 1024;
        o.EnableDetailedErrors = builder.Environment.IsDevelopment();
    })
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(enumDonusturucu));
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

var app = builder.Build();

await using (var kapsam = app.Services.CreateAsyncScope())
{
    var db = kapsam.ServiceProvider.GetRequiredService<SentioVeritabani>();
    await db.Database.MigrateAsync();
    await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
    await app.Services.GetRequiredService<CanliOturumDeposu>().YukleAsync(db, CancellationToken.None);
}

app.UseExceptionHandler();
app.Use(async (http, sonraki) =>
{
    var b = http.Response.Headers;
    b.XContentTypeOptions = "nosniff";
    b.XFrameOptions = "DENY";
    b["Referrer-Policy"] = "strict-origin-when-cross-origin";
    b["Permissions-Policy"] = "camera=(self), display-capture=(self), microphone=(), geolocation=()";
    await sonraki();
});

var turler = new FileExtensionContentTypeProvider();
turler.Mappings[".bin"] = "application/octet-stream";
turler.Mappings[".wasm"] = "application/wasm";
turler.Mappings[".webmanifest"] = "application/manifest+json";
var statik = new StaticFileOptions
{
    ContentTypeProvider = turler,
    OnPrepareResponse = c =>
    {
        var yol = c.Context.Request.Path.Value ?? "";
        c.Context.Response.Headers.CacheControl =
            yol.StartsWith("/assets/") ? "public, max-age=31536000, immutable"
            : yol.StartsWith("/modeller/") ? "public, max-age=604800"
            : "no-cache";
    },
};
app.UseDefaultFiles();
app.UseStaticFiles(statik);

var indirmeKlasoru = SistemUclari.IndirmeKlasoru(sentio, app.Environment);
Directory.CreateDirectory(indirmeKlasoru);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(indirmeKlasoru),
    RequestPath = "/indirmeler",
    ServeUnknownFileTypes = true,
    DefaultContentType = "application/octet-stream",
});

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi("/openapi/{documentName}.json");
HesapUclari.Esle(app);
OturumUclari.Esle(app);
KatilimUclari.Esle(app);
SistemUclari.Esle(app);
AnalitikUclari.Esle(app);
app.MapHub<OgretmenHub>("/hub/ogretmen");
app.MapHub<OgrenciHub>("/hub/ogrenci");
app.MapFallback("/api/{**yol}", () => Results.NotFound());
app.MapFallbackToFile("index.html", statik);

app.Lifetime.ApplicationStarted.Register(() =>
{
    var adresler = SistemUclari.YerelAdresler(app.Services.GetRequiredService<IServer>());
    app.Logger.LogInformation("Sentio {Surum} hazır. Öğretmen paneli: /panel  Öğrenci katılımı: /katil", Surum.Metin);
    foreach (var a in adresler) app.Logger.LogInformation("Yerel ağ adresi: {Adres}", a);

    if (sentio.AcilistaTarayiciAc && OperatingSystem.IsWindows() && Environment.UserInteractive && !WindowsServiceHelpers.IsWindowsService())
    {
        var port = app.Urls.Select(u => new Uri(u.Replace("*", "localhost").Replace("+", "localhost"))).FirstOrDefault()?.Port ?? 5757;
        try
        {
            Process.Start(new ProcessStartInfo($"http://localhost:{port}/panel") { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            app.Logger.LogDebug(ex, "Tarayıcı açılamadı.");
        }
    }
});

app.Run();

public partial class Program;
