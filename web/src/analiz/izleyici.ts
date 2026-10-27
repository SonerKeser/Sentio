import type { GaleriOkumasi } from '../api/turler';
import { Toplayici, type YuzOlcumu } from './olcum';

export type Kutu = [x: number, y: number, w: number, h: number];

export interface GaleriYuzu {
  kutu: Kutu;
  skor: number;
  embedding?: number[];
  olcum: YuzOlcumu;
}

export interface Iz {
  id: string;
  ad: string;
  kutu: Kutu;
  embedding?: number[];
  sonGorulme: number;
  ilkGorulme: number;
  kareSayisi: number;
  sonOlcum: YuzOlcumu;
  toplayici: Toplayici;
}

export function kesisimOrani(a: Kutu, b: Kutu): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const kesisim = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const birlesim = a[2] * a[3] + b[2] * b[3] - kesisim;
  return birlesim > 0 ? kesisim / birlesim : 0;
}

/** Döşemeli taramada komşu döşemelerde iki kez bulunan yüzleri birleştirir (en yüksek skor kalır). */
export function cakisanlariAyikla(yuzler: GaleriYuzu[], esik = 0.35): GaleriYuzu[] {
  const sirali = [...yuzler].sort((a, b) => b.skor - a.skor);
  const kalan: GaleriYuzu[] = [];
  for (const y of sirali) {
    if (kalan.every((k) => kesisimOrani(k.kutu, y.kutu) < esik && !icindeMi(y.kutu, k.kutu))) kalan.push(y);
  }
  return kalan;
}

function icindeMi(ic: Kutu, dis: Kutu): boolean {
  const merkezX = ic[0] + ic[2] / 2;
  const merkezY = ic[1] + ic[3] / 2;
  return merkezX > dis[0] && merkezX < dis[0] + dis[2] && merkezY > dis[1] && merkezY < dis[1] + dis[3];
}

/**
 * Video konferans galerisindeki yüzleri kareler arasında izler. Eşleştirme, yüz tanımlayıcısı
 * benzerliği ve kutu çakışmasının birleşimiyle yapılır; tanımlayıcılar yalnızca tarayıcı belleğinde tutulur.
 */
export class GaleriIzleyici {
  readonly izler = new Map<string, Iz>();
  private sayac = 0;

  constructor(
    private readonly benzerlik: (a: number[], b: number[]) => number,
    private readonly esik = 0.5,
    private readonly unutmaMs = 120_000,
  ) {}

  guncelle(yuzler: GaleriYuzu[], zaman: number): Iz[] {
    const adaylar: { iz: Iz; yuz: GaleriYuzu; puan: number }[] = [];
    for (const yuz of yuzler) {
      for (const iz of this.izler.values()) {
        const cakisma = kesisimOrani(yuz.kutu, iz.kutu);
        let puan: number;
        if (yuz.embedding && iz.embedding) {
          // Tanımlayıcı belirleyicidir; aynı yerde kalmak yalnızca küçük bir ek puan getirir.
          // Böylece galeri düzeni değişip kişiler yer değiştirdiğinde kimlikler karışmaz.
          const benzer = this.benzerlik(yuz.embedding, iz.embedding);
          if (benzer < 0.3) continue;
          puan = benzer + (cakisma > 0.3 ? 0.15 : 0);
        } else {
          puan = cakisma > 0.3 ? 0.45 + cakisma * 0.5 : 0;
        }
        if (puan >= this.esik) adaylar.push({ iz, yuz, puan });
      }
    }
    adaylar.sort((a, b) => b.puan - a.puan);

    const kullanilanIz = new Set<string>();
    const kullanilanYuz = new Set<GaleriYuzu>();
    const gorulen: Iz[] = [];
    for (const { iz, yuz } of adaylar) {
      if (kullanilanIz.has(iz.id) || kullanilanYuz.has(yuz)) continue;
      kullanilanIz.add(iz.id);
      kullanilanYuz.add(yuz);
      this.isle(iz, yuz, zaman);
      gorulen.push(iz);
    }

    for (const yuz of yuzler) {
      if (kullanilanYuz.has(yuz)) continue;
      this.sayac++;
      const iz: Iz = {
        id: `iz-${Date.now().toString(36)}-${this.sayac}`,
        ad: `Yüz ${this.sayac}`,
        kutu: yuz.kutu,
        embedding: yuz.embedding ? [...yuz.embedding] : undefined,
        sonGorulme: zaman,
        ilkGorulme: zaman,
        kareSayisi: 0,
        sonOlcum: yuz.olcum,
        toplayici: new Toplayici(),
      };
      this.izler.set(iz.id, iz);
      this.isle(iz, yuz, zaman);
      gorulen.push(iz);
    }

    for (const [id, iz] of this.izler) {
      if (zaman - iz.sonGorulme > this.unutmaMs) this.izler.delete(id);
      else if (!kullanilanIz.has(id) && !gorulen.includes(iz)) iz.toplayici.ekle(null);
    }
    return gorulen;
  }

  adDegistir(id: string, ad: string) {
    const iz = this.izler.get(id);
    if (iz) iz.ad = ad;
  }

  /**
   * Toplanan kareleri sunucuya gidecek okumalara dönüştürür. Tek karelik hayalet tespitler
   * (ör. ekrandaki bir fotoğraf) en az üç kare görülene dek gönderilmez.
   */
  okumalar(): GaleriOkumasi[] {
    const sonuc: GaleriOkumasi[] = [];
    for (const iz of this.izler.values()) {
      const okuma = iz.toplayici.bosalt();
      if (okuma && iz.kareSayisi >= 3) sonuc.push({ izKimligi: iz.id, ad: iz.ad, okuma });
    }
    return sonuc;
  }

  private isle(iz: Iz, yuz: GaleriYuzu, zaman: number) {
    iz.kutu = yuz.kutu;
    iz.sonGorulme = zaman;
    iz.kareSayisi++;
    iz.sonOlcum = yuz.olcum;
    iz.toplayici.ekle(yuz.olcum);
    if (yuz.embedding) {
      // Tanımlayıcıyı yavaşça güncelle: ışık ve açı değişimlerine uyum sağlar, kimlik kaymaz.
      iz.embedding = iz.embedding ? iz.embedding.map((v, i) => v * 0.9 + (yuz.embedding![i] ?? v) * 0.1) : [...yuz.embedding];
    }
  }
}
