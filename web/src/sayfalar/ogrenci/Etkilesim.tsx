import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CircleHelp, Coffee, Hand, Snail, Vote } from 'lucide-react';
import type { SinyalTuru, YoklamaBildirimi } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Dugme, Pencere, sinif, sureYaz, useZamanlayici } from '../../bilesenler/ui';

/** Öğrencinin kendi beyanı: duygu tahminini tamamlayan, açık ve isteğe bağlı sinyaller. */
export function SinyalCubugu({
  acik,
  gonder,
  geriAl,
  devreDisi,
}: {
  acik: Set<SinyalTuru>;
  gonder: (tur: SinyalTuru, metin?: string) => void;
  geriAl: (tur: SinyalTuru) => void;
  devreDisi?: boolean;
}) {
  const [soruAcik, setSoruAcik] = useState(false);
  const [soru, setSoru] = useState('');
  const elKalkik = acik.has('soru');

  const dugme = (tur: SinyalTuru, simge: React.ReactNode, etiket: string, acikEtiket: string) => {
    const aktif = acik.has(tur);
    return (
      <button
        type="button"
        disabled={devreDisi}
        aria-pressed={aktif}
        onClick={() => (aktif ? geriAl(tur) : tur === 'soru' ? setSoruAcik(true) : gonder(tur))}
        className={sinif(
          'inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-[15px] font-semibold transition-colors disabled:opacity-40',
          aktif ? 'border-gunes bg-gunes/15 text-gunes' : 'border-cizgi bg-gece-2 text-metin hover:border-silik',
        )}
      >
        {simge}
        {aktif ? acikEtiket : etiket}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {dugme('anlamadim', <CircleHelp size={18} />, 'Anlamadım', 'Anlamadım dedin')}
        {dugme('soru', <Hand size={18} />, 'Söz iste', 'Elin kalkık, indir')}
        {dugme('yavasla', <Snail size={18} />, 'Yavaşlar mısınız?', 'Yavaşlama istedin')}
      </div>
      <AnimatePresence>
        {soruAcik && !elKalkik && (
          <motion.form
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex w-full max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              gonder('soru', soru.trim() || undefined);
              setSoru('');
              setSoruAcik(false);
            }}
          >
            <input
              autoFocus
              value={soru}
              onChange={(e) => setSoru(e.target.value)}
              maxLength={200}
              placeholder="Sorun (isteğe bağlı)"
              className="h-11 min-w-0 flex-1 rounded-xl border border-cizgi bg-gece px-3.5 outline-none focus:border-gunes/70"
            />
            <Dugme tur="birincil" type="submit" simge={<Hand size={16} />}>
              Söz iste
            </Dugme>
            <Dugme tur="hayalet" type="button" onClick={() => setSoruAcik(false)}>
              Vazgeç
            </Dugme>
          </motion.form>
        )}
      </AnimatePresence>
      <p className="text-center text-xs text-silik">"Anlamadım" ve "Yavaşlar mısınız?" 90 saniye sonra kendiliğinden düşer. Öğretmenin adını görür.</p>
    </div>
  );
}

