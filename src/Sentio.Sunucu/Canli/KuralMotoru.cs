using Sentio.Sunucu.Alan;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Canli;

/// <summary>Bir katılımcının tek bir andaki işlenmiş ölçümü.</summary>
public readonly record struct OlcumKaydi(long ZamanMs, Duygu Baskin, float BaskinOlasilik, float Dikkat, float Goz, bool Yuz, float Valans);

public readonly record struct KuralSonucu(UyariTuru Tur, Duygu? Duygu, float SureSn, float? Oran);

/// <summary>Katılımcı başına kural zamanlayıcıları ve bekleme süreleri.</summary>
public sealed class KuralDurumu
{
    public long? OlumsuzBaslangicMs { get; set; }
    public long? OlumsuzSonMs { get; set; }
    public long? YuzYokBaslangicMs { get; set; }
    public Dictionary<UyariTuru, long> SonUyariMs { get; } = [];

    public bool Beklemede(UyariTuru tur, long simdiMs, long beklemeMs) =>
        SonUyariMs.TryGetValue(tur, out var son) && simdiMs - son < beklemeMs;

    public void Isaretle(UyariTuru tur, long simdiMs) => SonUyariMs[tur] = simdiMs;

    public void Sifirla()
    {
        OlumsuzBaslangicMs = null;
        OlumsuzSonMs = null;
        YuzYokBaslangicMs = null;
    }
}

/// <summary>Sınıf geneli kuralların zamanlayıcıları.</summary>
public sealed class SinifKuralDurumu
{
    public long? OlumsuzBaslangicMs { get; set; }
    public long? DikkatBaslangicMs { get; set; }
    public KuralDurumu Bekleme { get; } = new();
}

/// <summary>
/// Ölçümlerden uyarı üreten kurallar. Eski sistemdeki "aynı ifade art arda N kez tekrarlandı" mantığının
/// zamana dayalı, gürültüye dayanıklı karşılığıdır: kısa kopmalar tolere edilir, aynı uyarı bekleme süresi
/// dolmadan yinelenmez.
/// </summary>
public static class KuralMotoru
{
    /// <summary>Yumuşatılmış olasılığın "belirgin" sayılması için alt sınır.</summary>
    public const float OlumsuzEsik = 0.35f;

    /// <summary>Olumsuz ifadenin kesintisiz sayılması için izin verilen en uzun boşluk.</summary>
    public const long KopmaToleransiMs = 4_000;

    public const long YoklukMs = 45_000;
    public const long DikkatPencereMs = 30_000;
    public const float DikkatEsik = 0.35f;
    public const long UyuklamaPencereMs = 12_000;
    public const float UyuklamaGozEsik = 0.25f;
    public const float UyuklamaOran = 0.7f;

    public const int SinifEnAzKisi = 3;
    public const float SinifOlumsuzOran = 0.4f;
    public const long SinifOlumsuzSureMs = 15_000;
    public const float SinifDikkatEsik = 0.4f;
    public const long SinifDikkatSureMs = 30_000;
    public const long SinifEnAzBeklemeMs = 180_000;
    public const float SinifAnlamadiOran = 0.3f;
    public const long SinifAnlamadiBeklemeMs = 120_000;

    public static bool OlumsuzMu(ReadOnlySpan<float> yumusak, OturumAyarlari ayarlar, out Duygu baskin)
    {
        baskin = Duygular.Baskin(yumusak);
        return baskin.OlumsuzMu()
               && ayarlar.IzlenenDuygular.Contains(baskin)
               && yumusak[(int)baskin] >= OlumsuzEsik;
    }

