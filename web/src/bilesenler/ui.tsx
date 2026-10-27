import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { DUYGU, DUYGULAR } from '../alan/duygular';

const sinif = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(' ');
export { sinif };

type DugmeTuru = 'birincil' | 'ikincil' | 'hayalet' | 'tehlike';

const DUGME_TURLERI: Record<DugmeTuru, string> = {
  birincil: 'bg-gunes text-gece hover:bg-gunes-koyu shadow-[0_8px_24px_-12px_rgb(255_201_74/0.8)]',
  ikincil: 'border border-cizgi bg-gece-2 text-metin hover:border-silik hover:bg-gece-3',
  hayalet: 'text-soluk hover:text-metin hover:bg-gece-3',
  tehlike: 'border border-d-ofkeli/40 text-d-ofkeli hover:bg-d-ofkeli/10',
};

export const Dugme = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tur?: DugmeTuru; boyut?: 'kucuk' | 'orta' | 'buyuk'; simge?: ReactNode; yukleniyor?: boolean }
>(function Dugme({ tur = 'ikincil', boyut = 'orta', simge, yukleniyor, className, children, disabled, ...kalan }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || yukleniyor}
      className={sinif(
        'inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors duration-150 select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        boyut === 'kucuk' && 'h-8 px-3 text-sm',
        boyut === 'orta' && 'h-10 px-4 text-[15px]',
        boyut === 'buyuk' && 'h-13 px-6 text-base',
        DUGME_TURLERI[tur],
        className,
      )}
      {...kalan}
    >
      {yukleniyor ? <Donen /> : simge}
      {children}
    </button>
  );
});

