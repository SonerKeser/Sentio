using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Alan;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Raporlar;

public sealed record RaporOturum(
    Guid Id, string Baslik, string? SinifAdi, string OgretmenAdi, DateTime Baslangic, DateTime? Bitis,
    OturumDurumu Durum, double SureSn, bool Anonim);

public sealed record RaporSinif(
    int KatilimciSayisi, int OkumaSayisi, float[] Dagilim, Duygu? Baskin, float Dikkat, float Valans,
    float Katilim, float YuzOrani, int UyariSayisi);

public sealed record RaporKatilimci(
    Guid Id, string Ad, KatilimciKaynagi Kaynak, double SureSn, int OkumaSayisi, float YuzOrani,
    float[] Dagilim, float[] BaskinOranlari, Duygu? Baskin, float Dikkat, float Valans, float Katilim, int UyariSayisi,
    int AnlamadimSayisi, int SoruSayisi);

public sealed record RaporDilim(long ZamanMs, int Aktif, float[] Dagilim, float Dikkat, float Valans, float OlumsuzOran);

/// <summary>Isı haritası satırı. Hücre değerleri: 0-6 baskın duygu, -1 veri yok, -2 yüz görünmüyor.</summary>
public sealed record RaporSatir(Guid KatilimciId, string Ad, int[] Hucreler);

public sealed record RaporAn(long ZamanMs, string Tur, string Aciklama, float Deger);

public sealed record RaporZaman(int AralikSn, IReadOnlyList<RaporDilim> Dilimler, IReadOnlyList<RaporSatir> IsiHaritasi);

public sealed record Rapor(
    RaporOturum Oturum,
    RaporSinif Sinif,
    IReadOnlyList<RaporKatilimci> Katilimcilar,
    RaporZaman Zaman,
    IReadOnlyList<RaporAn> OnemliAnlar,
    IReadOnlyList<UyariBildirimi> Uyarilar,
    RaporEtkilesim Etkilesim);

/// <summary>Bir oturumun tüm ölçümlerinden öğrenci, sınıf ve zaman ekseninde özet çıkarır.</summary>
public sealed class RaporOlusturucu(SentioVeritabani db)
{
    public const int VeriYok = -1;
    public const int YuzYok = -2;
    private static readonly int[] UygunAraliklar = [5, 10, 15, 30, 60, 120, 300];

    public async Task<(Rapor Rapor, List<Okuma> Okumalar, Dictionary<Guid, string> Adlar)?> OlusturAsync(
        Guid oturumId, int? aralikSn, CancellationToken iptal)
    {
        var oturum = await db.Oturumlar.AsNoTracking()
            .Include(o => o.Ogretmen)
            .Include(o => o.Katilimcilar)
            .AsSplitQuery()
            .FirstOrDefaultAsync(o => o.Id == oturumId, iptal);
        if (oturum is null) return null;

        var okumalar = await db.Okumalar.AsNoTracking()
            .Where(o => o.OturumId == oturumId)
            .OrderBy(o => o.ZamanMs)
            .ToListAsync(iptal);
        var uyarilar = await db.Uyarilar.AsNoTracking()
            .Where(u => u.OturumId == oturumId)
            .OrderBy(u => u.Id)
            .ToListAsync(iptal);
        var bolumler = await db.Bolumler.AsNoTracking().Where(b => b.OturumId == oturumId).ToListAsync(iptal);
        var yoklamalar = await db.Yoklamalar.AsNoTracking().Include(y => y.Yanitlar).Where(y => y.OturumId == oturumId).ToListAsync(iptal);
        var sinyaller = await db.Sinyaller.AsNoTracking().Where(s => s.OturumId == oturumId).ToListAsync(iptal);

        var anonim = oturum.Ayarlar.Anonim;
        var adlar = oturum.Katilimcilar.ToDictionary(k => k.Id, k => anonim ? $"Katılımcı {k.SiraNo}" : k.Ad);
        var rapor = Hesapla(oturum, okumalar, uyarilar, adlar, aralikSn, bolumler, yoklamalar, sinyaller);
        return (rapor, okumalar, adlar);
    }

