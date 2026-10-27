import { useEffect, useRef, useState } from 'react';
import { DUYGULAR } from '../alan/duygular';
import type { OkumaGirdisi } from '../api/turler';
import { motorYukle } from './motor';
import { DurusTabani, Toplayici, yuzOlcumu } from './olcum';

export type KameraDurumu = 'kapali' | 'model' | 'izin' | 'calisiyor' | 'hata';

export interface AnlikIfade {
  d: number[];
  dikkat: number;
  goz: number;
  yuz: boolean;
  mesh?: number[][];
  genislik: number;
  yukseklik: number;
}

/** Analiz döngüsünün kare aralığı (~6 kare/sn): akıcı bir önizleme için yeterli, işlemciyi yormaz. */
const KARE_MS = 170;

/**
 * Arka plandaki sekmelerde tarayıcı zamanlayıcıları kısar; öğrenci video konferans sekmesine geçtiğinde
 * analiz durmasın diye tik sinyali bir Web Worker'dan gelir.
 */
function tikci(araMs: number, tik: () => void): () => void {
  try {
    const kod = 'let t;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}';
    const isci = new Worker(URL.createObjectURL(new Blob([kod], { type: 'text/javascript' })));
    isci.onmessage = tik;
    isci.postMessage(araMs);
    return () => isci.terminate();
  } catch {
    const z = setInterval(tik, araMs);
    return () => clearInterval(z);
  }
}

export function kameraHataMesaji(e: unknown): string {
  const ad = (e as { name?: string })?.name;
  if (ad === 'NotAllowedError' || ad === 'SecurityError')
    return 'Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verip sayfayı yenileyin.';
  if (ad === 'NotFoundError' || ad === 'OverconstrainedError') return 'Bu cihazda kullanılabilir bir kamera bulunamadı.';
  if (ad === 'NotReadableError') return 'Kamera başka bir uygulama tarafından kullanılıyor. O uygulamada kamerayı kapatıp yeniden deneyin.';
  if (!window.isSecureContext)
    return 'Tarayıcılar kameraya yalnızca güvenli bağlantıda (https) izin verir. Öğretmeninizden https adresini isteyin ya da Sezgi masaüstü istemcisini kullanın.';
  return `Analiz başlatılamadı: ${(e as Error)?.message ?? e}`;
}

export function useKameraAnalizi({ etkin, orneklemeMs, okuma }: { etkin: boolean; orneklemeMs: number; okuma: (o: OkumaGirdisi) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const okumaRef = useRef(okuma);
  okumaRef.current = okuma;
  const [durum, setDurum] = useState<KameraDurumu>('kapali');
  const [hata, setHata] = useState<string | null>(null);
  const [anlik, setAnlik] = useState<AnlikIfade | null>(null);

  useEffect(() => {
    if (!etkin) {
      setDurum('kapali');
      setAnlik(null);
      return;
    }
    let iptal = false;
    let akis: MediaStream | null = null;
    let durdur = () => {};
    setHata(null);

    (async () => {
      try {
        setDurum('model');
        const human = await motorYukle('kamera');
        if (iptal) return;
        setDurum('izin');
        akis = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 15, max: 30 } },
          audio: false,
        });
        if (iptal) return;
        const video = videoRef.current!;
        video.srcObject = akis;
        video.muted = true;
        await video.play();
        setDurum('calisiyor');

        const taban = new DurusTabani();
        const toplayici = new Toplayici();
        const ema = new Array<number>(DUYGULAR.length).fill(0);
        ema[0] = 1;
        let emaDikkat = 1;
        let mesgul = false;
        let sonGonderim = performance.now();

        durdur = tikci(KARE_MS, async () => {
          if (iptal || mesgul) return;
          mesgul = true;
          try {
            if (video.readyState >= 2) {
              const sonuc = await human.detect(video);
              const yuz = sonuc.face.find((f) => f.score > 0.4);
              const olcum = yuz ? yuzOlcumu(yuz, taban) : null;
              toplayici.ekle(olcum);
              if (olcum) {
                olcum.d.forEach((x, i) => (ema[i] += 0.3 * (x - ema[i])));
                emaDikkat += 0.3 * (olcum.dikkat - emaDikkat);
              }
              setAnlik({
                d: [...ema],
                dikkat: olcum ? emaDikkat : 0,
                goz: olcum?.goz ?? 0,
                yuz: !!olcum,
                mesh: yuz?.mesh as number[][] | undefined,
                genislik: video.videoWidth,
                yukseklik: video.videoHeight,
              });
            }
            const simdi = performance.now();
            if (simdi - sonGonderim >= orneklemeMs) {
              sonGonderim = simdi;
              const o = toplayici.bosalt();
              if (o) okumaRef.current(o);
            }
          } catch (e) {
            console.warn('Kare işlenemedi', e);
          } finally {
            mesgul = false;
          }
        });
      } catch (e) {
        if (iptal) return;
        setHata(kameraHataMesaji(e));
        setDurum('hata');
      }
    })();

    return () => {
      iptal = true;
      durdur();
      akis?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [etkin, orneklemeMs]);

  return { videoRef, durum, hata, anlik };
}
