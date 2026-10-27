using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Http.Connections.Client;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Hizmetler;
using Sezgi.Sunucu.Raporlar;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Testleri;

public class EtkilesimBirimTestleri
{
    [Fact]
    public void Yoklama_turleri_varsayilan_secenekleri_alir()
    {
        var anlama = EtkilesimYoneticisi.YoklamaHazirla(YoklamaTuru.Anlama, null, null)!.Value;
        Assert.Equal("Konu anlaşıldı mı?", anlama.Soru);
        Assert.Equal(["Anladım", "Kısmen", "Anlamadım"], anlama.Secenekler);

        Assert.Equal(5, EtkilesimYoneticisi.YoklamaHazirla(YoklamaTuru.Puan, null, null)!.Value.Secenekler.Length);
        Assert.Null(EtkilesimYoneticisi.YoklamaHazirla(YoklamaTuru.EvetHayir, "  ", null));

        var coktan = EtkilesimYoneticisi.YoklamaHazirla(YoklamaTuru.Coktan, "Hangisi?", ["  Kırılma ", "", "Yansıma", "a", "b", "c", "d", "e"])!.Value;
        Assert.Equal(["Kırılma", "Yansıma", "a", "b", "c", "d"], coktan.Secenekler);
        Assert.Null(EtkilesimYoneticisi.YoklamaHazirla(YoklamaTuru.Coktan, "Tek?", ["yalnız"]));
    }

    [Fact]
    public void Ad_anahtari_turkce_kurallarla_kucultulur()
    {
        Assert.Equal("ayşe yılmaz", IstatistikHesaplayici.AdAnahtari("  AYŞE   YILMAZ "));
        Assert.Equal("ışık irem", IstatistikHesaplayici.AdAnahtari("IŞIK İREM"));
    }

    [Fact]
    public void Sinif_anlamadi_kurali_oran_ve_bekleme_suresine_uyar()
    {
        var durum = new SinifKuralDurumu();
        Assert.Null(KuralMotoru.SinifAnlamadiDegerlendir(durum, 2, 2, 0));
        Assert.Null(KuralMotoru.SinifAnlamadiDegerlendir(durum, 10, 2, 0));
        var sonuc = KuralMotoru.SinifAnlamadiDegerlendir(durum, 10, 4, 1000);
        Assert.Equal(UyariTuru.SinifAnlamadi, sonuc!.Value.Tur);
        Assert.Null(KuralMotoru.SinifAnlamadiDegerlendir(durum, 10, 5, 60_000));
        Assert.NotNull(KuralMotoru.SinifAnlamadiDegerlendir(durum, 10, 5, 200_000));
    }

