// Sunucudaki Sozlesmeler.cs ve Raporlar/RaporOlusturucu.cs kayıtlarının TypeScript karşılıkları.
import type { Duygu } from '../alan/duygular';

export type OturumDurumu = 'canli' | 'bitti';
export type KatilimciKaynagi = 'kamera' | 'galeri' | 'simulasyon';
export type KatilimciDurumu = 'aktif' | 'duraklatildi' | 'bekliyor' | 'cevrimdisi' | 'ayrildi' | 'molada';
export type SinyalTuru = 'anlamadim' | 'soru' | 'yavasla';
export type YoklamaTuru = 'anlama' | 'evetHayir' | 'coktan' | 'puan';
export type UyariTuru =
  | 'olumsuzIfade'
  | 'dikkatDagildi'
  | 'kameradaYok'
  | 'uyuklama'
  | 'sinifOlumsuz'
  | 'sinifDikkat'
  | 'sinifAnlamadi'
  | 'ogretmenMesaji';

export interface OgretmenBilgisi {
  id: string;
  kullaniciAdi: string;
  adSoyad: string;
  yonetici: boolean;
}

export interface HesapDurumu {
  kurulumGerekli: boolean;
  ogretmen: OgretmenBilgisi | null;
  surum: string;
}

export interface OturumAyarlari {
  orneklemeMs: number;
  kalicilikSn: number;
  beklemeSn: number;
  izlenenDuygular: Duygu[];
  dikkatIzle: boolean;
  yoklukIzle: boolean;
  uyuklamaIzle: boolean;
  durtmeAcik: boolean;
  ogrenciKendiniGorsun: boolean;
  anonim: boolean;
}

export interface OturumOzeti {
  id: string;
  baslik: string;
  sinifAdi: string | null;
  katilimKodu: string;
  durum: OturumDurumu;
  olusturmaZamani: string;
  bitisZamani: string | null;
  katilimciSayisi: number;
  aktifSayisi: number;
  uyariSayisi: number;
}

export interface OturumDetayi {
  id: string;
  baslik: string;
  sinifAdi: string | null;
  katilimKodu: string;
  durum: OturumDurumu;
  olusturmaZamani: string;
  bitisZamani: string | null;
  ayarlar: OturumAyarlari;
  ogretmenAdi: string;
  simulasyonCalisiyor: boolean;
}

export interface KatilimOnizleme {
  baslik: string;
  sinifAdi: string | null;
  ogretmenAdi: string;
}

export interface OgrenciAyarlari {
  orneklemeMs: number;
  ogrenciKendiniGorsun: boolean;
  durtmeAcik: boolean;
}

export interface KatilimYaniti {
  katilimciId: string;
  jeton: string;
  oturumId: string;
  baslik: string;
  sinifAdi: string | null;
  ogretmenAdi: string;
  ad: string;
  ayarlar: OgrenciAyarlari;
}

export interface OkumaGirdisi {
  d: number[];
  dikkat: number;
  goz: number;
  yuz: boolean;
}

export interface DurtmeBildirimi {
  tur: UyariTuru;
  duygu: Duygu | null;
  metin: string | null;
  gonderen: string;
  zaman: string;
}

export interface GaleriOkumasi {
  izKimligi: string;
  ad: string;
  okuma: OkumaGirdisi;
}

export interface KatilimciAnligi {
  id: string;
  ad: string;
  kaynak: KatilimciKaynagi;
  durum: KatilimciDurumu;
  duygular: number[];
  baskin: Duygu;
  dikkat: number;
  goz: number;
  yuz: boolean;
  valans: number;
  katilim: number;
  iz: number[];
  sonOkumaMs: number | null;
  uyariDuygusu: Duygu | null;
  uyariSayisi: number;
  disKimlik: string | null;
  sinyal: SinyalTuru | null;
}

export interface SinifOzeti {
  toplam: number;
  aktif: number;
  dagilim: number[];
  baskin: Duygu | null;
  dikkat: number;
  valans: number;
  katilim: number;
  olumsuzOran: number;
}

export interface AnlikGoruntu {
  oturumId: string;
  zamanMs: number;
  sinif: SinifOzeti;
  katilimcilar: KatilimciAnligi[];
  etkilesim: EtkilesimDurumu;
}

// Etkileşim

export interface SinyalBildirimi {
  id: number;
  katilimciId: string;
  ad: string;
  tur: SinyalTuru;
  metin: string | null;
  zamanMs: number;
}

export interface YoklamaDurumu {
  id: string;
  tur: YoklamaTuru;
  soru: string;
  secenekler: string[];
  sayilar: number[];
  yanitlayan: number;
  baslangicMs: number;
}

export interface BolumDurumu {
  id: number;
  ad: string;
  mola: boolean;
  baslangicMs: number;
  bitisMs: number | null;
  molaBitisMs: number | null;
}

export interface EtkilesimDurumu {
  sorular: SinyalBildirimi[];
  anlamadim: number;
  yavasla: number;
  yoklama: YoklamaDurumu | null;
  bolum: BolumDurumu | null;
  bolumler: BolumDurumu[];
}