    public static List<KuralSonucu> Degerlendir(
        KuralDurumu durum,
        ReadOnlySpan<float> yumusak,
        OlcumKaydi son,
        IReadOnlyList<OlcumKaydi> gecmis,
        OturumAyarlari ayarlar)
    {
        var sonuclar = new List<KuralSonucu>();
        var simdi = son.ZamanMs;
        var bekleme = ayarlar.BeklemeSn * 1000L;

        // 1) Kalıcı olumsuz ifade
        if (son.Yuz && OlumsuzMu(yumusak, ayarlar, out var baskin))
        {
            if (durum.OlumsuzBaslangicMs is null || simdi - durum.OlumsuzSonMs > KopmaToleransiMs)
            {
                durum.OlumsuzBaslangicMs = simdi;
            }
            durum.OlumsuzSonMs = simdi;

            var sure = simdi - durum.OlumsuzBaslangicMs.Value;
            if (sure >= ayarlar.KalicilikSn * 1000L && !durum.Beklemede(UyariTuru.OlumsuzIfade, simdi, bekleme))
            {
                durum.Isaretle(UyariTuru.OlumsuzIfade, simdi);
                sonuclar.Add(new KuralSonucu(UyariTuru.OlumsuzIfade, baskin, sure / 1000f, yumusak[(int)baskin]));
            }
        }
        else if (durum.OlumsuzSonMs is not null && simdi - durum.OlumsuzSonMs > KopmaToleransiMs)
        {
            durum.OlumsuzBaslangicMs = null;
            durum.OlumsuzSonMs = null;
        }

        // 2) Kamerada görünmeme
        if (!son.Yuz)
        {
            durum.YuzYokBaslangicMs ??= simdi;
            var sure = simdi - durum.YuzYokBaslangicMs.Value;
            if (ayarlar.YoklukIzle && sure >= YoklukMs && !durum.Beklemede(UyariTuru.KameradaYok, simdi, bekleme))
            {
                durum.Isaretle(UyariTuru.KameradaYok, simdi);
                sonuclar.Add(new KuralSonucu(UyariTuru.KameradaYok, null, sure / 1000f, null));
            }
        }
        else
        {
            durum.YuzYokBaslangicMs = null;
        }

        if (!son.Yuz) return sonuclar;

        // 3) Dikkat dağınıklığı: son 30 saniyede yüz görünürken ortalama dikkat düşük
        if (ayarlar.DikkatIzle && !durum.Beklemede(UyariTuru.DikkatDagildi, simdi, bekleme))
        {
            var (adet, toplam) = (0, 0f);
            foreach (var k in gecmis)
            {
                if (!k.Yuz || simdi - k.ZamanMs > DikkatPencereMs) continue;
                adet++;
                toplam += k.Dikkat;
            }
            if (adet > 0 && adet * (long)ayarlar.OrneklemeMs >= DikkatPencereMs / 2)
            {
                var ortalama = toplam / adet;
                if (ortalama < DikkatEsik)
                {
                    durum.Isaretle(UyariTuru.DikkatDagildi, simdi);
                    sonuclar.Add(new KuralSonucu(UyariTuru.DikkatDagildi, null, DikkatPencereMs / 1000f, ortalama));
                }
            }
        }

        // 4) Uyuklama: son 12 saniyenin büyük kısmında gözler kapalı
        if (ayarlar.UyuklamaIzle && !durum.Beklemede(UyariTuru.Uyuklama, simdi, bekleme))
        {
            var (adet, kapali) = (0, 0);
            foreach (var k in gecmis)
            {
                if (!k.Yuz || simdi - k.ZamanMs > UyuklamaPencereMs) continue;
                adet++;
                if (k.Goz < UyuklamaGozEsik) kapali++;
            }
            if (adet > 0 && adet * (long)ayarlar.OrneklemeMs >= UyuklamaPencereMs / 2 && kapali >= adet * UyuklamaOran)
            {
                durum.Isaretle(UyariTuru.Uyuklama, simdi);
                sonuclar.Add(new KuralSonucu(UyariTuru.Uyuklama, null, UyuklamaPencereMs / 1000f, kapali / (float)adet));
            }
        }

        return sonuclar;
    }

