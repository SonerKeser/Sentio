import { useCallback, useEffect, useRef, useState } from 'react';
import type { Human } from '@vladmandic/human';
import type { GaleriOkumasi } from '../api/turler';
import { cakisanlariAyikla, GaleriIzleyici, type GaleriYuzu, type Kutu } from './izleyici';
import { motorYukle } from './motor';
import { yuzOlcumu } from './olcum';
import { kameraHataMesaji } from './kamera';

export type GaleriDurumu = 'kapali' | 'model' | 'calisiyor' | 'hata';

export interface IzGorunumu {
  id: string;
  ad: string;
  kutu: Kutu;
  d: number[];
  dikkat: number;
  gorunur: boolean;
  sonGorulme: number;
}

/**
 * Video konferans galerisi (Zoom, Meet, Teams…) kare kare taranır. Küçük yüzleri kaçırmamak için kare
 * örtüşen döşemelere bölünür, her döşeme ayrı çözümlenir ve sonuçlar birleştirilir.
 */
async function kareTara(human: Human, video: HTMLVideoElement, n: number, tuval: HTMLCanvasElement, doseme: HTMLCanvasElement): Promise<GaleriYuzu[]> {
  const W = video.videoWidth;
  const H = video.videoHeight;
  if (!W || !H) return [];
  const olcek = Math.min(1, 1920 / W);
  tuval.width = Math.round(W * olcek);
  tuval.height = Math.round(H * olcek);
  tuval.getContext('2d')!.drawImage(video, 0, 0, tuval.width, tuval.height);

  const yuzler: GaleriYuzu[] = [];
  const tw = tuval.width / n;
  const th = tuval.height / n;
  const pay = n > 1 ? 0.12 : 0;
  const dc = doseme.getContext('2d', { willReadFrequently: false })!;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const sx = Math.max(0, c * tw - tw * pay);
      const sy = Math.max(0, r * th - th * pay);
      const sw = Math.min(tuval.width - sx, tw * (1 + 2 * pay));
      const sh = Math.min(tuval.height - sy, th * (1 + 2 * pay));
      doseme.width = Math.round(sw);
      doseme.height = Math.round(sh);
      dc.drawImage(tuval, sx, sy, sw, sh, 0, 0, doseme.width, doseme.height);
      const sonuc = await human.detect(doseme);
      for (const f of sonuc.face) {
        if (f.score < 0.45) continue;
        yuzler.push({
          kutu: [(f.box[0] + sx) / olcek, (f.box[1] + sy) / olcek, f.box[2] / olcek, f.box[3] / olcek],
          skor: f.score,
          embedding: f.embedding,
          olcum: yuzOlcumu(f),
        });
      }
    }
  }
  return cakisanlariAyikla(yuzler);
}

export function useGaleriAnalizi(gonder: (okumalar: GaleriOkumasi[]) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gonderRef = useRef(gonder);
  gonderRef.current = gonder;
  const izleyiciRef = useRef<GaleriIzleyici | null>(null);
  const durdurRef = useRef<() => void>(() => {});
  const dosemeRef = useRef(2);
  const [durum, setDurum] = useState<GaleriDurumu>('kapali');
  const [hata, setHata] = useState<string | null>(null);
  const [izler, setIzler] = useState<IzGorunumu[]>([]);
  const [doseme, setDosemeDurumu] = useState(2);
  const [kaynakAdi, setKaynakAdi] = useState('');

  const setDoseme = (n: number) => {
    dosemeRef.current = n;
    setDosemeDurumu(n);
  };

  const durdur = useCallback(() => {
    durdurRef.current();
    durdurRef.current = () => {};
    setDurum('kapali');
  }, []);

  useEffect(() => durdur, [durdur]);

  const baslat = useCallback(
    async (kaynak: 'ekran' | File) => {
      durdur();
      setHata(null);
      let akis: MediaStream | null = null;
      let dosyaAdresi: string | null = null;
      let iptal = false;
      durdurRef.current = () => {
        iptal = true;
        akis?.getTracks().forEach((t) => t.stop());
        if (dosyaAdresi) URL.revokeObjectURL(dosyaAdresi);
        const v = videoRef.current;
        if (v) {
          v.pause();
          v.srcObject = null;
          v.removeAttribute('src');
        }
      };

      try {
        const video = videoRef.current!;
        if (kaynak === 'ekran') {
          akis = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
          akis.getVideoTracks()[0]?.addEventListener('ended', () => durdur());
          video.srcObject = akis;
          setKaynakAdi(akis.getVideoTracks()[0]?.label || 'Ekran paylaşımı');
        } else {
          dosyaAdresi = URL.createObjectURL(kaynak);
          video.src = dosyaAdresi;
          video.loop = true;
          setKaynakAdi(kaynak.name);
        }
        video.muted = true;
        await video.play();

        setDurum('model');
        const human = await motorYukle('galeri');
        if (iptal) return;
        setDurum('calisiyor');

        const izleyici = new GaleriIzleyici((a, b) => human.match.similarity(a, b));
        izleyiciRef.current = izleyici;
        const tuval = document.createElement('canvas');
        const dosemeTuvali = document.createElement('canvas');
        let sonGonderim = performance.now();

        const dongu = async () => {
          if (iptal) return;
          const t0 = performance.now();
          try {
            const yuzler = await kareTara(human, video, dosemeRef.current, tuval, dosemeTuvali);
            if (iptal) return;
            const simdi = Date.now();
            const gorulen = new Set(izleyici.guncelle(yuzler, simdi).map((i) => i.id));
            setIzler(
              [...izleyici.izler.values()].map((i) => ({
                id: i.id,
                ad: i.ad,
                kutu: i.kutu,
                d: i.sonOlcum.d,
                dikkat: i.sonOlcum.dikkat,
                gorunur: gorulen.has(i.id),
                sonGorulme: i.sonGorulme,
              })),
            );
            if (performance.now() - sonGonderim >= 1000) {
              sonGonderim = performance.now();
              const okumalar = izleyici.okumalar();
              if (okumalar.length) gonderRef.current(okumalar);
            }
          } catch (e) {
            console.warn('Galeri karesi işlenemedi', e);
          }
          setTimeout(dongu, Math.max(50, 700 - (performance.now() - t0)));
        };
        dongu();
      } catch (e) {
        durdurRef.current();
        if ((e as { name?: string })?.name === 'NotAllowedError' && kaynak === 'ekran') {
          setDurum('kapali');
          return;
        }
        setHata(kameraHataMesaji(e));
        setDurum('hata');
      }
    },
    [durdur],
  );

  const adDegistir = useCallback((id: string, ad: string) => {
    izleyiciRef.current?.adDegistir(id, ad);
    setIzler((l) => l.map((i) => (i.id === id ? { ...i, ad } : i)));
  }, []);

  return { videoRef, durum, hata, izler, doseme, setDoseme, baslat, durdur, adDegistir, kaynakAdi };
}
