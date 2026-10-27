using Sezgi.Sunucu.Alan;

namespace Sezgi.Sunucu.Veri;

public sealed class Ogretmen
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string KullaniciAdi { get; set; }
    public required string AdSoyad { get; set; }
    public string ParolaOzeti { get; set; } = "";
    public bool Yonetici { get; set; }
    public DateTime OlusturmaZamani { get; set; } = DateTime.UtcNow;
}

public enum OturumDurumu : byte
{
    Canli = 0,
    Bitti = 1,
}

public sealed class Oturum
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OgretmenId { get; set; }
    public Ogretmen? Ogretmen { get; set; }
    public required string Baslik { get; set; }
    public string? SinifAdi { get; set; }
    public required string KatilimKodu { get; set; }
    public OturumDurumu Durum { get; set; } = OturumDurumu.Canli;
    public DateTime OlusturmaZamani { get; set; } = DateTime.UtcNow;
    public DateTime? BitisZamani { get; set; }
    public OturumAyarlari Ayarlar { get; set; } = new();
    public List<Katilimci> Katilimcilar { get; set; } = [];
}

/// <summary>Bir ders oturumunun analiz ve uyarı ayarları. Oturum sürerken değiştirilebilir.</summary>
public sealed class OturumAyarlari
{
    /// <summary>Öğrenci istemcisinin sunucuya ölçüm gönderme aralığı.</summary>
    public int OrneklemeMs { get; set; } = 1000;

    /// <summary>Olumsuz bir ifadenin uyarıya dönüşmesi için kesintisiz sürmesi gereken süre.</summary>
    public int KalicilikSn { get; set; } = 20;

    /// <summary>Aynı öğrenci için aynı türde iki uyarı arasındaki en kısa süre.</summary>
    public int BeklemeSn { get; set; } = 120;

    public List<Duygu> IzlenenDuygular { get; set; } = [.. Duygular.Olumsuzlar];
    public bool DikkatIzle { get; set; } = true;
    public bool YoklukIzle { get; set; } = true;
    public bool UyuklamaIzle { get; set; } = true;

    /// <summary>Kural tetiklendiğinde öğrenciye destekleyici bir bildirim gönderilir.</summary>
    public bool DurtmeAcik { get; set; } = true;

    /// <summary>Öğrenci kendi anlık ifade tahminini görür.</summary>
    public bool OgrenciKendiniGorsun { get; set; } = true;

    /// <summary>Öğretmen panelinde ve raporlarda öğrenci adları gizlenir.</summary>
    public bool Anonim { get; set; }

    public OturumAyarlari Kopya() => new()
    {
        OrneklemeMs = OrneklemeMs,
        KalicilikSn = KalicilikSn,
        BeklemeSn = BeklemeSn,
        IzlenenDuygular = [.. IzlenenDuygular],
        DikkatIzle = DikkatIzle,
        YoklukIzle = YoklukIzle,
        UyuklamaIzle = UyuklamaIzle,
        DurtmeAcik = DurtmeAcik,
        OgrenciKendiniGorsun = OgrenciKendiniGorsun,
        Anonim = Anonim,
    };

    public void Dogrula()
    {
        OrneklemeMs = Math.Clamp(OrneklemeMs, 500, 10_000);
        KalicilikSn = Math.Clamp(KalicilikSn, 5, 600);
        BeklemeSn = Math.Clamp(BeklemeSn, 15, 3600);
        IzlenenDuygular = [.. IzlenenDuygular.Where(d => d.OlumsuzMu()).Distinct()];
    }
}

public enum KatilimciKaynagi : byte
{
    /// <summary>Öğrenci kendi cihazında kamerasıyla katıldı.</summary>
    Kamera = 0,

    /// <summary>Öğretmen ekranındaki video konferans galerisinden izlenen yüz.</summary>
    Galeri = 1,

    /// <summary>Tanıtım ve deneme amaçlı sanal öğrenci.</summary>
    Simulasyon = 2,
}

public sealed class Katilimci
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OturumId { get; set; }
    public required string Ad { get; set; }
    public int SiraNo { get; set; }
    public KatilimciKaynagi Kaynak { get; set; }

    /// <summary>Katılım jetonunun SHA-256 özeti; jetonun kendisi saklanmaz.</summary>
    public string? JetonOzeti { get; set; }

    /// <summary>Galeri kaynağında istemcinin verdiği iz kimliği.</summary>
    public string? DisKimlik { get; set; }

    public DateTime KatilmaZamani { get; set; } = DateTime.UtcNow;
    public DateTime? AyrilmaZamani { get; set; }
}

/// <summary>
/// Bir katılımcının belirli bir andaki ölçümü. Olasılıklar ve oranlar yer kazanmak için
/// yüzde (0-100) olarak saklanır.
/// </summary>
public sealed class Okuma
{
    public long Id { get; set; }
    public Guid OturumId { get; set; }
    public Guid KatilimciId { get; set; }
    public long ZamanMs { get; set; }
    public byte Notr { get; set; }
    public byte Mutlu { get; set; }
    public byte Saskin { get; set; }
    public byte Uzgun { get; set; }
    public byte Ofkeli { get; set; }
    public byte Korku { get; set; }
    public byte Igrenme { get; set; }
    public byte Dikkat { get; set; }
    public byte Goz { get; set; }
    public bool Yuz { get; set; }

    public float[] Olasiliklar() =>
        [Notr / 100f, Mutlu / 100f, Saskin / 100f, Uzgun / 100f, Ofkeli / 100f, Korku / 100f, Igrenme / 100f];

    public static Okuma Olustur(Guid oturumId, Guid katilimciId, long zamanMs, ReadOnlySpan<float> d,
        float dikkat, float goz, bool yuz) => new()
    {
        OturumId = oturumId,
        KatilimciId = katilimciId,
        ZamanMs = zamanMs,
        Notr = Yuzde(d[0]),
        Mutlu = Yuzde(d[1]),
        Saskin = Yuzde(d[2]),
        Uzgun = Yuzde(d[3]),
        Ofkeli = Yuzde(d[4]),
        Korku = Yuzde(d[5]),
        Igrenme = Yuzde(d[6]),
        Dikkat = Yuzde(dikkat),
        Goz = Yuzde(goz),
        Yuz = yuz,
    };

    private static byte Yuzde(float deger) => (byte)Math.Clamp((int)MathF.Round(deger * 100f), 0, 100);
}

public enum UyariTuru : byte
{
    OlumsuzIfade = 0,
    DikkatDagildi = 1,
    KameradaYok = 2,
    Uyuklama = 3,
    SinifOlumsuz = 4,
    SinifDikkat = 5,
    OgretmenMesaji = 6,
}

public sealed class Uyari
{
    public long Id { get; set; }
    public Guid OturumId { get; set; }
    public Guid? KatilimciId { get; set; }
    public UyariTuru Tur { get; set; }
    public Duygu? Duygu { get; set; }
    public required string Mesaj { get; set; }
    public float? Oran { get; set; }
    public bool OgrenciyeIletildi { get; set; }
    public DateTime Zaman { get; set; } = DateTime.UtcNow;
}