    /// <summary>Sınıf geneli kurallar. <paramref name="olumsuzOran"/> ve <paramref name="dikkat"/> yüzü görünen aktif katılımcılar üzerinden hesaplanır.</summary>
    public static List<KuralSonucu> SinifiDegerlendir(
        SinifKuralDurumu durum,
        int yuzuGorunenSayi,
        float olumsuzOran,
        float dikkat,
        long simdiMs,
        OturumAyarlari ayarlar)
    {
        var sonuclar = new List<KuralSonucu>();
        var bekleme = Math.Max(ayarlar.BeklemeSn * 1000L, SinifEnAzBeklemeMs);

        if (yuzuGorunenSayi < SinifEnAzKisi)
        {
            durum.OlumsuzBaslangicMs = null;
            durum.DikkatBaslangicMs = null;
            return sonuclar;
        }

        if (olumsuzOran >= SinifOlumsuzOran)
        {
            durum.OlumsuzBaslangicMs ??= simdiMs;
            var sure = simdiMs - durum.OlumsuzBaslangicMs.Value;
            if (sure >= SinifOlumsuzSureMs && !durum.Bekleme.Beklemede(UyariTuru.SinifOlumsuz, simdiMs, bekleme))
            {
                durum.Bekleme.Isaretle(UyariTuru.SinifOlumsuz, simdiMs);
                sonuclar.Add(new KuralSonucu(UyariTuru.SinifOlumsuz, null, sure / 1000f, olumsuzOran));
            }
        }
        else
        {
            durum.OlumsuzBaslangicMs = null;
        }

        if (ayarlar.DikkatIzle && dikkat < SinifDikkatEsik)
        {
            durum.DikkatBaslangicMs ??= simdiMs;
            var sure = simdiMs - durum.DikkatBaslangicMs.Value;
            if (sure >= SinifDikkatSureMs && !durum.Bekleme.Beklemede(UyariTuru.SinifDikkat, simdiMs, bekleme))
            {
                durum.Bekleme.Isaretle(UyariTuru.SinifDikkat, simdiMs);
                sonuclar.Add(new KuralSonucu(UyariTuru.SinifDikkat, null, sure / 1000f, dikkat));
            }
        }
        else
        {
            durum.DikkatBaslangicMs = null;
        }

        return sonuclar;
    }

    /// <summary>Öğrencilerin kendi beyanı: aktif öğrencilerin %30'u "Anlamadım" dediyse öğretmene hemen haber verilir.</summary>
    public static KuralSonucu? SinifAnlamadiDegerlendir(SinifKuralDurumu durum, int aktif, int anlamadim, long simdiMs)
    {
        if (aktif < SinifEnAzKisi || anlamadim < 2) return null;
        var oran = anlamadim / (float)aktif;
        if (oran < SinifAnlamadiOran || durum.Bekleme.Beklemede(UyariTuru.SinifAnlamadi, simdiMs, SinifAnlamadiBeklemeMs)) return null;
        durum.Bekleme.Isaretle(UyariTuru.SinifAnlamadi, simdiMs);
        return new KuralSonucu(UyariTuru.SinifAnlamadi, null, anlamadim, oran);
    }

    public static string Metin(KuralSonucu sonuc, string? ad) => sonuc.Tur switch
    {
        UyariTuru.OlumsuzIfade =>
            $"{ad} yaklaşık {Yuvarla(sonuc.SureSn)} sn'dir {sonuc.Duygu?.Sifat() ?? "olumsuz"} görünüyor.",
        UyariTuru.DikkatDagildi =>
            $"{ad} son 30 sn'de ekrana pek bakmıyor (dikkat %{Yuzde(sonuc.Oran)}).",
        UyariTuru.KameradaYok =>
            $"{ad} {Yuvarla(sonuc.SureSn)} sn'dir kamerada görünmüyor.",
        UyariTuru.Uyuklama =>
            $"{ad} yorgun görünüyor; gözleri uzun süredir büyük ölçüde kapalı.",
        UyariTuru.SinifOlumsuz =>
            $"Olumsuz ifade taşıyan öğrenci oranı %{Yuzde(sonuc.Oran)} ve bu durum {Yuvarla(sonuc.SureSn)} sn'dir sürüyor. Konuyu farklı bir örnekle açmayı ya da soru almayı düşünebilirsiniz.",
        UyariTuru.SinifAnlamadi =>
            $"{Yuvarla(sonuc.SureSn)} öğrenci (aktiflerin %{Yuzde(sonuc.Oran)} kadarı) anlamadığını belirtti. Konuyu bir örnekle yeniden açmak iyi olabilir.",
        UyariTuru.SinifDikkat =>
            $"Sınıfın ortalama dikkati %{Yuzde(sonuc.Oran)} seviyesinde. Kısa bir mola ya da etkileşimli bir etkinlik iyi gelebilir.",
        _ => "",
    };

    private static int Yuvarla(float saniye) => (int)MathF.Round(saniye);

    private static int Yuzde(float? oran) => (int)MathF.Round((oran ?? 0f) * 100f);
}