    [Fact]
    public void Rapor_bolum_yoklama_ve_sinyalleri_ozetler()
    {
        var oturum = new Oturum { Baslik = "Etkileşim", KatilimKodu = "ETK123" };
        var ali = new Katilimci { OturumId = oturum.Id, Ad = "Ali", SiraNo = 1 };
        var ece = new Katilimci { OturumId = oturum.Id, Ad = "Ece", SiraNo = 2 };
        oturum.Katilimcilar.AddRange([ali, ece]);
        var t0 = new DateTime(2026, 10, 28, 9, 0, 0, DateTimeKind.Utc);
        var ms0 = RaporEtkilesimi.Ms(t0);

        float[] Tek(Duygu d) { var x = new float[Duygular.Sayi]; x[(int)d] = 1f; return x; }
        var okumalar = new List<Okuma>();
        for (var s = 0; s < 120; s++)
        {
            // İlk dakika ikisi de mutlu; ikinci dakika Ali kaygılı.
            okumalar.Add(Okuma.Olustur(oturum.Id, ali.Id, ms0 + s * 1000, Tek(s < 60 ? Duygu.Mutlu : Duygu.Korku), 0.8f, 0.9f, true));
            okumalar.Add(Okuma.Olustur(oturum.Id, ece.Id, ms0 + s * 1000, Tek(Duygu.Mutlu), 0.6f, 0.9f, true));
        }
        var bolumler = new List<Bolum>
        {
            new() { Id = 1, OturumId = oturum.Id, Ad = "Giriş", Baslangic = t0, Bitis = t0.AddMinutes(1) },
            new() { Id = 2, OturumId = oturum.Id, Ad = "Kırılma", Baslangic = t0.AddMinutes(1), Bitis = t0.AddMinutes(2) },
        };
        var yoklama = new Yoklama { OturumId = oturum.Id, Tur = YoklamaTuru.Anlama, Soru = "Anlaşıldı mı?", Secenekler = ["Anladım", "Kısmen", "Anlamadım"], Baslangic = t0.AddSeconds(90), Bitis = t0.AddSeconds(110) };
        yoklama.Yanitlar.AddRange([new YoklamaYaniti { KatilimciId = ali.Id, Secim = 2 }, new YoklamaYaniti { KatilimciId = ece.Id, Secim = 1 }]);
        var puan = new Yoklama { OturumId = oturum.Id, Tur = YoklamaTuru.Puan, Soru = "Puan?", Secenekler = ["1", "2", "3", "4", "5"], Baslangic = t0.AddSeconds(115) };
        puan.Yanitlar.AddRange([new YoklamaYaniti { KatilimciId = ali.Id, Secim = 2 }, new YoklamaYaniti { KatilimciId = ece.Id, Secim = 4 }]);
        var sinyaller = new List<Sinyal>
        {
            new() { Id = 1, OturumId = oturum.Id, KatilimciId = ali.Id, Tur = SinyalTuru.Anlamadim, Zaman = t0.AddSeconds(75) },
            new() { Id = 2, OturumId = oturum.Id, KatilimciId = ali.Id, Tur = SinyalTuru.Soru, Metin = "Neden?", Zaman = t0.AddSeconds(80), KapanmaZamani = t0.AddSeconds(95) },
        };
        var adlar = new Dictionary<Guid, string> { [ali.Id] = "Ali", [ece.Id] = "Ece" };

        var rapor = RaporOlusturucu.Hesapla(oturum, okumalar, [], adlar, 10, bolumler, [yoklama, puan], sinyaller);
        var e = rapor.Etkilesim;

        Assert.Equal(2, e.Bolumler.Count);
        Assert.Equal(0f, e.Bolumler[0].OlumsuzOran);
        Assert.Equal(0.5f, e.Bolumler[1].OlumsuzOran, 2);
        Assert.Equal(1, e.Bolumler[1].Anlamadim);
        Assert.Equal(1, e.Bolumler[1].Soru);

        var anlama = e.Yoklamalar[0];
        Assert.Equal([0, 1, 1], anlama.Sayilar);
        Assert.Equal(0.25f, anlama.AnlamaOrani!.Value, 3);
        Assert.Equal(4f, e.Yoklamalar[1].Ortalama!.Value, 3);
        Assert.Equal(0.25f, e.AnlamaOrani!.Value, 3);

        Assert.True(e.Sinyaller.Single(s => s.Tur == SinyalTuru.Soru).Yanitlandi);
        Assert.Equal(1, rapor.Katilimcilar.Single(k => k.Id == ali.Id).AnlamadimSayisi);

        var (ist, katilimcilar) = IstatistikHesaplayici.Donustur(rapor);
        Assert.Equal(0.25f, ist.AnlamaOrani!.Value, 3);
        Assert.Equal(2, ist.YoklamaSayisi);
        Assert.Equal(["ali", "ece"], katilimcilar.Select(k => k.AdAnahtari).Order());

        var excel = ExcelDisaAktarici.Olustur(rapor, okumalar, adlar);
        Assert.True(excel.Length > 1000);
    }
}

