import { AnimatePresence, motion } from 'motion/react';
import { BellOff, CircleHelp, EyeOff, Frown, MessageCircle, Moon, Send, UserX, Users } from 'lucide-react';
import { DUYGU } from '../../../alan/duygular';
import type { UyariBildirimi, UyariTuru } from '../../../api/turler';
import { saatYaz, sinif } from '../../../bilesenler/ui';

const SIMGE: Record<UyariTuru, React.ReactNode> = {
  olumsuzIfade: <Frown size={17} />,
  dikkatDagildi: <EyeOff size={17} />,
  kameradaYok: <UserX size={17} />,
  uyuklama: <Moon size={17} />,
  sinifOlumsuz: <Users size={17} />,
  sinifDikkat: <Users size={17} />,
  sinifAnlamadi: <CircleHelp size={17} />,
  ogretmenMesaji: <MessageCircle size={17} />,
};

export function uyariRengi(u: Pick<UyariBildirimi, 'tur' | 'duygu'>): string {
  if (u.duygu) return DUYGU[u.duygu].renk;
  switch (u.tur) {
    case 'dikkatDagildi':
    case 'sinifDikkat':
      return '#FFC94A';
    case 'uyuklama':
      return '#A784FF';
    case 'kameradaYok':
      return '#9AA6C8';
    case 'sinifOlumsuz':
    case 'sinifAnlamadi':
      return '#FF6B5E';
    default:
      return '#F1EEFF';
  }
}

export function UyariAkisi({ uyarilar, sec, sinir }: { uyarilar: UyariBildirimi[]; sec?: (katilimciId: string) => void; sinir?: number }) {
  const liste = sinir ? uyarilar.slice(0, sinir) : uyarilar;
  if (liste.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-silik">
        <BellOff size={22} />
        Henüz uyarı yok. Bir öğrencide kalıcı bir değişim olduğunda burada göreceksiniz.
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {liste.map((u) => {
          const renk = uyariRengi(u);
          const sinifGeneli = u.tur === 'sinifOlumsuz' || u.tur === 'sinifDikkat' || u.tur === 'sinifAnlamadi';
          return (
            <motion.li key={u.id} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
              <button
                disabled={!u.katilimciId || !sec}
                onClick={() => u.katilimciId && sec?.(u.katilimciId)}
                className={sinif(
                  'flex w-full gap-3 rounded-xl border p-3 text-left text-sm transition-colors enabled:hover:bg-gece-3',
                  sinifGeneli ? 'border-d-ofkeli/40 bg-d-ofkeli/[0.07]' : 'border-cizgi/50 bg-gece-2',
                )}
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: `${renk}26`, color: renk }}>
                  {SIMGE[u.tur]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug text-metin/90">{u.mesaj}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-silik">
                    {saatYaz(u.zaman)}
                    {u.ogrenciyeIletildi && u.tur !== 'ogretmenMesaji' && (
                      <span className="inline-flex items-center gap-1">
                        <Send size={11} /> Öğrenciye destek mesajı gitti
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
