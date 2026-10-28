using Microsoft.Extensions.Configuration.Memory;

namespace Sentio.Sunucu;

/// <summary>
/// Sentio, 1.2 sürümüne kadar "Sezgi" adını taşıyordu. Eski kurulumların ayarları, ortam değişkenleri
/// (<c>Sezgi__...</c>) ve veritabanı dosyası yükseltmeden sonra da kullanılmaya devam eder.
/// </summary>
public static class EskiAdUyumu
{
    public const string EskiAd = "Sezgi";
    private const string VeritabaniDosyasi = "sentio.db";
    private const string EskiVeritabaniDosyasi = "sezgi.db";

    /// <summary>
    /// "Sezgi:*" ayarlarını ve "ConnectionStrings:Sezgi" değerini yeni adlarıyla yeniden yayımlar. Ayar dosyalarındaki
    /// varsayılanları ezer; Sentio adıyla verilen ortam değişkenleri ve komut satırı yine önceliklidir.
    /// </summary>
    public static void AyarlariTasi(ConfigurationManager ayarlar)
    {
        var eski = ayarlar.GetSection(EskiAd).AsEnumerable(makePathsRelative: true)
            .Where(k => k.Value is not null)
            .Select(k => KeyValuePair.Create($"{SentioAyarlari.Bolum}:{k.Key}", k.Value))
            .ToList();
        if (ayarlar.GetConnectionString(EskiAd) is { } baglanti)
            eski.Add(KeyValuePair.Create<string, string?>($"ConnectionStrings:{SentioAyarlari.Bolum}", baglanti));
        if (eski.Count == 0) return;

        IConfigurationBuilder kaynaklar = ayarlar;
        var sonDosya = kaynaklar.Sources.ToList().FindLastIndex(k => k is FileConfigurationSource);
        kaynaklar.Sources.Insert(sonDosya + 1, new MemoryConfigurationSource { InitialData = eski });
    }

    /// <summary>Veri klasöründe yalnız eski adlı veritabanı varsa onu WAL dosyalarıyla birlikte yeni adına taşır.</summary>
    public static void VeritabaniniTasi(string veriKlasoru)
    {
        var yeni = Path.Combine(veriKlasoru, VeritabaniDosyasi);
        var eski = Path.Combine(veriKlasoru, EskiVeritabaniDosyasi);
        if (File.Exists(yeni) || !File.Exists(eski)) return;
        foreach (var ek in new[] { "-wal", "-shm", "" })
        {
            if (File.Exists(eski + ek)) File.Move(eski + ek, yeni + ek);
        }
    }
}