export function Donen({ boyut = 16 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const Alan = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { etiket: string; ipucu?: string; hata?: string | null }>(
  function Alan({ etiket, ipucu, hata, className, id, ...kalan }, ref) {
    const otomatik = useId();
    const kimlik = id ?? otomatik;
    return (
      <label htmlFor={kimlik} className={sinif('flex flex-col gap-1.5', className)}>
        <span className="text-sm font-medium text-soluk">{etiket}</span>
        <input
          ref={ref}
          id={kimlik}
          aria-invalid={!!hata}
          className={sinif(
            'h-11 rounded-xl border bg-gece px-3.5 text-metin placeholder:text-silik outline-none transition-colors',
            'focus:border-gunes/70 focus:bg-gece-2',
            hata ? 'border-d-ofkeli/70' : 'border-cizgi',
          )}
          {...kalan}
        />
        {hata ? <span className="text-sm text-d-ofkeli">{hata}</span> : ipucu ? <span className="text-xs text-silik">{ipucu}</span> : null}
      </label>
    );
  },
);

export function Anahtar({ acik, degisti, etiket, aciklama, disabled }: { acik: boolean; degisti: (a: boolean) => void; etiket: string; aciklama?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      disabled={disabled}
      onClick={() => degisti(!acik)}
      className="group flex w-full items-start justify-between gap-4 rounded-xl px-1 py-2 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-[15px] font-medium">{etiket}</span>
        {aciklama && <span className="mt-0.5 block text-sm text-silik">{aciklama}</span>}
      </span>
      <span className={sinif('relative mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors', acik ? 'bg-gunes' : 'bg-gece-4')}>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={sinif('absolute top-1 h-4 w-4 rounded-full', acik ? 'right-1 bg-gece' : 'left-1 bg-soluk')}
        />
      </span>
    </button>
  );
}

/** Kenardan açılan çekmece ya da ortada pencere. Esc ve dış tıklamayla kapanır. */
export function Pencere({
  acik,
  kapat,
  baslik,
  children,
  yan = false,
  genislik = 'max-w-lg',
}: {
  acik: boolean;
  kapat: () => void;
  baslik: ReactNode;
  children: ReactNode;
  yan?: boolean;
  genislik?: string;
}) {
  useEffect(() => {
    if (!acik) return;
    const tus = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [acik, kapat]);

  return (
    <AnimatePresence>
      {acik && (
        <motion.div className="fixed inset-0 z-50 flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0d0a1f]/70 backdrop-blur-sm" onClick={kapat} />
          <motion.section
            role="dialog"
            aria-modal="true"
            className={sinif(
              'relative flex max-h-full w-full flex-col border-cizgi bg-gece-2 shadow-2xl',
              yan ? 'ml-auto h-full max-w-md border-l' : sinif('m-auto max-h-[92dvh] rounded-kart border', genislik),
            )}
            initial={yan ? { x: 60, opacity: 0 } : { y: 24, opacity: 0, scale: 0.98 }}
            animate={yan ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={yan ? { x: 60, opacity: 0 } : { y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <header className="flex items-center justify-between gap-4 border-b border-cizgi/70 px-5 py-4">
              <h2 className="text-xl font-semibold">{baslik}</h2>
              <button onClick={kapat} className="rounded-full p-1.5 text-soluk hover:bg-gece-3 hover:text-metin" aria-label="Kapat">
                <X size={20} />
              </button>
            </header>
            <div className="kaydirma-ince flex-1 overflow-y-auto p-5">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Yedi ifadenin oranlarını tek yatay şeritte gösterir. */
export function TayfCubugu({ dagilim, yukseklik = 8, className }: { dagilim: number[]; yukseklik?: number; className?: string }) {
  const toplam = dagilim.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className={sinif('flex w-full overflow-hidden rounded-pill bg-gece-4', className)} style={{ height: yukseklik }}>
      {DUYGULAR.map((d, i) => (
        <motion.span
          key={d}
          title={`${DUYGU[d].ad} %${Math.round(((dagilim[i] ?? 0) / toplam) * 100)}`}
          initial={false}
          animate={{ width: `${((dagilim[i] ?? 0) / toplam) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          style={{ background: DUYGU[d].renk }}
        />
      ))}
    </div>
  );
}

/** Dairesel gösterge (dikkat, katılım). */
export function Halka({ deger, boyut = 44, kalinlik = 5, renk = 'var(--color-gunes)', children }: { deger: number; boyut?: number; kalinlik?: number; renk?: string; children?: ReactNode }) {
  const r = (boyut - kalinlik) / 2;
  const cevre = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: boyut, height: boyut }}>
      <svg width={boyut} height={boyut} className="-rotate-90">
        <circle cx={boyut / 2} cy={boyut / 2} r={r} stroke="var(--color-gece-4)" strokeWidth={kalinlik} fill="none" />
        <motion.circle
          cx={boyut / 2}
          cy={boyut / 2}
          r={r}
          stroke={renk}
          strokeWidth={kalinlik}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={cevre}
          initial={false}
          animate={{ strokeDashoffset: cevre * (1 - Math.max(0, Math.min(1, deger))) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

/** Küçük çizgi grafik (son ölçümlerin seyri). */
export function Kivilcim({ degerler, genislik = 96, yukseklik = 24, renk = 'var(--color-gunes)' }: { degerler: number[]; genislik?: number; yukseklik?: number; renk?: string }) {
  if (degerler.length < 2) return <svg width={genislik} height={yukseklik} aria-hidden />;
  const adim = genislik / (degerler.length - 1);
  const noktalar = degerler.map((d, i) => `${(i * adim).toFixed(1)},${(yukseklik - 2 - d * (yukseklik - 4)).toFixed(1)}`);
  return (
    <svg width={genislik} height={yukseklik} aria-hidden>
      <polyline points={noktalar.join(' ')} fill="none" stroke={renk} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Bildirimler

interface Bildirim {
  id: number;
  metin: string;
  tur: 'bilgi' | 'basari' | 'hata';
}

const BildirimBaglami = createContext<(metin: string, tur?: Bildirim['tur']) => void>(() => {});

export function BildirimSaglayici({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Bildirim[]>([]);
  const goster = useCallback((metin: string, tur: Bildirim['tur'] = 'bilgi') => {
    const id = Date.now() + Math.random();
    setListe((l) => [...l.slice(-3), { id, metin, tur }]);
    setTimeout(() => setListe((l) => l.filter((b) => b.id !== id)), tur === 'hata' ? 6500 : 3800);
  }, []);
  return (
    <BildirimBaglami.Provider value={goster}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {liste.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={sinif(
                'pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-[15px] shadow-xl backdrop-blur',
                b.tur === 'hata' && 'border-d-ofkeli/50 bg-[#3a1730]/95 text-[#ffd9d4]',
                b.tur === 'basari' && 'border-d-igrenme/40 bg-[#183a33]/95 text-[#d8ffe0]',
                b.tur === 'bilgi' && 'border-cizgi bg-gece-3/95 text-metin',
              )}
            >
              {b.metin}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </BildirimBaglami.Provider>
  );
}

export const useBildirim = () => useContext(BildirimBaglami);

export function useZamanlayici(araMs: number) {
  const [simdi, setSimdi] = useState(() => Date.now());
  useEffect(() => {
    const z = setInterval(() => setSimdi(Date.now()), araMs);
    return () => clearInterval(z);
  }, [araMs]);
  return simdi;
}

export function sureYaz(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const sn = s % 60;
  return sa > 0 ? `${sa}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}` : `${dk}:${String(sn).padStart(2, '0')}`;
}

export const tarihYaz = (iso: string | number) =>
  new Date(typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+') ? iso + 'Z' : iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

export const saatYaz = (iso: string | number) =>
  new Date(typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+') ? iso + 'Z' : iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function useKalici<T>(anahtar: string, baslangic: T): [T, (d: T) => void] {
  const [deger, setDeger] = useState<T>(() => {
    try {
      const k = localStorage.getItem(anahtar);
      return k ? (JSON.parse(k) as T) : baslangic;
    } catch {
      return baslangic;
    }
  });
  const yaz = useCallback(
    (d: T) => {
      setDeger(d);
      try {
        localStorage.setItem(anahtar, JSON.stringify(d));
      } catch {
        /* özel pencere */
      }
    },
    [anahtar],
  );
  return useMemo(() => [deger, yaz], [deger, yaz]);
}
