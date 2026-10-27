using System.Collections.Concurrent;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Canli;

public sealed class CanliKatilimci(Guid id, Guid oturumId, string ad, int siraNo, KatilimciKaynagi kaynak, string? disKimlik)
{
    /// <summary>Yumuşatma katsayısı (üstel hareketli ortalama).</summary>
    public const float Alfa = 0.35f;

    /// <summary>Bu süreden uzun ölçüm gelmeyen katılımcı aktif sayılmaz.</summary>
    public const long AktiflikMs = 10_000;

    public Guid Id { get; } = id;
    public Guid OturumId { get; } = oturumId;
    public string Ad { get; set; } = ad;
    public int SiraNo { get; } = siraNo;
    public KatilimciKaynagi Kaynak { get; } = kaynak;
    public string? DisKimlik { get; } = disKimlik;

    public Lock Kilit { get; } = new();
    public int BaglantiSayisi { get; set; }
    public bool Duraklatildi { get; set; }
    public bool Ayrildi { get; set; }
    public long? SonOkumaMs { get; set; }
    public float[] Yumusak { get; } = [1f, 0, 0, 0, 0, 0, 0];
    public float Dikkat { get; set; }
    public float Goz { get; set; } = 1f;
    public bool Yuz { get; set; }
    public HalkaTampon<OlcumKaydi> Gecmis { get; } = new(300);
    public KuralDurumu Kural { get; } = new();
    public Duygu? UyariDuygusu { get; set; }
    public int UyariSayisi { get; set; }

    /// <summary>Sinyal gönderme hız sınırı için son sinyal zamanı.</summary>
    public long SonSinyalMs { get; set; }

    public string GorunenAd(bool anonim) => anonim ? $"Katılımcı {SiraNo}" : Ad;

    /// <summary>Kilit altında çağrılmalıdır.</summary>
    public string Durum(long simdiMs)
    {
        if (Ayrildi) return "ayrildi";
        if (Kaynak == KatilimciKaynagi.Kamera && BaglantiSayisi <= 0) return "cevrimdisi";
        if (Duraklatildi) return "duraklatildi";
        if (SonOkumaMs is null) return "bekliyor";
        if (simdiMs - SonOkumaMs > AktiflikMs) return Kaynak == KatilimciKaynagi.Kamera ? "bekliyor" : "cevrimdisi";
        return "aktif";
    }

    /// <summary>Kilit altında çağrılmalıdır. Yeni ölçümü yumuşatılmış duruma işler ve geçmişe ekler.</summary>
    public OlcumKaydi Isle(ReadOnlySpan<float> olasiliklar, float dikkat, float goz, bool yuz, long zamanMs)
    {
        if (yuz)
        {
            var ilk = SonOkumaMs is null || !Yuz;
            for (var i = 0; i < Duygular.Sayi; i++)
            {
                Yumusak[i] = ilk ? olasiliklar[i] : Yumusak[i] + Alfa * (olasiliklar[i] - Yumusak[i]);
            }
            Dikkat = ilk ? dikkat : Dikkat + Alfa * (dikkat - Dikkat);
            // Tek bir göz kırpması "gözleri kapalı" görünmesin; uyuklama kuralı ham değerlere bakar.
            Goz = ilk ? goz : Goz + Alfa * (goz - Goz);
        }
        else
        {
            Dikkat += Alfa * (0f - Dikkat);
        }
        Yuz = yuz;
        SonOkumaMs = zamanMs;

        var baskin = Duygular.Baskin(Yumusak);
        var kayit = new OlcumKaydi(zamanMs, baskin, Yumusak[(int)baskin], yuz ? dikkat : 0f, goz, yuz, Duygular.Valans(Yumusak));
        Gecmis.Ekle(kayit);
        if (UyariDuygusu is { } d && (!yuz || baskin != d)) UyariDuygusu = null;
        return kayit;
    }
}

public sealed class CanliYoklama(Guid id, YoklamaTuru tur, string soru, string[] secenekler, long baslangicMs)
{
    public Guid Id { get; } = id;
    public YoklamaTuru Tur { get; } = tur;
    public string Soru { get; } = soru;
    public string[] Secenekler { get; } = secenekler;
    public long BaslangicMs { get; } = baslangicMs;
    public ConcurrentDictionary<Guid, int> Yanitlar { get; } = new();

