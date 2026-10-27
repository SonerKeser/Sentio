import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { baskin, DUYGU, yuzde } from '../../alan/duygular';
import { Maskot } from '../../bilesenler/Maskot';
import { Halka, sureYaz, TayfCubugu } from '../../bilesenler/ui';
import type { DersOzeti } from './ozet';

/** Dersin sonunda öğrenciye kendi özeti. Yalnızca bu cihazda hesaplanır, hiçbir yere gönderilmez. */
export function DersOzetiKarti({ ozet }: { ozet: DersOzeti }) {
  const duygu = baskin(ozet.dagilim);
  const yuzOrani = ozet.olcum > 0 ? ozet.yuzlu / ozet.olcum : 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 24 }}
      className="w-full max-w-xl rounded-[1.75rem] border border-cizgi bg-gece-2 p-6 text-left"
    >
      <div className="flex items-center gap-5">
        <Maskot duygu={duygu} boyut={96} />
        <div>
          <p className="text-sm text-soluk">Ders özetin</p>
          <p className="baslik text-2xl font-bold">Çoğunlukla {DUYGU[duygu].sifat} görünüyordun</p>
          <p className="text-sm text-silik">
            <span className="rakam">{sureYaz(ozet.sureMs)}</span> derste kaldın
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <Halka deger={ozet.dikkat} boyut={42} kalinlik={4} />
          <span className="text-sm">
            <span className="rakam block text-lg font-semibold leading-none">{yuzde(ozet.dikkat)}</span>
            <span className="text-silik">dikkat</span>
          </span>
        </div>
        <div className="text-sm">
          <span className="rakam block text-lg font-semibold leading-none">{yuzde(yuzOrani)}</span>
          <span className="text-silik">kamerada</span>
        </div>
        <div className="text-sm">
          <span className="rakam block text-lg font-semibold leading-none">{ozet.yoklama}</span>
          <span className="text-silik">yoklama yanıtı</span>
        </div>
      </div>
      <TayfCubugu dagilim={ozet.dagilim} yukseklik={10} className="mt-5" />
      <p className="mt-4 flex gap-2 text-xs text-silik">
        <ShieldCheck size={15} className="shrink-0 text-d-igrenme" />
        Bu özet yalnızca senin cihazında hesaplandı ve hiçbir yere gönderilmedi.
      </p>
    </motion.section>
  );
}
