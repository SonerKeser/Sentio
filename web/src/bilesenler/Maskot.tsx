import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DUYGU, type Duygu } from '../alan/duygular';

interface Ifade {
  agiz: string;
  kasSol: string;
  kasSag: string;
  goz: number;
  yanak: number;
  gozyasi: number;
}

// Tüm ağız yolları aynı komut dizisine (M C C Z) sahiptir; bu sayede ifadeler arasında akıcı biçim geçişi olur.
const IFADELER: Record<Duygu, Ifade> = {
  notr: {
    agiz: 'M74 130 C 88 133, 112 133, 126 130 C 112 136, 88 136, 74 130 Z',
    kasSol: 'M58 66 Q72 59 86 64',
    kasSag: 'M114 64 Q128 59 142 66',
    goz: 1,
    yanak: 0,
    gozyasi: 0,
  },
  mutlu: {
    agiz: 'M66 120 C 86 127, 114 127, 134 120 C 124 154, 76 154, 66 120 Z',
    kasSol: 'M58 61 Q72 51 86 58',
    kasSag: 'M114 58 Q128 51 142 61',
    goz: 0.55,
    yanak: 0.6,
    gozyasi: 0,
  },
  saskin: {
    agiz: 'M86 130 C 86 110, 114 110, 114 130 C 114 150, 86 150, 86 130 Z',
    kasSol: 'M58 52 Q72 38 86 48',
    kasSag: 'M114 48 Q128 38 142 52',
    goz: 1.3,
    yanak: 0.25,
    gozyasi: 0,
  },
  uzgun: {
    agiz: 'M72 141 C 86 126, 114 126, 128 141 C 114 134, 86 134, 72 141 Z',
    kasSol: 'M58 68 Q74 64 86 54',
    kasSag: 'M114 54 Q126 64 142 68',
    goz: 0.85,
    yanak: 0,
    gozyasi: 0.9,
  },
  ofkeli: {
    agiz: 'M72 138 C 88 130, 112 130, 128 138 C 112 145, 88 145, 72 138 Z',
    kasSol: 'M58 56 Q74 60 88 71',
    kasSag: 'M112 71 Q126 60 142 56',
    goz: 0.62,
    yanak: 0,
    gozyasi: 0,
  },
  korku: {
    agiz: 'M74 137 C 88 122, 112 122, 126 137 C 116 151, 84 151, 74 137 Z',
    kasSol: 'M58 60 Q72 47 86 52',
    kasSag: 'M114 52 Q128 47 142 60',
    goz: 1.25,
    yanak: 0,
    gozyasi: 0,
  },
  igrenme: {
    agiz: 'M72 134 C 86 123, 102 141, 128 127 C 106 143, 88 139, 72 134 Z',
    kasSol: 'M58 64 Q72 62 86 69',
    kasSag: 'M114 55 Q128 50 142 59',
    goz: 0.6,
    yanak: 0,
    gozyasi: 0,
  },
};

const MUREKKEP = '#1A1535';
const GECIS_RENGI = 'stop-color 0.6s ease';
const GOVDE = 'M100 13 C 151 11, 189 48, 187 102 C 185 157, 148 189, 98 187 C 47 185, 13 152, 14 100 C 15 49, 50 15, 100 13 Z';

