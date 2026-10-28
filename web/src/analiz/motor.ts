import type { Config, Human } from '@vladmandic/human';

export type MotorTuru = 'kamera' | 'galeri';

const motorlar = new Map<MotorTuru, Promise<Human>>();

function yapilandirma(tur: MotorTuru): Partial<Config> {
  const galeri = tur === 'galeri';
  // Galeride aynı motor farklı döşemelerde çalıştığı için kareler arası önbellek kapatılır.
  const atlama = galeri ? { skipFrames: 0, skipTime: 0 } : {};
  return {
    backend: 'webgl',
    // Sayfa adresi /katil/KOD gibi derin olabilir; modeller her zaman uygulamanın kökünden yüklenir.
    modelBasePath: new URL(`${import.meta.env.BASE_URL}modeller/`, location.origin).href,
    cacheSensitivity: galeri ? 0 : 0.7,
    debug: false,
    filter: { enabled: true, equalization: false, flip: false },
    face: {
      enabled: true,
      detector: { rotation: false, maxDetected: galeri ? 20 : 1, minConfidence: 0.45, minSize: galeri ? 24 : 64, return: false, ...atlama },
      mesh: { enabled: true },
      iris: { enabled: true, ...atlama },
      emotion: { enabled: true, minConfidence: 0.01, ...atlama },
      description: { enabled: galeri, ...atlama },
      antispoof: { enabled: false },
      liveness: { enabled: false },
      attention: { enabled: false },
      gear: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
  } as Partial<Config>;
}

/**
 * Analiz motorunu (TensorFlow.js + Human) ilk ihtiyaçta yükler. Modeller Sentio sunucusundan gelir;
 * tüm çıkarım tarayıcıda, cihazın GPU'sunda yapılır ve görüntü hiçbir yere gönderilmez.
 */
export function motorYukle(tur: MotorTuru): Promise<Human> {
  let motor = motorlar.get(tur);
  if (!motor) {
    motor = (async () => {
      const { Human } = await import('@vladmandic/human');
      const human = new Human(yapilandirma(tur));
      try {
        await human.load();
      } catch (e) {
        // WebGL yoksa (eski ekran kartı, kapalı donanım hızlandırma) yavaş ama çalışan CPU arka ucuna düş.
        console.warn('WebGL arka ucu başlatılamadı, CPU deneniyor.', e);
        human.config.backend = 'cpu';
        await human.load();
      }
      await human.warmup();
      return human;
    })();
    motor.catch(() => motorlar.delete(tur));
    motorlar.set(tur, motor);
  }
  return motor;
}
