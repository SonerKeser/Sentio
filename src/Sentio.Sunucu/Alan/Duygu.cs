namespace Sentio.Sunucu.Alan;

/// <summary>
/// Yüz ifadesi sınıfları. Sıra, istemcinin gönderdiği olasılık dizisinin sırasıdır;
/// değiştirilirse web istemcisindeki <c>DUYGULAR</c> dizisi de aynı sırayla güncellenmelidir.
/// </summary>
public enum Duygu : byte
{
    Notr = 0,
    Mutlu = 1,
    Saskin = 2,
    Uzgun = 3,
    Ofkeli = 4,
    Korku = 5,
    Igrenme = 6,
}

public static class Duygular
{
    public const int Sayi = 7;

    public static readonly Duygu[] Hepsi =
        [Duygu.Notr, Duygu.Mutlu, Duygu.Saskin, Duygu.Uzgun, Duygu.Ofkeli, Duygu.Korku, Duygu.Igrenme];

    public static readonly Duygu[] Olumsuzlar = [Duygu.Uzgun, Duygu.Ofkeli, Duygu.Korku, Duygu.Igrenme];

    // Duygu durumu (valans) ağırlıkları: duygu çemberi modelinin kaba bir izdüşümü.
    private static readonly float[] ValansAgirligi = [0f, 1f, 0.3f, -0.8f, -0.9f, -0.7f, -0.8f];

    public static bool OlumsuzMu(this Duygu duygu) =>
        duygu is Duygu.Uzgun or Duygu.Ofkeli or Duygu.Korku or Duygu.Igrenme;

    public static string Etiket(this Duygu duygu) => duygu switch
    {
        Duygu.Notr => "Nötr",
        Duygu.Mutlu => "Mutlu",
        Duygu.Saskin => "Şaşkın",
        Duygu.Uzgun => "Üzgün",
        Duygu.Ofkeli => "Öfkeli",
        Duygu.Korku => "Kaygılı",
        Duygu.Igrenme => "Hoşnutsuz",
        _ => duygu.ToString(),
    };

    /// <summary>"… görünüyor" cümlesinde kullanılan küçük harfli sıfat.</summary>
    public static string Sifat(this Duygu duygu) => duygu switch
    {
        Duygu.Notr => "nötr",
        Duygu.Mutlu => "mutlu",
        Duygu.Saskin => "şaşkın",
        Duygu.Uzgun => "üzgün",
        Duygu.Ofkeli => "öfkeli",
        Duygu.Korku => "kaygılı",
        Duygu.Igrenme => "hoşnutsuz",
        _ => duygu.ToString(),
    };

    /// <summary>Excel ve rapor renkleri; web arayüzündeki duygu tayfıyla aynıdır.</summary>
    public static string Renk(this Duygu duygu) => duygu switch
    {
        Duygu.Notr => "#9AA6C8",
        Duygu.Mutlu => "#FFC94A",
        Duygu.Saskin => "#FF7AD9",
        Duygu.Uzgun => "#5AA9FF",
        Duygu.Ofkeli => "#FF6B5E",
        Duygu.Korku => "#A784FF",
        Duygu.Igrenme => "#7BDB8A",
        _ => "#FFFFFF",
    };

    public static Duygu Baskin(ReadOnlySpan<float> olasiliklar)
    {
        var enIyi = 0;
        for (var i = 1; i < Sayi && i < olasiliklar.Length; i++)
        {
            if (olasiliklar[i] > olasiliklar[enIyi]) enIyi = i;
        }
        return (Duygu)enIyi;
    }

    public static float Valans(ReadOnlySpan<float> olasiliklar)
    {
        var toplam = 0f;
        for (var i = 0; i < Sayi && i < olasiliklar.Length; i++) toplam += olasiliklar[i] * ValansAgirligi[i];
        return Math.Clamp(toplam, -1f, 1f);
    }

    /// <summary>Katılım puanı (0-1): dikkatin ağırlıklı olduğu, duygu durumunun destek verdiği birleşik ölçü.</summary>
    public static float Katilim(float dikkat, float valans, bool yuz) =>
        yuz ? Math.Clamp(0.7f * dikkat + 0.3f * ((valans + 1f) / 2f), 0f, 1f) : 0f;

    /// <summary>Gelen olasılıkları doğrular, eksi/NaN değerleri sıfırlar ve toplamı 1 olacak şekilde ölçekler.</summary>
    public static float[]? Normallestir(float[]? ham)
    {
        if (ham is null || ham.Length != Sayi) return null;
        var sonuc = new float[Sayi];
        var toplam = 0f;
        for (var i = 0; i < Sayi; i++)
        {
            var d = ham[i];
            sonuc[i] = float.IsFinite(d) && d > 0 ? d : 0f;
            toplam += sonuc[i];
        }
        if (toplam <= 0f)
        {
            sonuc[(int)Duygu.Notr] = 1f;
            return sonuc;
        }
        for (var i = 0; i < Sayi; i++) sonuc[i] /= toplam;
        return sonuc;
    }
}