function karistir(hex: string, hedef: number, oran: number): string {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (k: number) => Math.round(k + (hedef - k) * oran);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(kanal);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export type MaskotDurumu = 'aktif' | 'uykulu' | 'yok' | 'duraklatildi';

interface Ozellikler {
  duygu?: Duygu;
  boyut?: number;
  durum?: MaskotDurumu;
  /** Nefes alma, göz kırpma ve etrafa bakınma. Kalabalık ızgaralarda kapatılabilir. */
  canli?: boolean;
  /** Gözlerin baktığı yön, -1..1. */
  bakis?: [number, number];
  etiket?: string;
  className?: string;
}

/**
 * Sentio'nun maskotu: ifadesini duygu sınıfına göre değiştiren yumuşak bir damla. Öğrenciye kendi
 * ifadesini yansıtır, öğretmen panelinde her öğrencinin anlık ifadesini gösterir.
 */
export function Maskot({ duygu = 'notr', boyut = 160, durum = 'aktif', canli = true, bakis, etiket, className }: Ozellikler) {
  const id = useId().replace(/:/g, '');
  const azHareket = useReducedMotion();
  const [kirpiyor, setKirpiyor] = useState(false);
  const [gezinme, setGezinme] = useState<[number, number]>([0, 0]);
  const ifade = IFADELER[duygu];
  const renk = DUYGU[duygu].renk;
  const hareketli = canli && !azHareket && durum === 'aktif';

  useEffect(() => {
    if (!hareketli) return;
    let zaman: ReturnType<typeof setTimeout>;
    const kirp = () => {
      zaman = setTimeout(() => {
        setKirpiyor(true);
        setTimeout(() => setKirpiyor(false), 130);
        kirp();
      }, 2200 + Math.random() * 3800);
    };
    kirp();
    return () => clearTimeout(zaman);
  }, [hareketli]);

  useEffect(() => {
    if (!hareketli || bakis) return;
    const zaman = setInterval(() => {
      setGezinme(Math.random() < 0.55 ? [0, 0] : [Math.random() * 2 - 1, Math.random() * 1.2 - 0.6]);
    }, 2600);
    return () => clearInterval(zaman);
  }, [hareketli, bakis]);

  const [bx, by] = bakis ?? gezinme;
  const kapali = durum === 'uykulu' || durum === 'duraklatildi' || kirpiyor;
  const gozRy = kapali ? 1.6 : 11 * ifade.goz;
  const gecis = { type: 'spring', stiffness: 170, damping: 18, mass: 0.8 } as const;
  const silik = durum === 'yok' || durum === 'duraklatildi';

  return (
    <svg
      viewBox="0 0 200 200"
      width={boyut}
      height={boyut}
      role="img"
      aria-label={etiket ?? `${DUYGU[duygu].ad} ifadesi`}
      className={className}
      style={{ overflow: 'visible', opacity: silik ? 0.38 : 1, filter: silik ? 'saturate(0.15)' : undefined, transition: 'opacity .4s, filter .4s' }}
    >
      <defs>
        <radialGradient id={`${id}g`} cx="36%" cy="28%" r="82%">
          <stop offset="0" style={{ stopColor: karistir(renk, 255, 0.55), transition: GECIS_RENGI }} />
          <stop offset="0.55" style={{ stopColor: renk, transition: GECIS_RENGI }} />
          <stop offset="1" style={{ stopColor: karistir(renk, 30, 0.35), transition: GECIS_RENGI }} />
        </radialGradient>
      </defs>

      <g className={hareketli ? 'animate-nefes' : undefined} style={{ transformOrigin: '100px 180px' }}>
        <path d={GOVDE} fill={`url(#${id}g)`} />
        <path d="M58 40 C 72 28, 92 24, 104 26" stroke="#fff" strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" fill="none" />

        <motion.ellipse cx={58} cy={114} rx={13} ry={7} fill="#FF7AD9" initial={false} animate={{ opacity: ifade.yanak }} />
        <motion.ellipse cx={142} cy={114} rx={13} ry={7} fill="#FF7AD9" initial={false} animate={{ opacity: ifade.yanak }} />

        <motion.path initial={false} animate={{ d: ifade.kasSol }} transition={gecis} stroke={MUREKKEP} strokeWidth={6} strokeLinecap="round" fill="none" />
        <motion.path initial={false} animate={{ d: ifade.kasSag }} transition={gecis} stroke={MUREKKEP} strokeWidth={6} strokeLinecap="round" fill="none" />

        <motion.g initial={false} animate={{ x: bx * 5, y: by * 4 }} transition={{ type: 'spring', stiffness: 90, damping: 14 }}>
          {[72, 128].map((cx) => (
            <g key={cx}>
              <motion.ellipse cx={cx} cy={90} rx={9.5} initial={false} animate={{ ry: gozRy }} transition={{ duration: kirpiyor ? 0.06 : 0.25 }} fill={MUREKKEP} />
              <motion.circle cx={cx + 3} cy={85} r={3} fill="#fff" initial={false} animate={{ opacity: gozRy > 6 ? 0.9 : 0 }} transition={{ duration: 0.12 }} />
            </g>
          ))}
        </motion.g>

        <motion.path
          d="M64 104 C 60 112, 60 118, 64 120 C 68 118, 68 112, 64 104 Z"
          fill="#BFE3FF"
          initial={false}
          animate={{ opacity: ifade.gozyasi && durum === 'aktif' ? ifade.gozyasi : 0, y: ifade.gozyasi ? [0, 6, 0] : 0 }}
          transition={{ y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
        />

        <motion.path initial={false} animate={{ d: ifade.agiz }} transition={gecis} fill={MUREKKEP} />
      </g>

      {durum === 'uykulu' && !azHareket && (
        <g fill={MUREKKEP} fontFamily="var(--font-display)" fontWeight={700}>
          {[0, 1, 2].map((i) => (
            <motion.text
              key={i}
              x={150}
              y={60}
              fontSize={18 - i * 3}
              fill="#F1EEFF"
              animate={{ opacity: [0, 1, 0], x: [150, 162 + i * 4], y: [60, 30 - i * 10] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 }}
            >
              z
            </motion.text>
          ))}
        </g>
      )}
    </svg>
  );
}