/** Öğretmenin açtığı hızlı yoklama. Yanıt, yoklama kapanana dek değiştirilebilir. */
export function YoklamaKarti({ yoklama, yanitla, kapat }: { yoklama: YoklamaBildirimi; yanitla: (secim: number) => void; kapat: () => void }) {
  const yanitlandi = yoklama.secim !== null;
  const puan = yoklama.tur === 'puan';
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-end p-4 sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#0d0a1f]/60 backdrop-blur-sm" onClick={kapat} />
      <motion.section
        role="dialog"
        aria-label="Yoklama"
        className="relative w-full max-w-lg rounded-[1.75rem] border border-cizgi bg-gece-2 p-6 shadow-2xl"
        initial={{ y: 40, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-d-korku">
          <Vote size={17} /> Öğretmeninden kısa bir soru
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-snug">{yoklama.soru}</h2>
        <div className={sinif('mt-5 grid gap-2', puan ? 'grid-cols-5' : yoklama.secenekler.length > 3 ? 'sm:grid-cols-2' : '')}>
          {yoklama.secenekler.map((s, i) => {
            const secili = yoklama.secim === i;
            return (
              <button
                key={i}
                onClick={() => yanitla(i)}
                className={sinif(
                  'flex min-h-13 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-lg font-semibold transition-colors',
                  secili ? 'border-gunes bg-gunes text-gece' : 'border-cizgi bg-gece hover:border-silik',
                  puan && 'rakam text-2xl',
                )}
              >
                {secili && !puan && <Check size={18} />}
                {s}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <span className={yanitlandi ? 'text-d-igrenme' : 'text-silik'}>
            {yanitlandi ? 'Yanıtın alındı. Yoklama kapanana dek değiştirebilirsin.' : 'Yanıtın yalnızca öğretmenine gider.'}
          </span>
          <button onClick={kapat} className="font-semibold text-soluk hover:text-metin">
            {yanitlandi ? 'Kapat' : 'Sonra'}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

const MOLA_IPUCLARI = [
  'Ekrandan uzaklaş, 20 saniye boyunca uzaktaki bir noktaya bak.',
  'Bir bardak su iç.',
  'Ayağa kalk, omuzlarını ve boynunu esnet.',
  'Pencereyi aç, biraz temiz hava al.',
  'Gözlerini kapat ve birkaç derin nefes al.',
];

/** Molada kamera kapalıdır ve ölçüm gönderilmez; öğretmen sınıfı "molada" olarak görür. */
export function MolaEkrani({ bitisMs }: { bitisMs: number }) {
  const simdi = useZamanlayici(1000);
  const [ipucu, setIpucu] = useState(0);
  useEffect(() => {
    const z = setInterval(() => setIpucu((i) => (i + 1) % MOLA_IPUCLARI.length), 9000);
    return () => clearInterval(z);
  }, []);
  const kalan = Math.max(0, bitisMs - simdi);
  return (
    <motion.div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-gece px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="animate-suzul">
        <Maskot duygu="mutlu" boyut={220} etiket="Molada" />
      </div>
      <p className="flex items-center gap-2 text-lg font-semibold text-d-mutlu">
        <Coffee size={20} /> Mola
      </p>
      <p className="rakam text-8xl font-bold tabular-nums">{sureYaz(kalan)}</p>
      <AnimatePresence mode="wait">
        <motion.p key={ipucu} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="max-w-md text-xl text-soluk">
          {MOLA_IPUCLARI[ipucu]}
        </motion.p>
      </AnimatePresence>
      <p className="text-sm text-silik">Kameran mola boyunca kapalı. Ders sürünce kendiliğinden açılır.</p>
    </motion.div>
  );
}

export function AyrilPenceresi({ acik, kapat, ayril }: { acik: boolean; kapat: () => void; ayril: (verileriSil: boolean) => void }) {
  const [sil, setSil] = useState(false);
  return (
    <Pencere acik={acik} kapat={kapat} baslik="Dersten ayrıl">
      <p className="text-soluk">Kameran kapanır ve bağlantın sonlanır. Ders sürdükçe aynı kodla yeniden katılabilirsin.</p>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-cizgi/70 p-4">
        <input type="checkbox" checked={sil} onChange={(e) => setSil(e.target.checked)} className="mt-1 h-5 w-5 accent-[#FF6B5E]" />
        <span>
          <span className="block font-semibold">Bu dersteki verilerimi sil</span>
          <span className="text-sm text-silik">Ölçümlerin, yoklama yanıtların ve beyanların sunucudan kalıcı olarak silinir; raporda adın görünmez.</span>
        </span>
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <Dugme tur="hayalet" onClick={kapat}>
          Vazgeç
        </Dugme>
        <Dugme tur={sil ? 'tehlike' : 'birincil'} onClick={() => ayril(sil)}>
          {sil ? 'Sil ve ayrıl' : 'Ayrıl'}
        </Dugme>
      </div>
    </Pencere>
  );
}
