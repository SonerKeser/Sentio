namespace Sentio.Sunucu;

public sealed class SentioAyarlari
{
    public const string Bolum = "Sentio";

    /// <summary>SQLite veritabanının bulunduğu klasör. Göreli yol uygulama klasörüne göre çözülür.</summary>
    public string VeriKlasoru { get; set; } = "veri";

    /// <summary>Biten oturumların saklanacağı gün sayısı. 0 ya da eksi değer otomatik silmeyi kapatır.</summary>
    public int VeriSaklamaGun { get; set; } = 180;

    /// <summary>Öğrencilere gösterilecek adres (ör. https://sentio.okul.edu.tr). Boşsa yerel ağ adresleri listelenir.</summary>
    public string? GenelAdres { get; set; }

    /// <summary>Çevrimdışı kurulumlar için istemci kurulum dosyalarının konduğu klasör.</summary>
    public string IndirmeKlasoru { get; set; } = "indirmeler";

    /// <summary>Sunucuyu yerel ağa UDP 5758 üzerinden duyurur; masaüstü uygulaması bulunan sunucuları listeler.</summary>
    public bool AgDuyurusu { get; set; } = true;

    /// <summary>Windows'ta konsoldan çalıştırıldığında paneli varsayılan tarayıcıda açar.</summary>
    public bool AcilistaTarayiciAc { get; set; }
}
