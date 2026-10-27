import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Frown, Send } from 'lucide-react';
import { DUYGU, DUYGULAR, YIGIN_SIRASI, type Duygu } from '../../alan/duygular';
import { Maskot } from '../../bilesenler/Maskot';
import { sinif } from '../../bilesenler/ui';

const OGRENCILER = ['Ada', 'Mert', 'Elif', 'Can', 'Zeynep', 'Emir', 'Defne', 'Kerem', 'Ece', 'Arda', 'Nehir', 'Yiğit'];

interface Kisi {
  ad: string;
  duygu: Duygu;
  dikkat: number;
  uyari: boolean;
}

// Tanıtım için gerçekçi bir sınıf havası: çoğunlukla nötr, ara ara gülümseme ve şaşkınlık, nadiren olumsuz.
const AGIRLIK: [Duygu, number][] = [
  ['notr', 0.5],
  ['mutlu', 0.25],
  ['saskin', 0.12],
  ['korku', 0.05],
  ['uzgun', 0.05],
  ['igrenme', 0.03],
];

function rastgeleDuygu(): Duygu {
  let z = Math.random();
  for (const [d, a] of AGIRLIK) {
    if ((z -= a) <= 0) return d;
  }
  return 'notr';
}

const ORNEK_UZUNLUGU = 48;

/**
 * Ana sayfanın kahramanı: video konferans galerisini andıran, maskotlarla canlanan bir sınıf.
 * Bir öğrencinin ifadesi kalıcı olarak olumsuzlaşınca uyarı düşer, destek bildirimi gider ve öğrenci toparlanır.
 */