/// <summary>Yoklama, sinyal, bölüm, mola, veri silme, analitik ve yedekleme akışlarını gerçek sunucuda dener.</summary>
public class EtkilesimUctanUcaTestleri : IClassFixture<SezgiFabrikasi>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly SezgiFabrikasi _fabrika;

    public EtkilesimUctanUcaTestleri(SezgiFabrikasi fabrika) => _fabrika = fabrika;

    /// <summary>Çerezi elle taşıyan istemci; aynı çerez SignalR bağlantısında da kullanılır.</summary>
    private async Task<(HttpClient Http, string Cerez)> OgretmenAsync()
    {
        var http = _fabrika.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var durum = await http.GetFromJsonAsync<HesapDurumu>("/api/hesap/durum", Json);
        var yanit = durum!.KurulumGerekli
            ? await http.PostAsJsonAsync("/api/hesap/kurulum", new KurulumIstegi("yonetici", "Yönetici Öğretmen", "parola123"), Json)
            : await http.PostAsJsonAsync("/api/hesap/giris", new GirisIstegi("yonetici", "parola123"), Json);
        yanit.EnsureSuccessStatusCode();
        var cerez = yanit.Headers.GetValues("Set-Cookie").First().Split(';')[0];
        http.DefaultRequestHeaders.Add("Cookie", cerez);
        return (http, cerez);
    }

    private HubConnection Hub(string yol, Action<HttpConnectionOptions> ayar) =>
        new HubConnectionBuilder()
            .WithUrl(new Uri(_fabrika.Server.BaseAddress, yol), o =>
            {
                o.Transports = HttpTransportType.LongPolling;
                o.HttpMessageHandlerFactory = _ => _fabrika.Server.CreateHandler();
                ayar(o);
            })
            .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)))
            .Build();

    private static async Task<T> Bekle<T>(Func<T?> deger, int saniye = 10) where T : class
    {
        for (var i = 0; i < saniye * 10; i++)
        {
            if (deger() is { } d) return d;
            await Task.Delay(100);
        }
        throw new TimeoutException("Beklenen olay gelmedi.");
    }

    private async Task<(OturumDetayi Oturum, KatilimYaniti Ogrenci)> DersVeOgrenciAsync(HttpClient ogretmen, string ad)
    {
        var oturum = (await (await ogretmen.PostAsJsonAsync("/api/oturumlar", new OturumOlusturmaIstegi("Etkileşim dersi", "9-B", null), Json))
            .Content.ReadFromJsonAsync<OturumDetayi>(Json))!;
        var katilim = await _fabrika.CreateClient().PostAsJsonAsync("/api/katil", new KatilimIstegi(oturum.KatilimKodu, ad), Json);
        katilim.EnsureSuccessStatusCode();
        return (oturum, (await katilim.Content.ReadFromJsonAsync<KatilimYaniti>(Json))!);
    }

    [Fact]
    public async Task Yoklama_sinyal_bolum_ve_mola_uctan_uca_calisir()
    {
        var (ogretmenHttp, cerez) = await OgretmenAsync();
        var (oturum, kimlik) = await DersVeOgrenciAsync(ogretmenHttp, "Zeynep Ak");

        AnlikGoruntu? sonAnlik = null;
        var ogretmen = Hub("/hub/ogretmen", o => o.Headers["Cookie"] = cerez);
        ogretmen.On<AnlikGoruntu>("Anlik", a => sonAnlik = a);
        await ogretmen.StartAsync();
        await ogretmen.InvokeAsync<IzlemeBaslangici>("Izle", oturum.Id);

        YoklamaBildirimi? gelenYoklama = null;
        MolaBildirimi? gelenMola = null;
        var molaBitti = false;
        SinyalTuru? kapananSinyal = null;
        OgrenciDurumu? ilkDurum = null;
        var ogrenci = Hub("/hub/ogrenci", o => o.AccessTokenProvider = () => Task.FromResult<string?>(kimlik.Jeton));
        ogrenci.On<OgrenciDurumu>("Durum", d => ilkDurum = d);
        ogrenci.On<YoklamaBildirimi>("Yoklama", y => gelenYoklama = y);
        ogrenci.On<MolaBildirimi?>("Mola", m =>
        {
            if (m is null) molaBitti = true;
            else gelenMola = m;
        });
        ogrenci.On<SinyalTuru>("SinyalKapandi", t => kapananSinyal = t);
        await ogrenci.StartAsync();
        await Bekle(() => ilkDurum);

        // Bölüm ve yoklama
        await ogretmen.InvokeAsync<BolumDurumu>("BolumBaslat", oturum.Id, "Giriş");
        var durum = await ogretmen.InvokeAsync<YoklamaDurumu>("YoklamaBaslat", oturum.Id, new YoklamaIstegi(YoklamaTuru.Anlama, null, null));
        Assert.Equal("Konu anlaşıldı mı?", durum.Soru);
        var yoklama = await Bekle(() => gelenYoklama);
        Assert.True(await ogrenci.InvokeAsync<bool>("YoklamaYanitla", yoklama.Id, 0));
        Assert.False(await ogrenci.InvokeAsync<bool>("YoklamaYanitla", yoklama.Id, 7));
        await Bekle(() => sonAnlik?.Etkilesim.Yoklama is { Yanitlayan: 1 } y ? y : null);
        await ogretmen.InvokeAsync("YoklamaKapat", oturum.Id);

        // Söz isteği ve yanıt
        Assert.True(await ogrenci.InvokeAsync<bool>("Sinyal", SinyalTuru.Soru, "Formülü tekrar yazar mısınız?"));
        var soru = await Bekle(() => sonAnlik?.Etkilesim.Sorular.FirstOrDefault());
        Assert.Equal("Zeynep Ak", soru.Ad);
        Assert.Equal(SinyalTuru.Soru, sonAnlik!.Katilimcilar.Single().Sinyal);
        await ogretmen.InvokeAsync("SinyalYanitla", oturum.Id, soru.Id);
        await Bekle(() => kapananSinyal is { } t ? (object)t : null);

        // "Anlamadım" hız sınırına takılır, süre ilerleyince kabul edilir.
        Assert.False(await ogrenci.InvokeAsync<bool>("Sinyal", SinyalTuru.Anlamadim, null));
        _fabrika.Saat.Advance(TimeSpan.FromSeconds(4));
        Assert.True(await ogrenci.InvokeAsync<bool>("Sinyal", SinyalTuru.Anlamadim, null));
        await Bekle(() => sonAnlik?.Etkilesim.Anlamadim == 1 ? sonAnlik : null);

        // Mola: ölçümler işlenmez, bitince bölüm kaldığı yerden sürer.
        var mola = await ogretmen.InvokeAsync<BolumDurumu>("MolaBaslat", oturum.Id, 5);
        Assert.True(mola.Mola);
        Assert.True((await Bekle(() => gelenMola)).BitisMs > 0);
        await ogrenci.InvokeAsync("Okuma", new OkumaGirdisi([0.9f, 0.1f, 0, 0, 0, 0, 0], 0.9f, 0.9f, true));
        await ogretmen.InvokeAsync("MolaBitir", oturum.Id);
        await Bekle(() => molaBitti ? (object)true : null);
        await Bekle(() => sonAnlik?.Etkilesim.Bolum is { Ad: "Giriş", Mola: false } b ? b : null);

        await ogrenci.DisposeAsync();
        await ogretmen.DisposeAsync();
        (await ogretmenHttp.PostAsync($"/api/oturumlar/{oturum.Id}/bitir", null)).EnsureSuccessStatusCode();

        var rapor = await ogretmenHttp.GetFromJsonAsync<JsonElement>($"/api/oturumlar/{oturum.Id}/rapor");
        var etkilesim = rapor.GetProperty("etkilesim");
        Assert.Equal(0, rapor.GetProperty("sinif").GetProperty("okumaSayisi").GetInt32());
        Assert.Equal(["Giriş", "Mola", "Giriş"], etkilesim.GetProperty("bolumler").EnumerateArray().Select(b => b.GetProperty("ad").GetString()));
        var raporYoklama = etkilesim.GetProperty("yoklamalar").EnumerateArray().Single();
        Assert.Equal([1, 0, 0], raporYoklama.GetProperty("sayilar").EnumerateArray().Select(x => x.GetInt32()));
        Assert.Equal(1f, raporYoklama.GetProperty("anlamaOrani").GetSingle());
        Assert.Equal(1, etkilesim.GetProperty("soru").GetInt32());
        Assert.Equal(1, etkilesim.GetProperty("anlamadim").GetInt32());

        var analitik = await ogretmenHttp.GetFromJsonAsync<JsonElement>("/api/analitik?sinif=9-B");
        Assert.Contains(analitik.GetProperty("siniflar").EnumerateArray(), s => s.GetProperty("ad").GetString() == "9-B");
    }

    [Fact]
    public async Task Ogrenci_ayrilirken_verilerini_silebilir()
    {
        var (ogretmenHttp, _) = await OgretmenAsync();
        var (oturum, kimlik) = await DersVeOgrenciAsync(ogretmenHttp, "Silinecek Öğrenci");
        var ogrenci = Hub("/hub/ogrenci", o => o.AccessTokenProvider = () => Task.FromResult<string?>(kimlik.Jeton));
        await ogrenci.StartAsync();
        for (var i = 0; i < 3; i++)
        {
            await ogrenci.InvokeAsync("Okuma", new OkumaGirdisi([0.9f, 0.1f, 0, 0, 0, 0, 0], 0.9f, 0.9f, true));
            _fabrika.Saat.Advance(TimeSpan.FromSeconds(1));
        }
        await Task.Delay(1500);
        await ogrenci.InvokeAsync("Ayril", true);
        await ogrenci.DisposeAsync();
        await Task.Delay(3500);

        var rapor = await ogretmenHttp.GetFromJsonAsync<JsonElement>($"/api/oturumlar/{oturum.Id}/rapor");
        Assert.Equal(0, rapor.GetProperty("sinif").GetProperty("okumaSayisi").GetInt32());
        Assert.Equal(HttpStatusCode.Unauthorized, (await _fabrika.CreateClient().SendAsync(new HttpRequestMessage(HttpMethod.Get, "/api/katilimci/ben")
        {
            Headers = { { "Authorization", "Bearer " + kimlik.Jeton } },
        })).StatusCode);
    }

    [Fact]
    public async Task Yonetici_durumu_gorur_ve_yedek_indirir()
    {
        var (ogretmenHttp, _) = await OgretmenAsync();
        var durum = await ogretmenHttp.GetFromJsonAsync<SunucuDurumu>("/api/yonetim/durum", Json);
        Assert.True(durum!.OgretmenSayisi >= 1);

        var yedek = await ogretmenHttp.GetAsync("/api/yonetim/yedek");
        Assert.Equal(HttpStatusCode.OK, yedek.StatusCode);
        var baslik = (await yedek.Content.ReadAsByteArrayAsync())[..15];
        Assert.Equal("SQLite format 3", System.Text.Encoding.ASCII.GetString(baslik));
    }
}
