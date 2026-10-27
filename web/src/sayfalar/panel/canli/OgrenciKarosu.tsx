import { memo } from 'react';
import { motion } from 'motion/react';
import { Bot, MonitorPlay, Video } from 'lucide-react';
import { DUYGU } from '../../../alan/duygular';
import type { KatilimciAnligi } from '../../../api/turler';
import { Maskot, type MaskotDurumu } from '../../../bilesenler/Maskot';
import { Kivilcim, sinif, TayfCubugu } from '../../../bilesenler/ui';
import { SINYAL_ADI, SINYAL_SIMGESI } from './EtkilesimPaneli';

export const KAYNAK_SIMGESI = {
  kamera: <Video size={13} />,
  galeri: <MonitorPlay size={13} />,
  simulasyon: <Bot size={13} />,
};

export const KAYNAK_ADI = { kamera: 'Sezgi istemcisi', galeri: 'Galeri analizi', simulasyon: 'Sanal öğrenci' };

export function maskotDurumu(k: KatilimciAnligi): MaskotDurumu {
  if (k.durum === 'duraklatildi' || k.durum === 'molada') return 'duraklatildi';
  if (k.durum !== 'aktif' || !k.yuz) return 'yok';
  if (k.goz < 0.25) return 'uykulu';
  return 'aktif';
}

export function durumMetni(k: KatilimciAnligi): string {
  switch (k.durum) {
    case 'duraklatildi':
      return 'Duraklattı';
    case 'bekliyor':
      return 'Kamera açılıyor';
    case 'cevrimdisi':
      return 'Bağlı değil';
    case 'ayrildi':
      return 'Ayrıldı';
    case 'molada':
      return 'Molada';
  }
  if (!k.yuz) return 'Kamerada yok';
  if (k.goz < 0.25) return 'Gözleri kapalı';
  return DUYGU[k.baskin].ad;
}

export const OgrenciKarosu = memo(function OgrenciKarosu({ k, sec }: { k: KatilimciAnligi; sec: (id: string) => void }) {
  const durum = maskotDurumu(k);
  const uyari = k.uyariDuygusu ? DUYGU[k.uyariDuygusu].renk : null;
  const aktif = durum === 'aktif' || durum === 'uykulu';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={() => sec(k.id)}
      className={sinif(
        'group relative flex w-full flex-col gap-3 rounded-2xl border bg-gece-2 p-3.5 text-left transition-colors hover:bg-gece-3',
        uyari ? 'animate-nabiz' : 'border-cizgi/60',
      )}
      style={uyari ? ({ borderColor: uyari, '--nabiz-renk': `${uyari}66` } as React.CSSProperties) : undefined}
      aria-label={`${k.ad}: ${durumMetni(k)}`}
    >
      <div className="flex items-center gap-3">
        <Maskot duygu={k.baskin} durum={durum} boyut={52} canli={false} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{k.ad}</span>
            <span className="shrink-0 text-silik" title={KAYNAK_ADI[k.kaynak]}>
              {KAYNAK_SIMGESI[k.kaynak]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: aktif ? DUYGU[k.baskin].renk : 'var(--color-silik)' }} />
            <span className={aktif ? 'text-soluk' : 'text-silik'}>{durumMetni(k)}</span>
          </div>
        </div>
        {k.sinyal && (
          <span
            className={sinif('grid h-7 w-7 shrink-0 place-items-center rounded-full', k.sinyal === 'soru' ? 'bg-gunes text-gece' : 'bg-d-ofkeli/20 text-d-ofkeli')}
            title={SINYAL_ADI[k.sinyal]}
            aria-label={SINYAL_ADI[k.sinyal]}
          >
            {SINYAL_SIMGESI[k.sinyal]}
          </span>
        )}
        {aktif && (
          <span className="rakam text-xl font-semibold" title="Dikkat">
            {Math.round(k.dikkat * 100)}
          </span>
        )}
      </div>
      <div className={sinif('flex items-center gap-3 transition-opacity', !aktif && 'opacity-30')}>
        <TayfCubugu dagilim={k.duygular} yukseklik={6} className="flex-1" />
        <Kivilcim degerler={k.iz.slice(-30)} genislik={56} yukseklik={18} />
      </div>
    </motion.button>
  );
});