export function CanliSinif({ kucuk = false }: { kucuk?: boolean }) {
  const azHareket = useReducedMotion();
  const sayi = kucuk ? 9 : 12;
  const [kisiler, setKisiler] = useState<Kisi[]>(() =>
    OGRENCILER.slice(0, sayi).map((ad, i) => ({ ad, duygu: i % 4 === 1 ? 'mutlu' : 'notr', dikkat: 0.7 + Math.random() * 0.25, uyari: false })),
  );
  const [uyandi, setUyandi] = useState(!!azHareket);
  const [uyari, setUyari] = useState<{ ad: string; asama: 'uyari' | 'durtme' } | null>(null);
  // Şerit ilk açılışta boş görünmesin: başlangıç sınıfının dağılımı hafif dalgalanmalarla doldurulur.
  const [gecmis, setGecmis] = useState<number[][]>(() =>
    Array.from({ length: ORNEK_UZUNLUGU }, (_, j) => {
      const dalga = Math.sin(j / 5) * 0.06;
      return [0.6 - dalga, 0.25 + dalga, 0.08, 0.03, 0, 0.04, 0];
    }),
  );
  const sahne = useRef({ hedef: -1, tik: 0 });

  useEffect(() => {
    if (azHareket) return;
    const z = setTimeout(() => setUyandi(true), 900);
    return () => clearTimeout(z);
  }, [azHareket]);

  useEffect(() => {
    if (azHareket || !uyandi) return;
    const z = setInterval(() => {
      const s = sahne.current;
      s.tik++;
      // Senaryo: her ~14 sn'de bir öğrenci üzülür, uyarı düşer, destek mesajı gider, toparlanır.
      const evre = s.tik % 10;
      if (evre === 2) s.hedef = Math.floor(Math.random() * sayi);
      if (evre === 0) s.hedef = -1;
      const hedef = s.hedef;
      const degisenler = [0, 1].map(() => [Math.floor(Math.random() * sayi), rastgeleDuygu()] as const);
      const oynama = Array.from({ length: sayi }, () => (Math.random() - 0.5) * 0.08);

      setKisiler((onceki) => {
        const yeni = onceki.map((k, i) => ({ ...k, dikkat: Math.min(1, Math.max(0.25, k.dikkat + oynama[i])) }));
        for (const [j, duygu] of degisenler) if (j !== hedef) yeni[j] = { ...yeni[j], duygu };
        if (hedef >= 0) {
          if (evre >= 2 && evre <= 6) yeni[hedef] = { ...yeni[hedef], duygu: 'uzgun', uyari: evre >= 4, dikkat: 0.45 };
          else if (evre === 7) yeni[hedef] = { ...yeni[hedef], duygu: 'mutlu', uyari: false, dikkat: 0.85 };
        }
        return yeni;
      });
      if (evre === 4 && hedef >= 0) setUyari({ ad: OGRENCILER[hedef], asama: 'uyari' });
      else if (evre === 6) setUyari((u) => (u ? { ...u, asama: 'durtme' } : u));
      else if (evre === 8) setUyari(null);
    }, 1400);
    return () => clearInterval(z);
  }, [azHareket, uyandi, sayi]);

  // Sınıf dağılımının kısa geçmişi (alt şerit).
  useEffect(() => {
    const dagilim = DUYGULAR.map((d) => kisiler.filter((k) => k.duygu === d).length / kisiler.length);
    setGecmis((g) => [...g, dagilim].slice(-ORNEK_UZUNLUGU));
  }, [kisiler]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[1.6rem] border border-cizgi bg-gece-2 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.8)]">
        <div className="flex items-center gap-3 border-b border-cizgi/70 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-d-ofkeli">
            <span className="h-2 w-2 rounded-full bg-d-ofkeli" /> Canlı
          </span>
          <span className="truncate text-soluk">Fizik · Işığın kırılması · 11-A</span>
          <span className="rakam ml-auto rounded-md bg-gece px-2 py-0.5 font-bold tracking-[0.16em] text-gunes">K7M2QX</span>
        </div>

        <div className={sinif('grid gap-2 p-3', kucuk ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4')}>
          {kisiler.map((k, i) => (
            <motion.div
              key={k.ad}
              initial={azHareket ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.06, type: 'spring', stiffness: 220, damping: 20 }}
              className={sinif('relative flex aspect-[4/3] flex-col items-center justify-center rounded-xl bg-gece', k.uyari && 'animate-nabiz')}
              style={k.uyari ? ({ '--nabiz-renk': `${DUYGU.uzgun.renk}88`, outline: `2px solid ${DUYGU.uzgun.renk}` } as React.CSSProperties) : undefined}
            >
              <Maskot duygu={k.duygu} durum={uyandi ? 'aktif' : 'duraklatildi'} boyut={kucuk ? 58 : 64} etiket={`${k.ad}: ${DUYGU[k.duygu].ad}`} />
              <span className="absolute bottom-1.5 left-2 text-[11px] font-medium text-soluk">{k.ad}</span>
              <span className="absolute bottom-2 right-2 h-1 w-8 overflow-hidden rounded-full bg-gece-4">
                <motion.span className="block h-full rounded-full bg-gunes" animate={{ width: `${k.dikkat * 100}%` }} transition={{ duration: 0.8 }} />
              </span>
            </motion.div>
          ))}
        </div>

        <Serit gecmis={gecmis} />
      </div>

      <AnimatePresence>
        {uyari && (
          <motion.div
            key={uyari.asama}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="absolute -bottom-6 right-4 flex max-w-[300px] items-start gap-3 rounded-2xl border border-cizgi bg-gece-3/95 p-3 text-sm shadow-2xl backdrop-blur sm:-right-6"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `${uyari.asama === 'uyari' ? DUYGU.uzgun.renk : DUYGU.mutlu.renk}26`, color: uyari.asama === 'uyari' ? DUYGU.uzgun.renk : DUYGU.mutlu.renk }}>
              {uyari.asama === 'uyari' ? <Frown size={17} /> : <Send size={16} />}
            </span>
            <span className="leading-snug">
              {uyari.asama === 'uyari' ? `${uyari.ad} yaklaşık 20 sn'dir üzgün görünüyor.` : `${uyari.ad} için destek mesajı gönderildi: “Takıldığın bir yer varsa sormaktan çekinme.”`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Sınıfın son ölçümlerinden akan ifade şeridi. */
function Serit({ gecmis }: { gecmis: number[][] }) {
  const yollar = useMemo(() => {
    if (gecmis.length < 2) return [];
    const G = 600;
    const Y = 56;
    const adim = G / (ORNEK_UZUNLUGU - 1);
    const kayma = (ORNEK_UZUNLUGU - gecmis.length) * adim;
    const alt = new Array(gecmis.length).fill(0);
    return YIGIN_SIRASI.map((d) => {
      const i = DUYGULAR.indexOf(d);
      const ust = gecmis.map((g, j) => alt[j] + g[i]);
      const nokta = (j: number, v: number) => `${(kayma + j * adim).toFixed(1)},${(Y - v * Y).toFixed(1)}`;
      const yol = `M${gecmis.map((_, j) => nokta(j, ust[j])).join(' L')} L${[...gecmis.keys()].reverse().map((j) => nokta(j, alt[j])).join(' L')} Z`;
      gecmis.forEach((_, j) => (alt[j] = ust[j]));
      return { d, yol };
    });
  }, [gecmis]);

  return (
    <div className="border-t border-cizgi/70 px-3 pb-3 pt-2">
      <div className="mb-1.5 flex justify-between text-[11px] text-silik">
        <span>Sınıfın ifade akışı</span>
        <span>şimdi</span>
      </div>
      <svg viewBox="0 0 600 56" preserveAspectRatio="none" className="h-12 w-full rounded-md bg-gece" aria-hidden>
        {yollar.map(({ d, yol }) => (
          <path key={d} d={yol} fill={DUYGU[d].renk} opacity={0.92} />
        ))}
      </svg>
    </div>
  );
}
