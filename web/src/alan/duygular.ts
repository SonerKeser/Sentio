/**
 * Yüz ifadesi sınıfları. Sıra sunucudaki Duygu enum'uyla aynıdır ve ölçüm dizisi bu sırayla gönderilir.
 * "Korku" ve "İğrenme" sınıfları sınıf bağlamında daha anlaşılır olan "Kaygılı" ve "Hoşnutsuz" adlarıyla gösterilir.
 */
export const DUYGULAR = ['notr', 'mutlu', 'saskin', 'uzgun', 'ofkeli', 'korku', 'igrenme'] as const;
export type Duygu = (typeof DUYGULAR)[number];

export interface DuyguBilgisi {
  ad: string;
  sifat: string;
  renk: string;
  olumsuz: boolean;
  valans: number;
}

export const DUYGU: Record<Duygu, DuyguBilgisi> = {
  notr: { ad: 'Nötr', sifat: 'nötr', renk: '#9AA6C8', olumsuz: false, valans: 0 },
  mutlu: { ad: 'Mutlu', sifat: 'mutlu', renk: '#FFC94A', olumsuz: false, valans: 1 },
  saskin: { ad: 'Şaşkın', sifat: 'şaşkın', renk: '#FF7AD9', olumsuz: false, valans: 0.3 },
  uzgun: { ad: 'Üzgün', sifat: 'üzgün', renk: '#5AA9FF', olumsuz: true, valans: -0.8 },
  ofkeli: { ad: 'Öfkeli', sifat: 'öfkeli', renk: '#FF6B5E', olumsuz: true, valans: -0.9 },
  korku: { ad: 'Kaygılı', sifat: 'kaygılı', renk: '#A784FF', olumsuz: true, valans: -0.7 },
  igrenme: { ad: 'Hoşnutsuz', sifat: 'hoşnutsuz', renk: '#7BDB8A', olumsuz: true, valans: -0.8 },
};

/** Grafiklerde alttan üste sıra: olumlular, nötr, olumsuzlar. Olumsuz ifadeler yükseldikçe üst kenardan aşağı doğru büyür. */
export const YIGIN_SIRASI: Duygu[] = ['mutlu', 'saskin', 'notr', 'igrenme', 'korku', 'uzgun', 'ofkeli'];

/** Human kütüphanesinin sınıf adlarından Sentio sırasına eşleme. */
export const HUMAN_ESLEME: Record<string, Duygu> = {
  neutral: 'notr',
  happy: 'mutlu',
  surprise: 'saskin',
  sad: 'uzgun',
  angry: 'ofkeli',
  fear: 'korku',
  disgust: 'igrenme',
};

export function baskin(olasiliklar: readonly number[]): Duygu {
  let enIyi = 0;
  for (let i = 1; i < DUYGULAR.length; i++) if ((olasiliklar[i] ?? 0) > (olasiliklar[enIyi] ?? 0)) enIyi = i;
  return DUYGULAR[enIyi];
}

export function valans(olasiliklar: readonly number[]): number {
  let toplam = 0;
  DUYGULAR.forEach((d, i) => (toplam += (olasiliklar[i] ?? 0) * DUYGU[d].valans));
  return Math.max(-1, Math.min(1, toplam));
}

export function katilim(dikkat: number, v: number, yuz: boolean): number {
  return yuz ? Math.max(0, Math.min(1, 0.7 * dikkat + 0.3 * ((v + 1) / 2))) : 0;
}

export const yuzde = (oran: number | null | undefined) => `%${Math.round((oran ?? 0) * 100)}`;
