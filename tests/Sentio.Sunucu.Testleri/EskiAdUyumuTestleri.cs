using Microsoft.Extensions.Configuration;

namespace Sentio.Sunucu.Testleri;

/// <summary>Sezgi 1.x kurulumlarından yükseltme: eski ayar adları ve veritabanı dosyası.</summary>
public sealed class EskiAdUyumuTestleri : IDisposable
{
    private readonly string _klasor = Directory.CreateTempSubdirectory("sentio-uyum-").FullName;

    public void Dispose() => Directory.Delete(_klasor, recursive: true);

    [Fact]
    public void Eski_ayarlar_dosyadaki_varsayilani_ezer_yeni_ortam_degiskeni_yine_onceliklidir()
    {
        var dosya = Path.Combine(_klasor, "appsettings.json");
        File.WriteAllText(dosya, """
            {
              "Sentio": { "VeriKlasoru": "veri", "VeriSaklamaGun": 180 },
              "Sezgi": { "VeriKlasoru": "eski-veri", "VeriSaklamaGun": 90 },
              "ConnectionStrings": { "Sezgi": "Data Source=eski.db" }
            }
            """);
        var ayarlar = new ConfigurationManager();
        ayarlar.AddJsonFile(dosya);
        // Ayar dosyalarından sonra gelen kaynak (ortam değişkenleri yerine).
        ayarlar.AddInMemoryCollection([KeyValuePair.Create<string, string?>("Sentio:VeriSaklamaGun", "30")]);

        EskiAdUyumu.AyarlariTasi(ayarlar);

        Assert.Equal("eski-veri", ayarlar["Sentio:VeriKlasoru"]);
        Assert.Equal("30", ayarlar["Sentio:VeriSaklamaGun"]);
        Assert.Equal("Data Source=eski.db", ayarlar.GetConnectionString("Sentio"));
    }

    [Fact]
    public void Eski_ayar_yoksa_hicbir_sey_eklenmez()
    {
        var ayarlar = new ConfigurationManager();
        ayarlar.AddInMemoryCollection([KeyValuePair.Create<string, string?>("Sentio:VeriKlasoru", "veri")]);
        var once = ((IConfigurationBuilder)ayarlar).Sources.Count;

        EskiAdUyumu.AyarlariTasi(ayarlar);

        Assert.Equal(once, ((IConfigurationBuilder)ayarlar).Sources.Count);
    }

    [Fact]
    public void Eski_veritabani_WAL_dosyalariyla_tasinir()
    {
        File.WriteAllText(Path.Combine(_klasor, "sezgi.db"), "db");
        File.WriteAllText(Path.Combine(_klasor, "sezgi.db-wal"), "wal");

        EskiAdUyumu.VeritabaniniTasi(_klasor);

        Assert.Equal("db", File.ReadAllText(Path.Combine(_klasor, "sentio.db")));
        Assert.Equal("wal", File.ReadAllText(Path.Combine(_klasor, "sentio.db-wal")));
        Assert.False(File.Exists(Path.Combine(_klasor, "sezgi.db")));
        Assert.False(File.Exists(Path.Combine(_klasor, "sezgi.db-wal")));
    }

    [Fact]
    public void Yeni_veritabani_varsa_eskisine_dokunulmaz()
    {
        File.WriteAllText(Path.Combine(_klasor, "sezgi.db"), "eski");
        File.WriteAllText(Path.Combine(_klasor, "sentio.db"), "yeni");

        EskiAdUyumu.VeritabaniniTasi(_klasor);

        Assert.Equal("yeni", File.ReadAllText(Path.Combine(_klasor, "sentio.db")));
        Assert.Equal("eski", File.ReadAllText(Path.Combine(_klasor, "sezgi.db")));
    }
}
