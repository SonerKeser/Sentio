using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Sentio.Sunucu.Alan;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Raporlar;

/// <summary>
/// Raporu Excel çalışma kitabına ve CSV'ye dönüştürür. "Isı Haritası" sayfası, eski sistemin
/// öğrenci × zaman tablosunun renklendirilmiş ve özetlenmiş karşılığıdır.
/// </summary>
public static class ExcelDisaAktarici
{
    private const int EnFazlaHamSatir = 1_000_000;
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public static byte[] Olustur(Rapor rapor, IReadOnlyList<Okuma> okumalar, IReadOnlyDictionary<Guid, string> adlar)
    {
        using var kitap = new XLWorkbook();
        kitap.Properties.Title = rapor.Oturum.Baslik;
        kitap.Properties.Author = "Sentio";
        OzetSayfasi(kitap, rapor);
        IsiHaritasi(kitap, rapor);
        ZamanCizelgesi(kitap, rapor);
        Uyarilar(kitap, rapor);
        Bolumler(kitap, rapor);
        Yoklamalar(kitap, rapor);
        Sinyaller(kitap, rapor);
        HamVeri(kitap, okumalar, adlar);

        using var akis = new MemoryStream();
        kitap.SaveAs(akis);
        return akis.ToArray();
    }

    public static byte[] Csv(IReadOnlyList<Okuma> okumalar, IReadOnlyDictionary<Guid, string> adlar)
    {
        // Türkçe Excel sürümleri ";" ayırıcıyı ve BOM'lu UTF-8'i doğrudan tanır.
        var sb = new StringBuilder();
        sb.AppendLine("zaman;katilimci;notr;mutlu;saskin;uzgun;ofkeli;kaygili;hosnutsuz;dikkat;goz;yuz");
        foreach (var o in okumalar)
        {
            sb.Append(Yerel(o.ZamanMs).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)).Append(';')
              .Append(CsvAlan(adlar.GetValueOrDefault(o.KatilimciId, "?"))).Append(';')
              .Append(o.Notr).Append(';').Append(o.Mutlu).Append(';').Append(o.Saskin).Append(';')
              .Append(o.Uzgun).Append(';').Append(o.Ofkeli).Append(';').Append(o.Korku).Append(';')
              .Append(o.Igrenme).Append(';').Append(o.Dikkat).Append(';').Append(o.Goz).Append(';')
              .Append(o.Yuz ? 1 : 0).AppendLine();
        }
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(sb.ToString())];
    }

    private static void OzetSayfasi(XLWorkbook kitap, Rapor rapor)
    {
        var s = kitap.Worksheets.Add("Özet");
        var o = rapor.Oturum;
        s.Cell(1, 1).Value = o.Baslik;
        s.Cell(1, 1).Style.Font.SetFontSize(18).Font.SetBold();
        var bilgiler = new (string, XLCellValue)[]
        {
            ("Sınıf", o.SinifAdi ?? "—"),
            ("Öğretmen", o.OgretmenAdi),
            ("Başlangıç", Yerel(o.Baslangic)),
            ("Süre (dk)", Math.Round(o.SureSn / 60.0, 1)),
            ("Katılımcı", rapor.Sinif.KatilimciSayisi),
            ("Ölçüm sayısı", rapor.Sinif.OkumaSayisi),
            ("Sınıfın baskın ifadesi", rapor.Sinif.Baskin?.Etiket() ?? "—"),
            ("Ortalama dikkat", rapor.Sinif.Dikkat),
            ("Ortalama katılım", rapor.Sinif.Katilim),
            ("Kamerada görünme", rapor.Sinif.YuzOrani),
            ("Uyarı sayısı", rapor.Sinif.UyariSayisi),
        };
        for (var i = 0; i < bilgiler.Length; i++)
        {
            s.Cell(3 + i, 1).Value = bilgiler[i].Item1;
            s.Cell(3 + i, 1).Style.Font.SetFontColor(XLColor.FromHtml("#6B6790"));
            var hucre = s.Cell(3 + i, 2);
            hucre.Value = bilgiler[i].Item2;
            if (bilgiler[i].Item2.IsDateTime) hucre.Style.DateFormat.Format = "dd.MM.yyyy HH:mm";
        }
        foreach (var satir in new[] { 10, 11, 12 }) s.Cell(satir, 2).Style.NumberFormat.Format = "0%";

        var baslangic = 3 + bilgiler.Length + 2;
        string[] basliklar =
        [
            "Katılımcı", "Kaynak", "Süre (dk)", "Kamerada", "Baskın ifade", "Dikkat", "Katılım",
            .. Duygular.Hepsi.Select(d => d.Etiket()), "Uyarı",
        ];
        for (var i = 0; i < basliklar.Length; i++) s.Cell(baslangic, 1 + i).Value = basliklar[i];

        var r = baslangic + 1;
        foreach (var k in rapor.Katilimcilar)
        {
            s.Cell(r, 1).Value = k.Ad;
            s.Cell(r, 2).Value = KaynakAdi(k.Kaynak);
            s.Cell(r, 3).Value = Math.Round(k.SureSn / 60.0, 1);
            s.Cell(r, 4).Value = k.YuzOrani;
            s.Cell(r, 5).Value = k.Baskin?.Etiket() ?? "—";
            if (k.Baskin is { } b) s.Cell(r, 5).Style.Fill.SetBackgroundColor(XLColor.FromHtml(b.Renk()));
            s.Cell(r, 6).Value = k.Dikkat;
            s.Cell(r, 7).Value = k.Katilim;
            for (var i = 0; i < Duygular.Sayi; i++) s.Cell(r, 8 + i).Value = k.Dagilim[i];
            s.Cell(r, 8 + Duygular.Sayi).Value = k.UyariSayisi;
            r++;
        }

        if (rapor.Katilimcilar.Count > 0)
        {
            var tablo = s.Range(baslangic, 1, r - 1, basliklar.Length).CreateTable("Katilimcilar");
            tablo.Theme = XLTableTheme.TableStyleMedium2;
            s.Range(baslangic + 1, 4, r - 1, 4).Style.NumberFormat.Format = "0%";
            s.Range(baslangic + 1, 6, r - 1, 7 + Duygular.Sayi).Style.NumberFormat.Format = "0%";
        }
        s.Columns().AdjustToContents(8, 60);
    }

    private static void IsiHaritasi(XLWorkbook kitap, Rapor rapor)
    {
        var s = kitap.Worksheets.Add("Isı Haritası");
        s.Cell(1, 1).Value = "Katılımcı";
        var dilimler = rapor.Zaman.Dilimler;
        for (var i = 0; i < dilimler.Count; i++)
        {
            var c = s.Cell(1, 2 + i);
            c.Value = Yerel(dilimler[i].ZamanMs).ToString("HH:mm:ss", Tr);
            c.Style.Alignment.SetTextRotation(90);
        }
        s.Row(1).Style.Font.SetBold();

        var r = 2;
        foreach (var satir in rapor.Zaman.IsiHaritasi)
        {
            s.Cell(r, 1).Value = satir.Ad;
            for (var i = 0; i < satir.Hucreler.Length; i++)
            {
                var c = s.Cell(r, 2 + i);
                var deger = satir.Hucreler[i];
                if (deger >= 0)
                {
                    var duygu = (Duygu)deger;
                    c.Value = duygu.Etiket();
                    c.Style.Fill.SetBackgroundColor(XLColor.FromHtml(duygu.Renk()));
                }
                else if (deger == RaporOlusturucu.YuzYok)
                {
                    c.Value = "—";
                    c.Style.Font.SetFontColor(XLColor.Gray);
                }
                c.Style.Font.SetFontSize(8);
                c.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            }
            r++;
        }

        s.Cell(r + 1, 1).Value = $"Her sütun {rapor.Zaman.AralikSn} saniyelik dilimdir; hücrede o dilimdeki baskın ifade yazar. \"—\": kamerada görünmüyor.";
        s.Cell(r + 1, 1).Style.Font.SetItalic().Font.SetFontColor(XLColor.Gray);
        s.Column(1).Width = 24;
        for (var i = 0; i < dilimler.Count; i++) s.Column(2 + i).Width = 9;
        s.SheetView.Freeze(1, 1);
    }

    private static void ZamanCizelgesi(XLWorkbook kitap, Rapor rapor)
    {
        var s = kitap.Worksheets.Add("Zaman Çizelgesi");
        string[] basliklar = ["Zaman", "Aktif", .. Duygular.Hepsi.Select(d => d.Etiket()), "Dikkat", "Duygu durumu", "Olumsuz oran"];
        for (var i = 0; i < basliklar.Length; i++) s.Cell(1, 1 + i).Value = basliklar[i];

        var r = 2;
        foreach (var d in rapor.Zaman.Dilimler)
        {
            s.Cell(r, 1).Value = Yerel(d.ZamanMs);
            s.Cell(r, 1).Style.DateFormat.Format = "HH:mm:ss";
            s.Cell(r, 2).Value = d.Aktif;
            for (var i = 0; i < Duygular.Sayi; i++) s.Cell(r, 3 + i).Value = d.Dagilim[i];
            s.Cell(r, 3 + Duygular.Sayi).Value = d.Dikkat;
            s.Cell(r, 4 + Duygular.Sayi).Value = d.Valans;
            s.Cell(r, 5 + Duygular.Sayi).Value = d.OlumsuzOran;
            r++;
        }
        if (r > 2)
        {
            s.Range(1, 1, r - 1, basliklar.Length).CreateTable("Zaman").Theme = XLTableTheme.TableStyleLight9;
            s.Range(2, 3, r - 1, 3 + Duygular.Sayi).Style.NumberFormat.Format = "0%";
            s.Range(2, 5 + Duygular.Sayi, r - 1, 5 + Duygular.Sayi).Style.NumberFormat.Format = "0%";
            s.Range(2, 4 + Duygular.Sayi, r - 1, 4 + Duygular.Sayi).Style.NumberFormat.Format = "+0.00;-0.00;0";
        }
        s.Columns().AdjustToContents(8, 30);
    }

    private static void Uyarilar(XLWorkbook kitap, Rapor rapor)
    {
        var s = kitap.Worksheets.Add("Uyarılar");
        string[] basliklar = ["Zaman", "Tür", "Katılımcı", "Mesaj", "Öğrenciye iletildi"];
        for (var i = 0; i < basliklar.Length; i++) s.Cell(1, 1 + i).Value = basliklar[i];
        var r = 2;
        foreach (var u in rapor.Uyarilar)
        {
            s.Cell(r, 1).Value = Yerel(u.Zaman);
            s.Cell(r, 1).Style.DateFormat.Format = "HH:mm:ss";
            s.Cell(r, 2).Value = TurAdi(u.Tur);
            s.Cell(r, 3).Value = u.KatilimciAdi ?? "Sınıf";
            s.Cell(r, 4).Value = u.Mesaj;
            s.Cell(r, 5).Value = u.OgrenciyeIletildi ? "Evet" : "Hayır";
            r++;
        }
        if (r > 2) s.Range(1, 1, r - 1, basliklar.Length).CreateTable("Uyarilar").Theme = XLTableTheme.TableStyleLight9;
        s.Columns().AdjustToContents(8, 90);
    }

    private static void Bolumler(XLWorkbook kitap, Rapor rapor)
    {
        var liste = rapor.Etkilesim.Bolumler;
        if (liste.Count == 0) return;
        var s = kitap.Worksheets.Add("Bölümler");
        string[] basliklar = ["Bölüm", "Başlangıç", "Süre (dk)", "Öğrenci", "Baskın ifade", .. Duygular.Hepsi.Select(d => d.Etiket()), "Dikkat", "Olumsuz oran", "Anlamadım", "Söz isteği"];
        for (var i = 0; i < basliklar.Length; i++) s.Cell(1, 1 + i).Value = basliklar[i];
        var r = 2;
        foreach (var b in liste)
        {
            s.Cell(r, 1).Value = b.Mola ? $"{b.Ad} (mola)" : b.Ad;
            s.Cell(r, 2).Value = Yerel(b.BaslangicMs);
            s.Cell(r, 2).Style.DateFormat.Format = "HH:mm:ss";
            s.Cell(r, 3).Value = Math.Round((b.BitisMs - b.BaslangicMs) / 60000.0, 1);
            s.Cell(r, 4).Value = b.Aktif;
            if (b.Aktif > 0)
            {
                var baskin = Duygular.Baskin(b.Dagilim);
                s.Cell(r, 5).Value = baskin.Etiket();
                s.Cell(r, 5).Style.Fill.SetBackgroundColor(XLColor.FromHtml(baskin.Renk()));
                for (var i = 0; i < Duygular.Sayi; i++) s.Cell(r, 6 + i).Value = b.Dagilim[i];
                s.Cell(r, 6 + Duygular.Sayi).Value = b.Dikkat;
                s.Cell(r, 7 + Duygular.Sayi).Value = b.OlumsuzOran;
            }
            s.Cell(r, 8 + Duygular.Sayi).Value = b.Anlamadim;
            s.Cell(r, 9 + Duygular.Sayi).Value = b.Soru;
            r++;
        }
        s.Range(1, 1, r - 1, basliklar.Length).CreateTable("Bolumler").Theme = XLTableTheme.TableStyleLight9;
        s.Range(2, 6, r - 1, 7 + Duygular.Sayi).Style.NumberFormat.Format = "0%";
        s.Columns().AdjustToContents(8, 40);
    }

    private static void Yoklamalar(XLWorkbook kitap, Rapor rapor)
    {
        var liste = rapor.Etkilesim.Yoklamalar;
        if (liste.Count == 0) return;
        var s = kitap.Worksheets.Add("Yoklamalar");
        var r = 1;
        foreach (var y in liste)
        {
            s.Cell(r, 1).Value = Yerel(y.ZamanMs).ToString("HH:mm", Tr) + "  " + y.Soru;
            s.Cell(r, 1).Style.Font.SetBold().Font.SetFontSize(12);
            var ozet = $"{y.Yanitlayan} yanıt / {y.Katilimci} öğrenci";
            if (y.AnlamaOrani is { } a) ozet += $"  ·  anlama oranı %{Math.Round(a * 100)}";
            if (y.Ortalama is { } o) ozet += $"  ·  ortalama {o:0.0}";
            s.Cell(r + 1, 1).Value = ozet;
            s.Cell(r + 1, 1).Style.Font.SetFontColor(XLColor.Gray);
            r += 2;
            for (var i = 0; i < y.Secenekler.Length; i++)
            {
                s.Cell(r, 1).Value = y.Secenekler[i];
                s.Cell(r, 2).Value = y.Sayilar[i];
                s.Cell(r, 3).Value = y.Yanitlayan > 0 ? y.Sayilar[i] / (double)y.Yanitlayan : 0;
                s.Cell(r, 3).Style.NumberFormat.Format = "0%";
                s.Cell(r, 4).FormulaA1 = $"REPT(\"█\",ROUND(C{r}*30,0))";
                s.Cell(r, 4).Style.Font.SetFontColor(XLColor.FromHtml("#A784FF"));
                r++;
            }
            r++;
        }
        s.Column(1).Width = 50;
        s.Column(4).Width = 34;
    }

    private static void Sinyaller(XLWorkbook kitap, Rapor rapor)
    {
        var liste = rapor.Etkilesim.Sinyaller;
        if (liste.Count == 0) return;
        var s = kitap.Worksheets.Add("Öğrenci sinyalleri");
        string[] basliklar = ["Zaman", "Öğrenci", "Sinyal", "Soru", "Yanıtlandı"];
        for (var i = 0; i < basliklar.Length; i++) s.Cell(1, 1 + i).Value = basliklar[i];
        var r = 2;
        foreach (var x in liste)
        {
            s.Cell(r, 1).Value = Yerel(x.ZamanMs);
            s.Cell(r, 1).Style.DateFormat.Format = "HH:mm:ss";
            s.Cell(r, 2).Value = x.Ad;
            s.Cell(r, 3).Value = SinyalAdi(x.Tur);
            s.Cell(r, 4).Value = x.Metin ?? "";
            s.Cell(r, 5).Value = x.Tur == SinyalTuru.Soru ? (x.Yanitlandi ? "Evet" : "Hayır") : "";
            r++;
        }
        s.Range(1, 1, r - 1, basliklar.Length).CreateTable("Sinyaller").Theme = XLTableTheme.TableStyleLight9;
        s.Columns().AdjustToContents(8, 80);
    }

    public static string SinyalAdi(SinyalTuru tur) => tur switch
    {
        SinyalTuru.Anlamadim => "Anlamadım",
        SinyalTuru.Soru => "Söz istedi",
        _ => "Yavaşlar mısınız",
    };

    private static void HamVeri(XLWorkbook kitap, IReadOnlyList<Okuma> okumalar, IReadOnlyDictionary<Guid, string> adlar)
    {
        var s = kitap.Worksheets.Add("Ham Veri");
        string[] basliklar = ["Zaman", "Katılımcı", .. Duygular.Hepsi.Select(d => d.Etiket() + " %"), "Dikkat %", "Göz açıklığı %", "Yüz"];
        for (var i = 0; i < basliklar.Length; i++) s.Cell(1, 1 + i).Value = basliklar[i];
        s.Row(1).Style.Font.SetBold();

        var satirlar = okumalar.Take(EnFazlaHamSatir).Select(o => new object[]
        {
            Yerel(o.ZamanMs), adlar.GetValueOrDefault(o.KatilimciId, "?"),
            o.Notr, o.Mutlu, o.Saskin, o.Uzgun, o.Ofkeli, o.Korku, o.Igrenme, o.Dikkat, o.Goz, o.Yuz ? "Evet" : "Hayır",
        });
        if (okumalar.Count > 0)
        {
            s.Cell(2, 1).InsertData(satirlar);
            s.Column(1).Style.DateFormat.Format = "dd.MM.yyyy HH:mm:ss";
        }
        s.SheetView.Freeze(1, 0);
        s.Column(1).Width = 20;
        s.Column(2).Width = 24;
    }

    private static DateTime Yerel(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().DateTime;

    private static DateTime Yerel(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToLocalTime();

    private static string KaynakAdi(KatilimciKaynagi kaynak) => kaynak switch
    {
        KatilimciKaynagi.Kamera => "Öğrenci istemcisi",
        KatilimciKaynagi.Galeri => "Galeri analizi",
        _ => "Simülasyon",
    };

    public static string TurAdi(UyariTuru tur) => tur switch
    {
        UyariTuru.OlumsuzIfade => "Kalıcı olumsuz ifade",
        UyariTuru.DikkatDagildi => "Dikkat dağınıklığı",
        UyariTuru.KameradaYok => "Kamerada yok",
        UyariTuru.Uyuklama => "Yorgunluk",
        UyariTuru.SinifOlumsuz => "Sınıf geneli olumsuz",
        UyariTuru.SinifDikkat => "Sınıf geneli dikkat",
        UyariTuru.SinifAnlamadi => "Sınıf geneli anlamadım",
        _ => "Öğretmen mesajı",
    };

    private static string CsvAlan(string deger)
    {
        // Elektronik tabloda formül olarak yorumlanmasın.
        if (deger.Length > 0 && deger[0] is '=' or '+' or '-' or '@') deger = "'" + deger;
        return deger.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? $"\"{deger.Replace("\"", "\"\"")}\"" : deger;
    }
}
