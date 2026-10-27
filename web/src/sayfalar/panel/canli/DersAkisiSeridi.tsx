import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Coffee, Flag, Plus } from 'lucide-react';
import type { EtkilesimDurumu } from '../../../api/turler';
import { Dugme, sinif, sureYaz } from '../../../bilesenler/ui';

const ONERILER = ['Giriş', 'Konu anlatımı', 'Örnek çözüm', 'Alıştırma', 'Soru-cevap', 'Tekrar'];

/**
 * Dersin bölümleri: öğretmen konuyu değiştirdikçe yeni bölüm açar, gerektiğinde mola verir.
 * Grafikte ve raporda bölümler bant olarak görünür; rapor bölüm başına ölçüm verir.
 */
export function DersAkisiSeridi({
  etkilesim,
  simdi,
  bolumBaslat,
  molaBaslat,
  molaBitir,
}: {
  etkilesim: EtkilesimDurumu | undefined;
  simdi: number;
  bolumBaslat: (ad: string) => Promise<void>;
  molaBaslat: (dakika: number) => Promise<void>;
  molaBitir: () => Promise<void>;
}) {
  const [ad, setAd] = useState('');
  const [molaMenusu, setMolaMenusu] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const aktif = etkilesim?.bolum ?? null;
  const gecmis = (etkilesim?.bolumler ?? []).filter((b) => b.bitisMs !== null && !b.mola);
  const molada = aktif?.mola ?? false;

  const calistir = async (is: () => Promise<void>) => {
    setBekliyor(true);
    try {
      await is();
    } finally {
      setBekliyor(false);
    }
  };

  const baslat = (yeni: string) => {
    if (!yeni.trim()) return;
    calistir(() => bolumBaslat(yeni.trim()));
    setAd('');
  };

  return (
    <section className={sinif('yuzey flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3', molada && 'border-d-mutlu/50 bg-d-mutlu/[0.06]')}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={sinif('grid h-9 w-9 shrink-0 place-items-center rounded-xl', molada ? 'bg-d-mutlu/20 text-d-mutlu' : 'bg-gece-3 text-gunes')}>
          {molada ? <Coffee size={18} /> : <Flag size={18} />}
        </span>
        {molada && aktif?.molaBitisMs ? (
          <div>
            <p className="font-semibold">Mola</p>
            <p className="text-sm text-soluk">
              <span className="rakam">{sureYaz(aktif.molaBitisMs - simdi)}</span> kaldı, kameralar kapalı
            </p>
          </div>
        ) : aktif ? (
          <div className="min-w-0">
            <p className="truncate font-semibold">{aktif.ad}</p>
            <p className="text-sm text-soluk">
              <span className="rakam">{sureYaz(simdi - aktif.baslangicMs)}</span> sürüyor
            </p>
          </div>
        ) : (
          <p className="text-sm text-soluk">Dersi bölümlere ayırın; rapor her bölümü ayrı değerlendirir.</p>
        )}
      </div>

      {gecmis.length > 0 && (
        <div className="kaydirma-ince hidden min-w-0 flex-1 gap-1.5 overflow-x-auto md:flex">
          {gecmis.slice(-5).map((b) => (
            <span key={b.id} className="shrink-0 rounded-pill bg-gece px-2.5 py-1 text-xs text-silik" title={`${b.ad}: ${sureYaz((b.bitisMs ?? simdi) - b.baslangicMs)}`}>
              {b.ad}
            </span>
          ))}
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {molada ? (
          <Dugme tur="birincil" boyut="kucuk" yukleniyor={bekliyor} onClick={() => calistir(molaBitir)}>
            Molayı bitir
          </Dugme>
        ) : (
          <>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                baslat(ad);
              }}
            >
              <input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                list="bolum-onerileri"
                maxLength={80}
                placeholder="Yeni bölüm"
                className="h-8 w-40 rounded-pill border border-cizgi bg-gece px-3 text-sm outline-none focus:border-gunes/70"
              />
              <datalist id="bolum-onerileri">
                {ONERILER.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
              <Dugme boyut="kucuk" type="submit" disabled={!ad.trim() || bekliyor} simge={<Plus size={15} />} aria-label="Bölümü başlat" />
            </form>
            <div className="relative">
              <Dugme boyut="kucuk" simge={<Coffee size={15} />} onClick={() => setMolaMenusu(!molaMenusu)}>
                Mola
              </Dugme>
              <AnimatePresence>
                {molaMenusu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-10 z-20 flex gap-1 rounded-2xl border border-cizgi bg-gece-3 p-1.5 shadow-xl"
                  >
                    {[5, 10, 15].map((dk) => (
                      <button
                        key={dk}
                        onClick={() => {
                          setMolaMenusu(false);
                          calistir(() => molaBaslat(dk));
                        }}
                        className="rakam rounded-xl px-3 py-2 text-sm font-semibold hover:bg-gece-4"
                      >
                        {dk} dk
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
