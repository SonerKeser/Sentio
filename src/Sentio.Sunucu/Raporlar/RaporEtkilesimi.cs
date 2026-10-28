using Sentio.Sunucu.Alan;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Raporlar;

public sealed record RaporBolum(
    long Id, string Ad, bool Mola, long BaslangicMs, long BitisMs, int Aktif, float[] Dagilim, float Dikkat,
    float OlumsuzOran, int Anlamadim, int Soru);

/// <param name="AnlamaOrani">Anlama yoklamasında (Anladım + Kısmen/2) / yanıt.</param>
/// <param name="Ortalama">Puan yoklamasında ortalama puan.</param>
public sealed record RaporYoklama(
    Guid Id, YoklamaTuru Tur, string Soru, string[] Secenekler, int[] Sayilar, int Yanitlayan, int Katilimci,
    long ZamanMs, float? AnlamaOrani, float? Ortalama);

public sealed record RaporSinyal(long Id, Guid KatilimciId, string Ad, SinyalTuru Tur, string? Metin, long ZamanMs, bool Yanitlandi);

public sealed record RaporEtkilesim(
    IReadOnlyList<RaporBolum> Bolumler,
    IReadOnlyList<RaporYoklama> Yoklamalar,
    IReadOnlyList<RaporSinyal> Sinyaller,
    int Anlamadim,
    int Soru,
    int Yavasla,
    float? AnlamaOrani);

/// <summary>Raporun etkileşim bölümü: bölüm başına ölçümler, yoklama sonuçları ve öğrenci beyanları.</summary>
public static class RaporEtkilesimi
{
    public static long Ms(DateTime zaman) =>
        new DateTimeOffset(DateTime.SpecifyKind(zaman, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    public static RaporEtkilesim Hesapla(
        IReadOnlyList<Okuma> okumalar,
        IReadOnlyDictionary<Guid, string> adlar,
        IReadOnlyList<Bolum> bolumler,
        IReadOnlyList<Yoklama> yoklamalar,
        IReadOnlyList<Sinyal> sinyaller,
        long sonMs)
    {
        var raporSinyalleri = sinyaller
            .OrderBy(s => s.Zaman)
            .Select(s => new RaporSinyal(s.Id, s.KatilimciId, adlar.GetValueOrDefault(s.KatilimciId, "?"), s.Tur, s.Metin,
                Ms(s.Zaman), s.KapanmaZamani is not null))
            .ToList();

        var raporBolumleri = new List<RaporBolum>();
        foreach (var b in bolumler.OrderBy(b => b.Baslangic))
        {
            var bas = Ms(b.Baslangic);
            var bit = b.Bitis is { } bitis ? Ms(bitis) : Math.Max(sonMs, bas);
            var ozet = AralikOzeti(okumalar.Where(o => o.ZamanMs >= bas && o.ZamanMs < bit));
            raporBolumleri.Add(new RaporBolum(b.Id, b.Ad, b.Mola, bas, bit, ozet.Aktif, ozet.Dagilim, ozet.Dikkat, ozet.OlumsuzOran,
                raporSinyalleri.Count(s => s.Tur == SinyalTuru.Anlamadim && s.ZamanMs >= bas && s.ZamanMs < bit),
                raporSinyalleri.Count(s => s.Tur == SinyalTuru.Soru && s.ZamanMs >= bas && s.ZamanMs < bit)));
        }

        var raporYoklamalari = new List<RaporYoklama>();
        foreach (var y in yoklamalar.OrderBy(y => y.Baslangic))
        {
            var sayilar = new int[y.Secenekler.Count];
            foreach (var yanit in y.Yanitlar)
            {
                if (yanit.Secim >= 0 && yanit.Secim < sayilar.Length) sayilar[yanit.Secim]++;
            }
            var toplam = sayilar.Sum();
            var bas = Ms(y.Baslangic);
            var bit = y.Bitis is { } bitis ? Ms(bitis) : bas + 60_000;
            // O an derste olan öğrenci sayısı: yoklama süresince ölçüm gönderenler.
            var katilimci = okumalar.Where(o => o.ZamanMs >= bas - 30_000 && o.ZamanMs <= bit).Select(o => o.KatilimciId).Distinct().Count();

            float? anlama = y.Tur == YoklamaTuru.Anlama && toplam > 0 && sayilar.Length >= 2
                ? Yuvarla((sayilar[0] + sayilar[1] * 0.5f) / toplam)
                : null;
            float? ortalama = y.Tur == YoklamaTuru.Puan && toplam > 0
                ? Yuvarla(sayilar.Select((n, i) => n * (i + 1f)).Sum() / toplam)
                : null;
            raporYoklamalari.Add(new RaporYoklama(y.Id, y.Tur, y.Soru, [.. y.Secenekler], sayilar, toplam,
                Math.Max(katilimci, toplam), bas, anlama, ortalama));
        }

        var anlamaOranlari = raporYoklamalari.Where(y => y.AnlamaOrani is not null).Select(y => y.AnlamaOrani!.Value).ToList();
        return new RaporEtkilesim(
            raporBolumleri,
            raporYoklamalari,
            raporSinyalleri,
            raporSinyalleri.Count(s => s.Tur == SinyalTuru.Anlamadim),
            raporSinyalleri.Count(s => s.Tur == SinyalTuru.Soru),
            raporSinyalleri.Count(s => s.Tur == SinyalTuru.Yavasla),
            anlamaOranlari.Count > 0 ? Yuvarla(anlamaOranlari.Average()) : null);
    }

    /// <summary>Bir zaman aralığının sınıf özeti; her öğrenci eşit ağırlıklıdır.</summary>
    public static (int Aktif, float[] Dagilim, float Dikkat, float OlumsuzOran) AralikOzeti(IEnumerable<Okuma> okumalar)
    {
        var dagilim = new float[Duygular.Sayi];
        var (kisi, dikkat, olumsuz) = (0, 0f, 0);
        foreach (var grup in okumalar.Where(o => o.Yuz).GroupBy(o => o.KatilimciId))
        {
            var ort = new float[Duygular.Sayi];
            var (n, dk) = (0, 0f);
            foreach (var o in grup)
            {
                var d = o.Olasiliklar();
                for (var i = 0; i < Duygular.Sayi; i++) ort[i] += d[i];
                dk += o.Dikkat / 100f;
                n++;
            }
            for (var i = 0; i < Duygular.Sayi; i++)
            {
                ort[i] /= n;
                dagilim[i] += ort[i];
            }
            dikkat += dk / n;
            if (Duygular.Baskin(ort).OlumsuzMu() && ort.Max() >= KuralMotoru.OlumsuzEsik) olumsuz++;
            kisi++;
        }
        if (kisi == 0) return (0, dagilim, 0f, 0f);
        return (kisi, [.. dagilim.Select(x => Yuvarla(x / kisi))], Yuvarla(dikkat / kisi), Yuvarla(olumsuz / (float)kisi));
    }

    private static float Yuvarla(float deger) => MathF.Round(deger, 3);
}