    public int[] Sayilar()
    {
        var sayilar = new int[Secenekler.Length];
        foreach (var secim in Yanitlar.Values)
        {
            if (secim >= 0 && secim < sayilar.Length) sayilar[secim]++;
        }
        return sayilar;
    }
}

public sealed record CanliSinyal(long Id, Guid KatilimciId, SinyalTuru Tur, string? Metin, long ZamanMs);

public sealed class CanliBolum(long id, string ad, bool mola, long baslangicMs, long? molaBitisMs)
{
    public long Id { get; } = id;
    public string Ad { get; } = ad;
    public bool Mola { get; } = mola;
    public long BaslangicMs { get; } = baslangicMs;
    public long? MolaBitisMs { get; } = molaBitisMs;
    public long? BitisMs { get; set; }

    public BolumDurumu Durum() => new(Id, Ad, Mola, BaslangicMs, BitisMs, MolaBitisMs);
}

public sealed class CanliOturum
{
    private int _siraNo;
    private readonly Queue<UyariBildirimi> _sonUyarilar = new();
    private readonly Lock _uyariKilidi = new();

    public CanliOturum(Oturum oturum, string ogretmenAdi)
    {
        Id = oturum.Id;
        OgretmenId = oturum.OgretmenId;
        Baslik = oturum.Baslik;
        SinifAdi = oturum.SinifAdi;
        KatilimKodu = oturum.KatilimKodu;
        OlusturmaZamani = oturum.OlusturmaZamani;
        OgretmenAdi = ogretmenAdi;
        Ayarlar = oturum.Ayarlar.Kopya();
        foreach (var k in oturum.Katilimcilar) _siraNo = Math.Max(_siraNo, k.SiraNo);
    }

    public Guid Id { get; }
    public Guid OgretmenId { get; }
    public string Baslik { get; }
    public string? SinifAdi { get; }
    public string KatilimKodu { get; }
    public DateTime OlusturmaZamani { get; }
    public string OgretmenAdi { get; }

    /// <summary>Ayarlar bütün olarak değiştirilir; okuyanlar her zaman tutarlı bir kopya görür.</summary>
    public OturumAyarlari Ayarlar { get; set; }

    public ConcurrentDictionary<Guid, CanliKatilimci> Katilimcilar { get; } = new();

    /// <summary>Galeri analizindeki iz kimliklerinin katılımcılara eşlemesi.</summary>
    public ConcurrentDictionary<string, Guid> GaleriIzleri { get; } = new();

    public SinifKuralDurumu SinifKural { get; } = new();

    public int Izleyici;

    /// <summary>Açık yoklama; aynı anda en fazla bir tane olur.</summary>
    public CanliYoklama? AktifYoklama { get; set; }

    /// <summary>Sinyaller ve bölümler bu kilitle korunur.</summary>
    public Lock EtkilesimKilidi { get; } = new();
    public List<CanliSinyal> Sinyaller { get; } = [];
    public List<CanliBolum> Bolumler { get; } = [];

    /// <summary>Mola sürüyorsa bitiş zamanı (unix ms), sürmüyorsa 0. Ölçüm hattı bunu kilitsiz okur.</summary>
    public long MolaBitisMs;

    public bool MoladaMi => Volatile.Read(ref MolaBitisMs) > 0;

    public int SonrakiSiraNo() => Interlocked.Increment(ref _siraNo);

    public void UyariEkle(UyariBildirimi uyari)
    {
        lock (_uyariKilidi)
        {
            _sonUyarilar.Enqueue(uyari);
            while (_sonUyarilar.Count > 100) _sonUyarilar.Dequeue();
        }
    }

    public IReadOnlyList<UyariBildirimi> SonUyarilar()
    {
        lock (_uyariKilidi) return [.. _sonUyarilar.Reverse()];
    }

    /// <summary>Verilerini silen öğrencinin adı canlı uyarı akışında da kalmasın.</summary>
    public void UyarilariKaldir(Guid katilimciId)
    {
        lock (_uyariKilidi)
        {
            var kalan = _sonUyarilar.Where(u => u.KatilimciId != katilimciId).ToList();
            _sonUyarilar.Clear();
            foreach (var u in kalan) _sonUyarilar.Enqueue(u);
        }
    }

    public void UyarilariYukle(IEnumerable<UyariBildirimi> eskidenYeniye)
    {
        foreach (var u in eskidenYeniye) UyariEkle(u);
    }
}
