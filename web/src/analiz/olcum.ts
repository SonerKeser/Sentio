import { DUYGULAR, HUMAN_ESLEME } from '../alan/duygular';
import type { OkumaGirdisi } from '../api/turler';

/** Tek bir karede tek bir yüzden çıkarılan ölçüm. */
export interface YuzOlcumu {
  d: number[];
  dikkat: number;
  goz: number;
  yawDerece: number;
  pitchDerece: number;
}

type Nokta = readonly (number | undefined)[];

const sinirla = (x: number, alt = 0, ust = 1) => Math.min(ust, Math.max(alt, x));
const derece = (radyan: number) => (radyan * 180) / Math.PI;

/** Human'ın ifade listesini Sentio sırasında, toplamı 1 olan 7'li olasılık dizisine çevirir. */
export function olasiliklar(liste: readonly { score: number; emotion: string }[] | undefined): number[] {
  const d = new Array<number>(DUYGULAR.length).fill(0);
  for (const { score, emotion } of liste ?? []) {
    const duygu = HUMAN_ESLEME[emotion];
    if (duygu && Number.isFinite(score)) d[DUYGULAR.indexOf(duygu)] += Math.max(0, score);
  }
  const toplam = d.reduce((a, b) => a + b, 0);
  if (toplam <= 0) {
    d[0] = 1;
    return d;
  }
  return d.map((x) => x / toplam);
}

const uzaklik = (a: Nokta, b: Nokta) => Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));

// MediaPipe yüz ağı (468 nokta) üzerinde göz köşeleri ve kapak noktaları.
const SOL_GOZ = [33, 160, 158, 133, 153, 144] as const;
const SAG_GOZ = [362, 385, 387, 263, 373, 380] as const;

/** Göz en-boy oranı (EAR): açık gözde ~0.28, kapalı gözde ~0.08. */
export function gozOrani(mesh: readonly Nokta[], noktalar: readonly number[]): number {
  const [p1, p2, p3, p4, p5, p6] = noktalar.map((i) => mesh[i]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return Number.NaN;
  const yatay = uzaklik(p1, p4);
  return yatay > 0 ? (uzaklik(p2, p6) + uzaklik(p3, p5)) / (2 * yatay) : Number.NaN;
}

/** İki gözün ortalama açıklığı, 0 (kapalı) ile 1 (tam açık) arasında. */
export function gozAcikligi(mesh: readonly Nokta[] | undefined): number {
  if (!mesh || mesh.length < 400) return 1;
  const oranlar = [gozOrani(mesh, SOL_GOZ), gozOrani(mesh, SAG_GOZ)].filter(Number.isFinite);
  if (oranlar.length === 0) return 1;
  const ear = oranlar.reduce((a, b) => a + b, 0) / oranlar.length;
  return sinirla((ear - 0.12) / (0.25 - 0.12));
}

/**
 * Dikkat tahmini: ekrana dönük baş, merkeze yakın bakış ve açık gözler.
 * Açılar kişinin doğal oturuş açısına (taban) göre verilir; kamera ekranın üstünde olduğundan
 * herkes biraz aşağı bakar ve bu dikkat kaybı sayılmamalıdır.
 */
export function dikkatHesapla(yawSapma: number, pitchSapma: number, bakisGucu: number, goz: number): number {
  const yaw = sinirla(1 - (Math.abs(yawSapma) - 15) / (40 - 15));
  const pitch = sinirla(1 - (Math.abs(pitchSapma) - 12) / (32 - 12));
  const bakis = 1 - 0.45 * sinirla((bakisGucu - 0.35) / 0.5);
  const gozCarpani = goz < 0.25 ? 0.35 : 1;
  return sinirla(yaw * pitch * bakis * gozCarpani);
}

/** Kişinin ekrana bakarken aldığı doğal baş açısını yavaşça öğrenir. */
export class DurusTabani {
  private yaw = 0;
  private pitch = 0;
  private adet = 0;

  guncelle(yawDerece: number, pitchDerece: number) {
    // İlk 30 karede hızlı, sonra çok yavaş uyum: kısa süreli yana bakışlar tabanı bozmaz.
    const alfa = this.adet < 30 ? 1 / (this.adet + 1) : 0.004;
    this.yaw += alfa * (yawDerece - this.yaw);
    this.pitch += alfa * (pitchDerece - this.pitch);
    this.adet++;
  }

  sapma(yawDerece: number, pitchDerece: number): [number, number] {
    return this.adet < 5 ? [yawDerece, pitchDerece] : [yawDerece - this.yaw, pitchDerece - this.pitch];
  }
}

export interface HumanYuzu {
  emotion?: { score: number; emotion: string }[];
  mesh?: Nokta[];
  rotation?: { angle: { yaw: number; pitch: number }; gaze: { strength: number } } | null;
}

export function yuzOlcumu(yuz: HumanYuzu, taban?: DurusTabani): YuzOlcumu {
  const yawDerece = derece(yuz.rotation?.angle.yaw ?? 0);
  const pitchDerece = derece(yuz.rotation?.angle.pitch ?? 0);
  const goz = gozAcikligi(yuz.mesh);
  const [yawSapma, pitchSapma] = taban ? taban.sapma(yawDerece, pitchDerece) : [yawDerece, pitchDerece];
  const dikkat = dikkatHesapla(yawSapma, pitchSapma, yuz.rotation?.gaze.strength ?? 0, goz);
  if (taban && dikkat > 0.5) taban.guncelle(yawDerece, pitchDerece);
  return { d: olasiliklar(yuz.emotion), dikkat, goz, yawDerece, pitchDerece };
}

/** Bir örnekleme aralığındaki karelerin ortalamasını sunucuya gidecek tek ölçüme dönüştürür. */
export class Toplayici {
  private d = new Array<number>(DUYGULAR.length).fill(0);
  private dikkat = 0;
  private goz = 0;
  private yuzlu = 0;
  private toplam = 0;

  ekle(olcum: YuzOlcumu | null) {
    this.toplam++;
    if (!olcum) return;
    this.yuzlu++;
    olcum.d.forEach((x, i) => (this.d[i] += x));
    this.dikkat += olcum.dikkat;
    this.goz += olcum.goz;
  }

  get bos() {
    return this.toplam === 0;
  }

  /** Yüzün karelerin en az üçte birinde görünmesi gerekir; aksi halde "yüz yok" sayılır. */
  bosalt(): OkumaGirdisi | null {
    if (this.toplam === 0) return null;
    const yuz = this.yuzlu > 0 && this.yuzlu / this.toplam >= 1 / 3;
    const sonuc: OkumaGirdisi = yuz
      ? {
          d: this.d.map((x) => yuvarla(x / this.yuzlu)),
          dikkat: yuvarla(this.dikkat / this.yuzlu),
          goz: yuvarla(this.goz / this.yuzlu),
          yuz: true,
        }
      : { d: [1, 0, 0, 0, 0, 0, 0], dikkat: 0, goz: 0, yuz: false };
    this.d.fill(0);
    this.dikkat = this.goz = this.yuzlu = this.toplam = 0;
    return sonuc;
  }
}

const yuvarla = (x: number) => Math.round(x * 1000) / 1000;
