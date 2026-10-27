import { describe, expect, it } from 'vitest';
import { dikkatHesapla, DurusTabani, gozAcikligi, olasiliklar, Toplayici } from './olcum';
import { cakisanlariAyikla, GaleriIzleyici, kesisimOrani, type GaleriYuzu } from './izleyici';
import { baskin, katilim, valans } from '../alan/duygular';

const olcum = (mutlu = 0.8) => ({ d: [1 - mutlu, mutlu, 0, 0, 0, 0, 0], dikkat: 0.9, goz: 0.9, yawDerece: 0, pitchDerece: 0 });

describe('ifade olasılıkları', () => {
  it('Human sınıflarını Sezgi sırasına çevirir ve normalleştirir', () => {
    const d = olasiliklar([
      { emotion: 'sad', score: 0.6 },
      { emotion: 'neutral', score: 0.2 },
      { emotion: 'fear', score: 0.2 },
    ]);
    expect(d).toHaveLength(7);
    expect(d.reduce((a, b) => a + b)).toBeCloseTo(1);
    expect(baskin(d)).toBe('uzgun');
    expect(d[5]).toBeCloseTo(0.2);
  });

  it('boş listede nötr döner', () => {
    expect(olasiliklar(undefined)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it('valans ve katılım yönleri doğru', () => {
    expect(valans([0, 1, 0, 0, 0, 0, 0])).toBe(1);
    expect(valans([0, 0, 0, 0, 1, 0, 0])).toBeLessThan(-0.8);
    expect(katilim(1, 0, false)).toBe(0);
    expect(katilim(0.9, 0.5, true)).toBeGreaterThan(katilim(0.2, 0.5, true));
  });
});

describe('dikkat ve göz', () => {
  it('ekrana dönük, açık gözlü yüz yüksek dikkat alır', () => {
    expect(dikkatHesapla(0, 0, 0, 1)).toBe(1);
    expect(dikkatHesapla(45, 0, 0, 1)).toBe(0);
    expect(dikkatHesapla(25, 0, 0, 1)).toBeGreaterThan(0.4);
    expect(dikkatHesapla(0, 0, 0, 0.1)).toBeLessThan(0.4);
  });

  it('göz açıklığı EAR oranından hesaplanır', () => {
    const mesh = Array.from({ length: 468 }, () => [0, 0, 0]);
    const goz = (n: number[], acik: number) => {
      mesh[n[0]] = [0, 0, 0];
      mesh[n[3]] = [30, 0, 0];
      mesh[n[1]] = [10, -acik, 0];
      mesh[n[5]] = [10, acik, 0];
      mesh[n[2]] = [20, -acik, 0];
      mesh[n[4]] = [20, acik, 0];
    };
    goz([33, 160, 158, 133, 153, 144], 4.5);
    goz([362, 385, 387, 263, 373, 380], 4.5);
    expect(gozAcikligi(mesh)).toBe(1);
    goz([33, 160, 158, 133, 153, 144], 1);
    goz([362, 385, 387, 263, 373, 380], 1);
    expect(gozAcikligi(mesh)).toBe(0);
    expect(gozAcikligi(undefined)).toBe(1);
  });

  it('duruş tabanı doğal oturuş açısını öğrenir', () => {
    const taban = new DurusTabani();
    for (let i = 0; i < 40; i++) taban.guncelle(4, 14);
    const [yaw, pitch] = taban.sapma(4, 14);
    expect(Math.abs(yaw)).toBeLessThan(0.5);
    expect(Math.abs(pitch)).toBeLessThan(0.5);
  });
});

describe('toplayıcı', () => {
  it('yüzlü karelerin ortalamasını alır', () => {
    const t = new Toplayici();
    t.ekle(olcum(1));
    t.ekle(olcum(0.5));
    t.ekle(null);
    const o = t.bosalt()!;
    expect(o.yuz).toBe(true);
    expect(o.d[1]).toBeCloseTo(0.75);
    expect(t.bosalt()).toBeNull();
  });

  it('yüz karelerin üçte birinden azında görünürse yok sayar', () => {
    const t = new Toplayici();
    t.ekle(olcum());
    for (let i = 0; i < 4; i++) t.ekle(null);
    expect(t.bosalt()!.yuz).toBe(false);
  });
});

describe('galeri izleyici', () => {
  const yuz = (x: number, e: number[]): GaleriYuzu => ({ kutu: [x, 10, 50, 60], skor: 0.9, embedding: e, olcum: olcum() });
  const benzerlik = (a: number[], b: number[]) => (a[0] === b[0] ? 0.9 : 0.1);

  it('çakışan tespitleri birleştirir', () => {
    expect(kesisimOrani([0, 0, 10, 10], [5, 0, 10, 10])).toBeCloseTo(1 / 3);
    const ayik = cakisanlariAyikla([yuz(0, [1]), { ...yuz(4, [1]), skor: 0.5 }, yuz(200, [2])]);
    expect(ayik).toHaveLength(2);
  });

  it('düzen değişse de aynı kişiyi tanımlayıcıyla izler', () => {
    const iz = new GaleriIzleyici(benzerlik);
    iz.guncelle([yuz(0, [1]), yuz(300, [2])], 0);
    // Galeri düzeni değişti: kişiler yer değiştirdi.
    iz.guncelle([yuz(300, [1]), yuz(0, [2])], 1000);
    iz.guncelle([yuz(300, [1]), yuz(0, [2])], 2000);
    expect(iz.izler.size).toBe(2);
    const okumalar = iz.okumalar();
    expect(okumalar).toHaveLength(2);
    expect(okumalar.map((o) => o.ad).sort()).toEqual(['Yüz 1', 'Yüz 2']);
  });

  it('uzun süre görülmeyen izi unutur', () => {
    const iz = new GaleriIzleyici(benzerlik, 0.5, 5000);
    iz.guncelle([yuz(0, [1])], 0);
    iz.guncelle([], 6000);
    expect(iz.izler.size).toBe(0);
  });
});