export interface YoklamaBildirimi {
  id: string;
  tur: YoklamaTuru;
  soru: string;
  secenekler: string[];
  secim: number | null;
}

export interface MolaBildirimi {
  bitisMs: number;
}

export interface OgrenciDurumu {
  ayarlar: OgrenciAyarlari;
  yoklama: YoklamaBildirimi | null;
  mola: MolaBildirimi | null;
  acikSinyaller: SinyalTuru[];
}

export interface SunucuDurumu {
  surum: string;
  calismaSuresiSn: number;
  canliDers: number;
  cevrimiciOgrenci: number;
  veritabaniBayt: number;
  ogretmenSayisi: number;
  dersSayisi: number;
  olcumSayisi: number;
}

// Dönem analitiği

export interface AnalitikDers {
  id: string;
  baslik: string;
  sinifAdi: string | null;
  tarih: string;
  sureSn: number;
  katilimciSayisi: number;
  dikkat: number;
  katilim: number;
  valans: number;
  olumsuzOran: number;
  dagilim: number[];
  anlamaOrani: number | null;
  uyariSayisi: number;
  anlamadimSayisi: number;
  soruSayisi: number;
}

export interface AnalitikOgrenci {
  ad: string;
  dersSayisi: number;
  dikkat: number;
  katilim: number;
  valans: number;
  yuzOrani: number;
  baskin: Duygu | null;
  uyariSayisi: number;
  anlamadimSayisi: number;
  egilim: { oturumId: string; katilim: number; dikkat: number }[];
}

export interface Analitik {
  siniflar: { ad: string | null; dersSayisi: number }[];
  seciliSinif: string | null;
  ozet: { dersSayisi: number; toplamSureSn: number; dikkat: number; katilim: number; anlamaOrani: number | null; ogrenciSayisi: number };
  dersler: AnalitikDers[];
  ogrenciler: AnalitikOgrenci[];
}

export interface UyariBildirimi {
  id: number;
  katilimciId: string | null;
  katilimciAdi: string | null;
  tur: UyariTuru;
  duygu: Duygu | null;
  mesaj: string;
  oran: number | null;
  ogrenciyeIletildi: boolean;
  zaman: string;
}

export interface IzlemeBaslangici {
  oturum: OturumDetayi;
  anlik: AnlikGoruntu;
  uyarilar: UyariBildirimi[];
}

export interface IndirmeDosyasi {
  ad: string;
  boyut: number;
  adres: string;
}

export interface SistemBilgisi {
  ad: string;
  surum: string;
  adresler: string[];
  indirmeler: IndirmeDosyasi[];
}

// Rapor

export interface RaporKatilimci {
  id: string;
  ad: string;
  kaynak: KatilimciKaynagi;
  sureSn: number;
  okumaSayisi: number;
  yuzOrani: number;
  dagilim: number[];
  baskinOranlari: number[];
  baskin: Duygu | null;
  dikkat: number;
  valans: number;
  katilim: number;
  uyariSayisi: number;
  anlamadimSayisi: number;
  soruSayisi: number;
}

export interface RaporBolum {
  id: number;
  ad: string;
  mola: boolean;
  baslangicMs: number;
  bitisMs: number;
  aktif: number;
  dagilim: number[];
  dikkat: number;
  olumsuzOran: number;
  anlamadim: number;
  soru: number;
}

export interface RaporYoklama {
  id: string;
  tur: YoklamaTuru;
  soru: string;
  secenekler: string[];
  sayilar: number[];
  yanitlayan: number;
  katilimci: number;
  zamanMs: number;
  anlamaOrani: number | null;
  ortalama: number | null;
}

export interface RaporSinyal {
  id: number;
  katilimciId: string;
  ad: string;
  tur: SinyalTuru;
  metin: string | null;
  zamanMs: number;
  yanitlandi: boolean;
}

export interface RaporDilim {
  zamanMs: number;
  aktif: number;
  dagilim: number[];
  dikkat: number;
  valans: number;
  olumsuzOran: number;
}

export interface Rapor {
  oturum: {
    id: string;
    baslik: string;
    sinifAdi: string | null;
    ogretmenAdi: string;
    baslangic: string;
    bitis: string | null;
    durum: OturumDurumu;
    sureSn: number;
    anonim: boolean;
  };
  sinif: {
    katilimciSayisi: number;
    okumaSayisi: number;
    dagilim: number[];
    baskin: Duygu | null;
    dikkat: number;
    valans: number;
    katilim: number;
    yuzOrani: number;
    uyariSayisi: number;
  };
  katilimcilar: RaporKatilimci[];
  zaman: {
    aralikSn: number;
    dilimler: RaporDilim[];
    isiHaritasi: { katilimciId: string; ad: string; hucreler: number[] }[];
  };
  onemliAnlar: { zamanMs: number; tur: 'olumsuz' | 'olumlu' | 'dikkat'; aciklama: string; deger: number }[];
  uyarilar: UyariBildirimi[];
  etkilesim: {
    bolumler: RaporBolum[];
    yoklamalar: RaporYoklama[];
    sinyaller: RaporSinyal[];
    anlamadim: number;
    soru: number;
    yavasla: number;
    anlamaOrani: number | null;
  };
}