    public static Rapor Hesapla(Oturum oturum, IReadOnlyList<Okuma> okumalar, IReadOnlyList<Uyari> uyarilar,
        IReadOnlyDictionary<Guid, string> adlar, int? aralikSn,
        IReadOnlyList<Bolum>? bolumler = null, IReadOnlyList<Yoklama>? yoklamalar = null, IReadOnlyList<Sinyal>? sinyaller = null)
    {
        var sinyalSayilari = (sinyaller ?? []).GroupBy(s => (s.KatilimciId, s.Tur)).ToDictionary(g => g.Key, g => g.Count());
        var baslangicMs = okumalar.Count > 0
            ? okumalar[0].ZamanMs
            : new DateTimeOffset(DateTime.SpecifyKind(oturum.OlusturmaZamani, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        var bitisMs = okumalar.Count > 0 ? okumalar[^1].ZamanMs : baslangicMs;
        var sureSn = (bitisMs - baslangicMs) / 1000.0;
        var aralik = AralikSec(sureSn, aralikSn);
        var dilimSayisi = Math.Max(1, (int)((bitisMs - baslangicMs) / (aralik * 1000L)) + 1);

        var uyariSayilari = uyarilar.Where(u => u.KatilimciId is not null)
            .GroupBy(u => u.KatilimciId!.Value)
            .ToDictionary(g => g.Key, g => g.Count(u => u.Tur != UyariTuru.OgretmenMesaji));

        var gruplar = okumalar.GroupBy(o => o.KatilimciId).ToDictionary(g => g.Key, g => g.ToList());
        var katilimcilar = new List<RaporKatilimci>();
        var satirlar = new List<RaporSatir>();

        // Dilim başına, katılımcı başına ortalama dağılım (sınıf eğrisi her öğrenciyi eşit ağırlıklandırır).
        var dilimToplam = new float[dilimSayisi][];
        var dilimDikkat = new float[dilimSayisi];
        var dilimKisi = new int[dilimSayisi];
        var dilimYuzluKisi = new int[dilimSayisi];
        var dilimOlumsuzKisi = new int[dilimSayisi];
        for (var i = 0; i < dilimSayisi; i++) dilimToplam[i] = new float[Duygular.Sayi];

        var sinifDagilim = new float[Duygular.Sayi];
        var (sinifYuzlu, sinifToplam) = (0, 0);
        var (sinifDikkat, sinifValans, sinifKatilim) = (0f, 0f, 0f);

        foreach (var k in oturum.Katilimcilar.OrderBy(k => k.SiraNo))
        {
            if (!gruplar.TryGetValue(k.Id, out var liste) || liste.Count == 0) continue;

            var dagilim = new float[Duygular.Sayi];
            var baskinSayilari = new int[Duygular.Sayi];
            var (yuzlu, dikkat, valans, katilim) = (0, 0f, 0f, 0f);

            var hucreSayilari = new int[dilimSayisi][];
            var hucreYuzsuz = new bool[dilimSayisi];
            var hucreToplam = new float[dilimSayisi][];
            var hucreDikkat = new float[dilimSayisi];
            var hucreYuzlu = new int[dilimSayisi];

            foreach (var o in liste)
            {
                var d = o.Olasiliklar();
                var v = Duygular.Valans(d);
                var dk = o.Dikkat / 100f;
                katilim += Duygular.Katilim(dk, v, o.Yuz);
                var dilim = (int)((o.ZamanMs - baslangicMs) / (aralik * 1000L));

                if (!o.Yuz)
                {
                    hucreYuzsuz[dilim] = true;
                    continue;
                }

                yuzlu++;
                dikkat += dk;
                valans += v;
                var baskin = Duygular.Baskin(d);
                baskinSayilari[(int)baskin]++;
                hucreSayilari[dilim] ??= new int[Duygular.Sayi];
                hucreSayilari[dilim][(int)baskin]++;
                hucreToplam[dilim] ??= new float[Duygular.Sayi];
                for (var i = 0; i < Duygular.Sayi; i++)
                {
                    dagilim[i] += d[i];
                    hucreToplam[dilim][i] += d[i];
                }
                hucreDikkat[dilim] += dk;
                hucreYuzlu[dilim]++;
            }

            var hucreler = new int[dilimSayisi];
            for (var i = 0; i < dilimSayisi; i++)
            {
                if (hucreSayilari[i] is { } sayilar)
                {
                    hucreler[i] = Array.IndexOf(sayilar, sayilar.Max());
                    var ort = hucreToplam[i].Select(t => t / hucreYuzlu[i]).ToArray();
                    for (var j = 0; j < Duygular.Sayi; j++) dilimToplam[i][j] += ort[j];
                    dilimDikkat[i] += hucreDikkat[i] / hucreYuzlu[i];
                    dilimYuzluKisi[i]++;
                    if (Duygular.Baskin(ort).OlumsuzMu() && ort.Max() >= KuralMotoru.OlumsuzEsik) dilimOlumsuzKisi[i]++;
                }
                else
                {
                    hucreler[i] = hucreYuzsuz[i] ? YuzYok : VeriYok;
                }
                if (hucreler[i] != VeriYok) dilimKisi[i]++;
            }

            if (yuzlu > 0)
            {
                for (var i = 0; i < Duygular.Sayi; i++) dagilim[i] /= yuzlu;
            }
            var ad = adlar.GetValueOrDefault(k.Id, k.Ad);
            katilimcilar.Add(new RaporKatilimci(
                k.Id, ad, k.Kaynak,
                (liste[^1].ZamanMs - liste[0].ZamanMs) / 1000.0,
                liste.Count,
                Yuvarla(yuzlu / (float)liste.Count),
                [.. dagilim.Select(Yuvarla)],
                [.. baskinSayilari.Select(s => yuzlu > 0 ? Yuvarla(s / (float)yuzlu) : 0f)],
                yuzlu > 0 ? Duygular.Baskin(dagilim) : null,
                yuzlu > 0 ? Yuvarla(dikkat / yuzlu) : 0f,
                yuzlu > 0 ? Yuvarla(valans / yuzlu) : 0f,
                Yuvarla(katilim / liste.Count),
                uyariSayilari.GetValueOrDefault(k.Id),
                sinyalSayilari.GetValueOrDefault((k.Id, SinyalTuru.Anlamadim)),
                sinyalSayilari.GetValueOrDefault((k.Id, SinyalTuru.Soru))));
            satirlar.Add(new RaporSatir(k.Id, ad, hucreler));

            if (yuzlu > 0)
            {
                sinifYuzlu++;
                for (var i = 0; i < Duygular.Sayi; i++) sinifDagilim[i] += dagilim[i];
                sinifDikkat += dikkat / yuzlu;
                sinifValans += valans / yuzlu;
            }
            sinifKatilim += katilim / liste.Count;
            sinifToplam++;
        }

        var dilimler = new List<RaporDilim>(dilimSayisi);
        for (var i = 0; i < dilimSayisi; i++)
        {
            var n = dilimYuzluKisi[i];
            var dag = n > 0 ? dilimToplam[i].Select(t => Yuvarla(t / n)).ToArray() : new float[Duygular.Sayi];
            dilimler.Add(new RaporDilim(
                baslangicMs + i * aralik * 1000L,
                dilimKisi[i],
                dag,
                n > 0 ? Yuvarla(dilimDikkat[i] / n) : 0f,
                n > 0 ? Yuvarla(Duygular.Valans(dag)) : 0f,
                n > 0 ? Yuvarla(dilimOlumsuzKisi[i] / (float)n) : 0f));
        }

        if (sinifYuzlu > 0)
        {
            for (var i = 0; i < Duygular.Sayi; i++) sinifDagilim[i] = Yuvarla(sinifDagilim[i] / sinifYuzlu);
        }
        var sinif = new RaporSinif(
            sinifToplam,
            okumalar.Count,
            sinifDagilim,
            sinifYuzlu > 0 ? Duygular.Baskin(sinifDagilim) : null,
            sinifYuzlu > 0 ? Yuvarla(sinifDikkat / sinifYuzlu) : 0f,
            sinifYuzlu > 0 ? Yuvarla(sinifValans / sinifYuzlu) : 0f,
            sinifToplam > 0 ? Yuvarla(sinifKatilim / sinifToplam) : 0f,
            okumalar.Count > 0 ? Yuvarla(okumalar.Count(o => o.Yuz) / (float)okumalar.Count) : 0f,
            uyarilar.Count(u => u.Tur != UyariTuru.OgretmenMesaji));

        var raporOturum = new RaporOturum(
            oturum.Id, oturum.Baslik, oturum.SinifAdi, oturum.Ogretmen?.AdSoyad ?? "", oturum.OlusturmaZamani,
            oturum.BitisZamani, oturum.Durum, sureSn, oturum.Ayarlar.Anonim);

        var uyariBildirimleri = uyarilar
            .Select(u => OlcumIsleyici.Bildirim(u, u.KatilimciId is { } id ? adlar.GetValueOrDefault(id) : null))
            .ToList();

        var sonMs = Math.Max(bitisMs, oturum.BitisZamani is { } b ? RaporEtkilesimi.Ms(b) : bitisMs);
        var etkilesim = RaporEtkilesimi.Hesapla(okumalar, adlar, bolumler ?? [], yoklamalar ?? [], sinyaller ?? [], sonMs);

        return new Rapor(raporOturum, sinif, katilimcilar, new RaporZaman(aralik, dilimler, satirlar),
            OnemliAnlar(dilimler), uyariBildirimleri, etkilesim);
    }

    /// <summary>Olumsuz ifadenin yoğunlaştığı, dikkatin düştüğü ve sınıfın en neşeli olduğu dilimleri seçer.</summary>
    public static List<RaporAn> OnemliAnlar(IReadOnlyList<RaporDilim> dilimler)
    {
        var anlar = new List<RaporAn>();
        var gecerli = dilimler.Where(d => d.Aktif >= 2).ToList();
        if (gecerli.Count == 0) return anlar;

        // Bitişik dilimler aynı anı anlatır; seçilen anlar arasında en az bir dakika bırakılır.
        var aralikMs = dilimler.Count > 1 ? dilimler[1].ZamanMs - dilimler[0].ZamanMs : 60_000;
        var enAzUzaklik = Math.Max(60_000, aralikMs * 3);
        foreach (var d in gecerli.Where(d => d.OlumsuzOran >= 0.3f).OrderByDescending(d => d.OlumsuzOran))
        {
            if (anlar.Count >= 3) break;
            if (anlar.Any(a => Math.Abs(a.ZamanMs - d.ZamanMs) < enAzUzaklik)) continue;
            anlar.Add(new RaporAn(d.ZamanMs, "olumsuz",
                $"Öğrencilerin %{Yuzde(d.OlumsuzOran)} kadarı olumsuz bir ifade taşıyordu.", d.OlumsuzOran));
        }

        var enDusukDikkat = gecerli.MinBy(d => d.Dikkat)!;
        if (enDusukDikkat.Dikkat < 0.5f)
        {
            anlar.Add(new RaporAn(enDusukDikkat.ZamanMs, "dikkat",
                $"Ortalama dikkat %{Yuzde(enDusukDikkat.Dikkat)} ile en düşük seviyedeydi.", enDusukDikkat.Dikkat));
        }

        var enNeseli = gecerli.MaxBy(d => d.Dagilim[(int)Duygu.Mutlu])!;
        if (enNeseli.Dagilim[(int)Duygu.Mutlu] >= 0.2f)
        {
            anlar.Add(new RaporAn(enNeseli.ZamanMs, "olumlu",
                $"Sınıfın en güler yüzlü anı: mutluluk ifadesi %{Yuzde(enNeseli.Dagilim[(int)Duygu.Mutlu])}.",
                enNeseli.Dagilim[(int)Duygu.Mutlu]));
        }

        return [.. anlar.OrderBy(a => a.ZamanMs)];
    }

    public static int AralikSec(double sureSn, int? istenen)
    {
        if (istenen is { } i) return Math.Clamp(i, 5, 600);
        var hedef = sureSn / 60.0;
        return UygunAraliklar.FirstOrDefault(a => a >= hedef, UygunAraliklar[^1]);
    }

    private static float Yuvarla(float deger) => MathF.Round(deger, 3);

    private static int Yuzde(float oran) => (int)MathF.Round(oran * 100f);
}
