using Sentio.Sunucu.Alan;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Testleri;

public class KuralMotoruTestleri
{
    private static readonly OturumAyarlari Ayarlar = new() { KalicilikSn = 10, BeklemeSn = 60, OrneklemeMs = 1000 };

    private static float[] Tek(Duygu d, float oran = 0.8f)
    {
        var dizi = Enumerable.Repeat((1f - oran) / 6f, Duygular.Sayi).ToArray();
        dizi[(int)d] = oran;
        return dizi;
    }

    /// <summary>Saniyede bir ölçümü katılımcı durumuna işler ve kural sonuçlarını toplar.</summary>
    private static List<KuralSonucu> Akit(CanliKatilimci k, OturumAyarlari ayarlar, IEnumerable<(float[] D, float Dikkat, float Goz, bool Yuz)> olcumler, long baslangicMs = 1_000_000)
    {
        var sonuclar = new List<KuralSonucu>();
        var zaman = baslangicMs;
        foreach (var (d, dikkat, goz, yuz) in olcumler)
        {
            var kayit = k.Isle(d, dikkat, goz, yuz, zaman);
            sonuclar.AddRange(KuralMotoru.Degerlendir(k.Kural, k.Yumusak, kayit, [.. k.Gecmis.Son(40)], ayarlar));
            zaman += 1000;
        }
        return sonuclar;
    }

    private static CanliKatilimci Yeni() => new(Guid.NewGuid(), Guid.NewGuid(), "Deneme", 1, KatilimciKaynagi.Kamera, null);

    [Fact]
    public void Kalici_olumsuz_ifade_esik_dolunca_bir_kez_uyari_uretir()
    {
        var sonuclar = Akit(Yeni(), Ayarlar, Enumerable.Repeat((Tek(Duygu.Uzgun), 0.8f, 0.9f, true), 25));

        var uyari = Assert.Single(sonuclar);
        Assert.Equal(UyariTuru.OlumsuzIfade, uyari.Tur);
        Assert.Equal(Duygu.Uzgun, uyari.Duygu);
        Assert.True(uyari.SureSn >= 10);
    }

    [Fact]
    public void Kisa_kopmalar_sureyi_sifirlamaz_uzun_kopma_sifirlar()
    {
        var kisa = Enumerable.Repeat((Tek(Duygu.Ofkeli), 0.8f, 0.9f, true), 6)
            .Append((Tek(Duygu.Notr), 0.8f, 0.9f, true))
            .Concat(Enumerable.Repeat((Tek(Duygu.Ofkeli), 0.8f, 0.9f, true), 6));
        Assert.Contains(Akit(Yeni(), Ayarlar, kisa), s => s.Tur == UyariTuru.OlumsuzIfade);

        var uzun = Enumerable.Repeat((Tek(Duygu.Ofkeli), 0.8f, 0.9f, true), 6)
            .Concat(Enumerable.Repeat((Tek(Duygu.Mutlu), 0.8f, 0.9f, true), 8))
            .Concat(Enumerable.Repeat((Tek(Duygu.Ofkeli), 0.8f, 0.9f, true), 6));
        Assert.DoesNotContain(Akit(Yeni(), Ayarlar, uzun), s => s.Tur == UyariTuru.OlumsuzIfade);
    }

    [Fact]
    public void Bekleme_suresi_dolmadan_ayni_uyari_yinelenmez_dolunca_yinelenir()
    {
        var sonuclar = Akit(Yeni(), Ayarlar, Enumerable.Repeat((Tek(Duygu.Korku), 0.8f, 0.9f, true), 80));
        var olumsuzlar = sonuclar.Where(s => s.Tur == UyariTuru.OlumsuzIfade).ToList();
        Assert.Equal(2, olumsuzlar.Count);
    }

    [Fact]
    public void Izlenmeyen_duygu_uyari_uretmez()
    {
        var ayarlar = Ayarlar.Kopya();
        ayarlar.IzlenenDuygular = [Duygu.Ofkeli];
        var sonuclar = Akit(Yeni(), ayarlar, Enumerable.Repeat((Tek(Duygu.Uzgun), 0.8f, 0.9f, true), 30));
        Assert.Empty(sonuclar);
    }

    [Fact]
    public void Kamerada_gorunmeme_45_saniye_sonra_uyari_uretir()
    {
        var sonuclar = Akit(Yeni(), Ayarlar, Enumerable.Repeat((Tek(Duygu.Notr), 0f, 0f, false), 50));
        var uyari = Assert.Single(sonuclar);
        Assert.Equal(UyariTuru.KameradaYok, uyari.Tur);
    }

    [Fact]
    public void Dusuk_dikkat_ve_kapali_gozler_ayri_uyarilar_uretir()
    {
        var daginik = Akit(Yeni(), Ayarlar, Enumerable.Repeat((Tek(Duygu.Notr), 0.1f, 0.9f, true), 20));
        Assert.Contains(daginik, s => s.Tur == UyariTuru.DikkatDagildi);

        var uykulu = Akit(Yeni(), Ayarlar, Enumerable.Repeat((Tek(Duygu.Notr), 0.8f, 0.1f, true), 12));
        Assert.Contains(uykulu, s => s.Tur == UyariTuru.Uyuklama);
        Assert.DoesNotContain(uykulu, s => s.Tur == UyariTuru.DikkatDagildi);
    }

    [Fact]
    public void Sinif_kurali_az_kisiyle_calismaz_cogunluk_olumsuzsa_tetiklenir()
    {
        var durum = new SinifKuralDurumu();
        Assert.Empty(KuralMotoru.SinifiDegerlendir(durum, 2, 1f, 0.9f, 0, Ayarlar));

        var sonuclar = new List<KuralSonucu>();
        for (var t = 0L; t <= 20_000; t += 1000)
        {
            sonuclar.AddRange(KuralMotoru.SinifiDegerlendir(durum, 10, 0.5f, 0.9f, t, Ayarlar));
        }
        var uyari = Assert.Single(sonuclar);
        Assert.Equal(UyariTuru.SinifOlumsuz, uyari.Tur);
        Assert.Equal(0.5f, uyari.Oran);
    }

    [Fact]
    public void Normallestirme_gecersiz_degerleri_temizler()
    {
        Assert.Null(Duygular.Normallestir([1f, 2f]));
        var n = Duygular.Normallestir([float.NaN, -1f, 2f, 2f, 0, 0, 0])!;
        Assert.Equal(1f, n.Sum(), 3);
        Assert.Equal(0f, n[0]);
        Assert.Equal(0.5f, n[2], 3);

        var bos = Duygular.Normallestir(new float[7])!;
        Assert.Equal(1f, bos[(int)Duygu.Notr]);
    }

    [Fact]
    public void Valans_ve_katilim_beklenen_yonde()
    {
        Assert.True(Duygular.Valans(Tek(Duygu.Mutlu, 1f)) > 0.9f);
        Assert.True(Duygular.Valans(Tek(Duygu.Ofkeli, 1f)) < -0.8f);
        Assert.Equal(0f, Duygular.Katilim(1f, 1f, yuz: false));
        Assert.True(Duygular.Katilim(1f, 0.5f, true) > Duygular.Katilim(0.2f, 0.5f, true));
    }
}
