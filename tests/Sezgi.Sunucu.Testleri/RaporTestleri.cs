using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Raporlar;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Testleri;

public class RaporTestleri
{
    private static float[] Tek(Duygu d)
    {
        var dizi = new float[Duygular.Sayi];
        dizi[(int)d] = 1f;
        return dizi;
    }

    [Fact]
    public void Isi_haritasi_ve_ozetler_olcumlerden_dogru_hesaplanir()
    {
        var oturum = new Oturum { Baslik = "Deneme", KatilimKodu = "ABC123" };
        var ali = new Katilimci { OturumId = oturum.Id, Ad = "Ali", SiraNo = 1 };
        var ayse = new Katilimci { OturumId = oturum.Id, Ad = "Ayşe", SiraNo = 2 };
        oturum.Katilimcilar.AddRange([ali, ayse]);

        var okumalar = new List<Okuma>();
        for (var s = 0; s < 60; s++)
        {
            var t = 1_000_000L + s * 1000;
            // Ali ilk yarıda mutlu, ikinci yarıda üzgün; Ayşe hep nötr ama son 10 saniyede kamerada yok.
            okumalar.Add(Okuma.Olustur(oturum.Id, ali.Id, t, Tek(s < 30 ? Duygu.Mutlu : Duygu.Uzgun), 0.9f, 0.9f, true));
            okumalar.Add(Okuma.Olustur(oturum.Id, ayse.Id, t, Tek(Duygu.Notr), 0.5f, 0.9f, s < 50));
        }
        var adlar = new Dictionary<Guid, string> { [ali.Id] = "Ali", [ayse.Id] = "Ayşe" };

        var rapor = RaporOlusturucu.Hesapla(oturum, okumalar, [], adlar, aralikSn: 10);

        Assert.Equal(2, rapor.Katilimcilar.Count);
        Assert.Equal(6, rapor.Zaman.Dilimler.Count);
        var aliSatiri = rapor.Zaman.IsiHaritasi.Single(r => r.KatilimciId == ali.Id);
        Assert.Equal([(int)Duygu.Mutlu, 1, 1, (int)Duygu.Uzgun, 3, 3], aliSatiri.Hucreler);
        var ayseSatiri = rapor.Zaman.IsiHaritasi.Single(r => r.KatilimciId == ayse.Id);
        Assert.Equal(RaporOlusturucu.YuzYok, ayseSatiri.Hucreler[^1]);

        var aliOzeti = rapor.Katilimcilar.Single(k => k.Id == ali.Id);
        Assert.Equal(0.5f, aliOzeti.Dagilim[(int)Duygu.Mutlu], 2);
        Assert.Equal(0.5f, aliOzeti.Dagilim[(int)Duygu.Uzgun], 2);
        Assert.Equal(1f, aliOzeti.YuzOrani);

        var ayseOzeti = rapor.Katilimcilar.Single(k => k.Id == ayse.Id);
        Assert.Equal(50f / 60f, ayseOzeti.YuzOrani, 2);
        Assert.Equal(Duygu.Notr, ayseOzeti.Baskin);

        // İkinci yarıda yüzü görünen iki kişiden biri olumsuz: oran %50.
        Assert.Equal(0.5f, rapor.Zaman.Dilimler[3].OlumsuzOran, 2);
        Assert.Contains(rapor.OnemliAnlar, a => a.Tur == "olumsuz");
    }

    [Theory]
    [InlineData(120, null, 5)]
    [InlineData(2400, null, 60)]
    [InlineData(7200, null, 120)]
    [InlineData(100, 1, 5)]
    [InlineData(100, 30, 30)]
    public void Aralik_sureye_gore_secilir(double sureSn, int? istenen, int beklenen) =>
        Assert.Equal(beklenen, RaporOlusturucu.AralikSec(sureSn, istenen));

    [Fact]
    public void Excel_ve_csv_uretilir()
    {
        var oturum = new Oturum { Baslik = "Excel", KatilimKodu = "XYZ789" };
        var k = new Katilimci { OturumId = oturum.Id, Ad = "=TEHLIKE()", SiraNo = 1 };
        oturum.Katilimcilar.Add(k);
        var okumalar = Enumerable.Range(0, 10)
            .Select(i => Okuma.Olustur(oturum.Id, k.Id, 1_000_000L + i * 1000, Tek(Duygu.Saskin), 0.7f, 0.8f, true))
            .ToList();
        var adlar = new Dictionary<Guid, string> { [k.Id] = k.Ad };
        var rapor = RaporOlusturucu.Hesapla(oturum, okumalar, [], adlar, null);

        var excel = ExcelDisaAktarici.Olustur(rapor, okumalar, adlar);
        Assert.True(excel.Length > 1000);
        Assert.Equal((byte)'P', excel[0]);

        var csv = System.Text.Encoding.UTF8.GetString(ExcelDisaAktarici.Csv(okumalar, adlar));
        Assert.Contains("'=TEHLIKE()", csv);
        Assert.Equal(11, csv.Trim().Split('\n').Length);
    }
}
