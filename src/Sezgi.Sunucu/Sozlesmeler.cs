using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu;

// İstemcilerle paylaşılan veri sözleşmeleri. Web istemcisindeki web/src/api/turler.ts ile birebir eşleşir.

public sealed record OgretmenBilgisi(Guid Id, string KullaniciAdi, string AdSoyad, bool Yonetici);

public sealed record HesapDurumu(bool KurulumGerekli, OgretmenBilgisi? Ogretmen, string Surum);

public sealed record KurulumIstegi(string KullaniciAdi, string AdSoyad, string Parola);

public sealed record GirisIstegi(string KullaniciAdi, string Parola);

public sealed record ParolaDegistirmeIstegi(string Mevcut, string Yeni);

public sealed record OgretmenEklemeIstegi(string KullaniciAdi, string AdSoyad, string Parola, bool Yonetici);

public sealed record OturumOlusturmaIstegi(string Baslik, string? SinifAdi, OturumAyarlari? Ayarlar);

public sealed record OturumOzeti(
    Guid Id,
    string Baslik,
    string? SinifAdi,
    string KatilimKodu,
    OturumDurumu Durum,
    DateTime OlusturmaZamani,
    DateTime? BitisZamani,
    int KatilimciSayisi,
    int AktifSayisi,
    int UyariSayisi);

public sealed record OturumDetayi(
    Guid Id,
    string Baslik,
    string? SinifAdi,
    string KatilimKodu,
    OturumDurumu Durum,
    DateTime OlusturmaZamani,
    DateTime? BitisZamani,
    OturumAyarlari Ayarlar,
    string OgretmenAdi,
    bool SimulasyonCalisiyor);

public sealed record SimulasyonIstegi(int KisiSayisi);

// Öğrenci tarafı

public sealed record KatilimOnizleme(string Baslik, string? SinifAdi, string OgretmenAdi);

public sealed record KatilimIstegi(string Kod, string Ad);

public sealed record OgrenciAyarlari(int OrneklemeMs, bool OgrenciKendiniGorsun, bool DurtmeAcik);

public sealed record KatilimYaniti(
    Guid KatilimciId,
    string Jeton,
    Guid OturumId,
    string Baslik,
    string? SinifAdi,
    string OgretmenAdi,
    string Ad,
    OgrenciAyarlari Ayarlar);

/// <summary>Öğrenci istemcisinin her örnekleme aralığında gönderdiği ölçüm.</summary>
/// <param name="D">Duygu olasılıkları; <see cref="Duygu"/> sırasıyla 7 değer.</param>
/// <param name="Dikkat">0-1 arası dikkat tahmini (baş yönü ve bakış).</param>
/// <param name="Goz">0-1 arası göz açıklığı.</param>
/// <param name="Yuz">Karede yüz bulundu mu.</param>
public sealed record OkumaGirdisi(float[] D, float Dikkat, float Goz, bool Yuz);

public sealed record DurtmeBildirimi(string Tur, Duygu? Duygu, string? Metin, string Gonderen, DateTime Zaman);

// Galeri (ekran) analizi: öğretmen tarayıcısı izlediği yüzlerin ölçümlerini toplu gönderir.

public sealed record GaleriOkumasi(string IzKimligi, string Ad, OkumaGirdisi Okuma);

// Canlı yayın

public sealed record KatilimciAnligi(
    Guid Id,
    string Ad,
    KatilimciKaynagi Kaynak,
    string Durum,
    float[] Duygular,
    Duygu Baskin,
    float Dikkat,
    float Goz,
    bool Yuz,
    float Valans,
    float Katilim,
    float[] Iz,
    long? SonOkumaMs,
    Duygu? UyariDuygusu,
    int UyariSayisi,
    string? DisKimlik);

public sealed record SinifOzeti(
    int Toplam,
    int Aktif,
    float[] Dagilim,
    Duygu? Baskin,
    float Dikkat,
    float Valans,
    float Katilim,
    float OlumsuzOran);

public sealed record AnlikGoruntu(Guid OturumId, long ZamanMs, SinifOzeti Sinif, IReadOnlyList<KatilimciAnligi> Katilimcilar);

public sealed record UyariBildirimi(
    long Id,
    Guid? KatilimciId,
    string? KatilimciAdi,
    UyariTuru Tur,
    Duygu? Duygu,
    string Mesaj,
    float? Oran,
    bool OgrenciyeIletildi,
    DateTime Zaman);

public sealed record IzlemeBaslangici(OturumDetayi Oturum, AnlikGoruntu Anlik, IReadOnlyList<UyariBildirimi> Uyarilar);

public sealed record SistemBilgisi(string Ad, string Surum, IReadOnlyList<string> Adresler, IReadOnlyList<IndirmeDosyasi> Indirmeler);

public sealed record IndirmeDosyasi(string Ad, long Boyut, string Adres);
