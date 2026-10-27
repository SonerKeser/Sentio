using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Testleri;

public sealed class SezgiFabrikasi : WebApplicationFactory<Program>
{
    private readonly string _klasor = Path.Combine(Path.GetTempPath(), "sezgi-test-" + Guid.NewGuid().ToString("N"));

    public FakeTimeProvider Saat { get; } = new(DateTimeOffset.UtcNow);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Sezgi:VeriKlasoru", _klasor);
        builder.UseSetting("Sezgi:IndirmeKlasoru", Path.Combine(_klasor, "indirmeler"));
        builder.UseSetting("Sezgi:AcilistaTarayiciAc", "false");
        builder.UseSetting("Sezgi:AgDuyurusu", "false");
        builder.ConfigureServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(Saat);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try
        {
            Directory.Delete(_klasor, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}

/// <summary>Kurulumdan rapora kadar gerçek sunucu hattını uçtan uca dener.</summary>
public class UctanUcaTestler : IClassFixture<SezgiFabrikasi>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly SezgiFabrikasi _fabrika;

    public UctanUcaTestler(SezgiFabrikasi fabrika) => _fabrika = fabrika;

    private HttpClient Istemci() => _fabrika.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });

    private static async Task<HttpClient> OgretmenAsync(HttpClient istemci)
    {
        var durum = await istemci.GetFromJsonAsync<HesapDurumu>("/api/hesap/durum", Json);
        var yanit = durum!.KurulumGerekli
            ? await istemci.PostAsJsonAsync("/api/hesap/kurulum", new KurulumIstegi("ogretmen", "Deneme Öğretmen", "parola123"), Json)
            : await istemci.PostAsJsonAsync("/api/hesap/giris", new GirisIstegi("ogretmen", "parola123"), Json);
        yanit.EnsureSuccessStatusCode();
        return istemci;
    }

    [Fact]
    public async Task Yetkisiz_istekler_reddedilir()
    {
        var istemci = Istemci();
        Assert.Equal(HttpStatusCode.Unauthorized, (await istemci.GetAsync("/api/oturumlar")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await istemci.GetAsync("/api/katil/YOKBOY")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await istemci.GetAsync("/api/katilimci/ben")).StatusCode);

        var saglik = await istemci.GetFromJsonAsync<JsonElement>("/saglik");
        Assert.Equal("hazir", saglik.GetProperty("durum").GetString());
    }

    [Fact]
    public async Task Ogrenci_katilir_olcum_gonderir_uyari_ve_rapor_olusur()
    {
        var ogretmen = await OgretmenAsync(Istemci());
        var ayarlar = new OturumAyarlari { KalicilikSn = 5, BeklemeSn = 60 };
        var olustur = await ogretmen.PostAsJsonAsync("/api/oturumlar", new OturumOlusturmaIstegi("Fizik: Optik", "11-A", ayarlar), Json);
        olustur.EnsureSuccessStatusCode();
        var oturum = (await olustur.Content.ReadFromJsonAsync<OturumDetayi>(Json))!;
        Assert.Equal(6, oturum.KatilimKodu.Length);

        var ogrenciHttp = Istemci();
        var onizleme = await ogrenciHttp.GetFromJsonAsync<KatilimOnizleme>($"/api/katil/{oturum.KatilimKodu.ToLowerInvariant()}", Json);
        Assert.Equal("Fizik: Optik", onizleme!.Baslik);

        var katilim = await ogrenciHttp.PostAsJsonAsync("/api/katil", new KatilimIstegi(oturum.KatilimKodu, "  Ece   Kurt "), Json);
        katilim.EnsureSuccessStatusCode();
        var kimlik = (await katilim.Content.ReadFromJsonAsync<KatilimYaniti>(Json))!;
        Assert.Equal("Ece Kurt", kimlik.Ad);

        var durtmeler = new List<DurtmeBildirimi>();
        var baglanti = new HubConnectionBuilder()
            .WithUrl(new Uri(_fabrika.Server.BaseAddress, "/hub/ogrenci"), o =>
            {
                o.Transports = HttpTransportType.LongPolling;
                o.HttpMessageHandlerFactory = _ => _fabrika.Server.CreateHandler();
                o.AccessTokenProvider = () => Task.FromResult<string?>(kimlik.Jeton);
            })
            .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)))
            .Build();
        baglanti.On<DurtmeBildirimi>("Durtme", d => { lock (durtmeler) durtmeler.Add(d); });
        await baglanti.StartAsync();

        var uzgun = new float[Duygular.Sayi];
        uzgun[(int)Duygu.Uzgun] = 0.9f;
        uzgun[(int)Duygu.Notr] = 0.1f;
        for (var i = 0; i < 8; i++)
        {
            await baglanti.InvokeAsync("Okuma", new OkumaGirdisi(uzgun, 0.85f, 0.9f, true));
            _fabrika.Saat.Advance(TimeSpan.FromSeconds(1));
        }

        for (var bekle = 0; bekle < 50 && durtmeler.Count == 0; bekle++) await Task.Delay(100);
        var durtme = Assert.Single(durtmeler);
        Assert.Equal("olumsuzIfade", durtme.Tur);
        Assert.Equal(Duygu.Uzgun, durtme.Duygu);

        // Ölçümler arka planda toplu yazılır; rapordan önce kuyruğun boşalmasını bekle.
        JsonElement rapor = default;
        for (var bekle = 0; bekle < 30; bekle++)
        {
            rapor = await ogretmen.GetFromJsonAsync<JsonElement>($"/api/oturumlar/{oturum.Id}/rapor");
            if (rapor.GetProperty("sinif").GetProperty("okumaSayisi").GetInt32() >= 8) break;
            await Task.Delay(200);
        }
        Assert.Equal(8, rapor.GetProperty("sinif").GetProperty("okumaSayisi").GetInt32());
        Assert.Equal("uzgun", rapor.GetProperty("sinif").GetProperty("baskin").GetString());
        var uyari = Assert.Single(rapor.GetProperty("uyarilar").EnumerateArray());
        Assert.Contains("Ece Kurt", uyari.GetProperty("mesaj").GetString());

        var excel = await ogretmen.GetAsync($"/api/oturumlar/{oturum.Id}/rapor.xlsx");
        Assert.Equal(HttpStatusCode.OK, excel.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excel.Content.Headers.ContentType?.MediaType);

        var oturumBitti = new TaskCompletionSource();
        baglanti.On("OturumBitti", () => oturumBitti.TrySetResult());
        (await ogretmen.PostAsync($"/api/oturumlar/{oturum.Id}/bitir", null)).EnsureSuccessStatusCode();
        await oturumBitti.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await baglanti.DisposeAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await ogrenciHttp.GetAsync($"/api/katil/{oturum.KatilimKodu}")).StatusCode);
        var liste = await ogretmen.GetFromJsonAsync<List<OturumOzeti>>("/api/oturumlar", Json);
        Assert.Contains(liste!, o => o.Id == oturum.Id && o.Durum == OturumDurumu.Bitti && o.UyariSayisi == 1);
    }

    [Fact]
    public async Task Baska_ogretmenin_oturumuna_erisilemez()
    {
        var yonetici = await OgretmenAsync(Istemci());
        (await yonetici.PostAsJsonAsync("/api/ogretmenler", new OgretmenEklemeIstegi("ikinci", "İkinci Öğretmen", "parola456", false), Json))
            .EnsureSuccessStatusCode();
        var oturum = (await (await yonetici.PostAsJsonAsync("/api/oturumlar", new OturumOlusturmaIstegi("Gizli ders", null, null), Json))
            .Content.ReadFromJsonAsync<OturumDetayi>(Json))!;

        var ikinci = Istemci();
        (await ikinci.PostAsJsonAsync("/api/hesap/giris", new GirisIstegi("ikinci", "parola456"), Json)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await ikinci.GetAsync($"/api/oturumlar/{oturum.Id}/rapor")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ikinci.GetAsync("/api/ogretmenler")).StatusCode);
    }
}
