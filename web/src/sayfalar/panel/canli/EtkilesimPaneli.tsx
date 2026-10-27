import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CircleHelp, Hand, ListChecks, RotateCcw, Snail, Square, Vote, X } from 'lucide-react';
import type { EtkilesimDurumu, SinyalTuru, YoklamaDurumu, YoklamaTuru } from '../../../api/turler';
import { Dugme } from '../../../bilesenler/ui';

const SABLONLAR: { tur: YoklamaTuru; ad: string; soru: string }[] = [
  { tur: 'anlama', ad: 'Anlaşıldı mı?', soru: 'Konu anlaşıldı mı?' },
  { tur: 'evetHayir', ad: 'Evet / Hayır', soru: '' },
  { tur: 'coktan', ad: 'Çoktan seçmeli', soru: '' },
  { tur: 'puan', ad: '1–5 puan', soru: 'Bu bölümü 1-5 arasında puanlar mısın?' },
];

const SECENEK_RENKLERI = ['#7BDB8A', '#FFC94A', '#FF6B5E', '#5AA9FF', '#A784FF', '#FF7AD9'];

function sureOnce(ms: number, simdi: number) {
  const sn = Math.max(0, Math.round((simdi - ms) / 1000));
  return sn < 60 ? `${sn} sn önce` : `${Math.round(sn / 60)} dk önce`;
}

/** "Sınıfın sesi": öğrencilerin kendi beyanları ve hızlı yoklama. */
export function EtkilesimPaneli({
  etkilesim,
  aktifOgrenci,
  simdi,
  molada,
  yoklamaBaslat,
  yoklamaKapat,
  soruYanitla,
  sinyalleriTemizle,
}: {
  etkilesim: EtkilesimDurumu | undefined;
  aktifOgrenci: number;
  simdi: number;
  molada: boolean;
  yoklamaBaslat: (tur: YoklamaTuru, soru: string, secenekler: string[]) => Promise<void>;
  yoklamaKapat: () => Promise<void>;
  soruYanitla: (id: number) => Promise<void>;
  sinyalleriTemizle: (tur: SinyalTuru) => Promise<void>;
}) {
  const sorular = etkilesim?.sorular ?? [];
  const yoklama = etkilesim?.yoklama ?? null;
  const [sonYoklama, setSonYoklama] = useState<YoklamaDurumu | null>(null);

  // Kapanan yoklamanın sonucu, yenisi açılana dek görünür kalır.
  useEffect(() => {
    if (yoklama) setSonYoklama(yoklama);
  }, [yoklama]);

  return (
    <section className="yuzey flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Sınıfın sesi</h2>

      <div className="grid grid-cols-2 gap-2">
        <SinyalSayaci simge={<CircleHelp size={17} />} ad="Anlamadım" sayi={etkilesim?.anlamadim ?? 0} toplam={aktifOgrenci} renk="#FF6B5E" temizle={() => sinyalleriTemizle('anlamadim')} />
        <SinyalSayaci simge={<Snail size={17} />} ad="Yavaşlayın" sayi={etkilesim?.yavasla ?? 0} toplam={aktifOgrenci} renk="#FFC94A" temizle={() => sinyalleriTemizle('yavasla')} />
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-soluk">
          <Hand size={15} /> Söz isteyenler {sorular.length > 0 && <span className="rakam rounded-pill bg-gunes px-2 text-gece">{sorular.length}</span>}
        </h3>
        {sorular.length === 0 ? (
          <p className="text-sm text-silik">Şu an söz isteyen yok.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {sorular.map((s) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="flex items-start gap-3 rounded-xl border border-gunes/30 bg-gunes/[0.06] p-2.5"
                >
                  <Hand size={17} className="mt-0.5 shrink-0 text-gunes" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.ad}</span>
                    {s.metin && <span className="block text-sm leading-snug text-metin/85">{s.metin}</span>}
                    <span className="text-xs text-silik">{sureOnce(s.zamanMs, simdi)}</span>
                  </span>
                  <button onClick={() => soruYanitla(s.id)} className="rounded-full p-1.5 text-soluk hover:bg-gece-3 hover:text-d-igrenme" aria-label={`${s.ad} yanıtlandı`} title="Yanıtlandı">
                    <Check size={17} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="border-t border-cizgi/60 pt-4">
        {yoklama ? (
          <YoklamaSonucu yoklama={yoklama} aktifOgrenci={aktifOgrenci} kapat={yoklamaKapat} />
        ) : (
          <YoklamaOlustur baslat={yoklamaBaslat} devreDisi={molada} son={sonYoklama} sonuGizle={() => setSonYoklama(null)} />
        )}
      </div>
    </section>
  );
}

function SinyalSayaci({ simge, ad, sayi, toplam, renk, temizle }: { simge: React.ReactNode; ad: string; sayi: number; toplam: number; renk: string; temizle: () => void }) {
  const oran = toplam > 0 ? sayi / toplam : 0;
  return (
    <div className="rounded-xl border border-cizgi/60 bg-gece p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-soluk" style={sayi > 0 ? { color: renk } : undefined}>
          {simge} {ad}
        </span>
        {sayi > 0 && (
          <button onClick={temizle} className="rounded-full p-1 text-silik hover:text-metin" title="Sıfırla (konuyu yeniden açtım)" aria-label={`${ad} sinyallerini sıfırla`}>
            <RotateCcw size={14} />
          </button>
        )}
      </div>
      <p className="rakam mt-1 text-2xl font-semibold">
        {sayi}
        <span className="text-sm font-normal text-silik"> / {toplam}</span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-gece-4">
        <motion.div className="h-full rounded-pill" style={{ background: renk }} animate={{ width: `${Math.min(1, oran) * 100}%` }} />
      </div>
    </div>
  );
}

export function YoklamaCubuklari({ secenekler, sayilar, yanitlayan }: { secenekler: string[]; sayilar: number[]; yanitlayan: number }) {
  const enCok = Math.max(1, ...sayilar);
  return (
    <div className="flex flex-col gap-1.5">
      {secenekler.map((s, i) => {
        const oran = yanitlayan > 0 ? sayilar[i] / yanitlayan : 0;
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-24 truncate text-soluk" title={s}>
              {s}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-gece-4">
              <motion.div
                className="h-full rounded-md"
                style={{ background: SECENEK_RENKLERI[i % SECENEK_RENKLERI.length], opacity: sayilar[i] === enCok ? 1 : 0.7 }}
                initial={false}
                animate={{ width: `${oran * 100}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
              />
            </div>
            <span className="rakam w-14 text-right">
              {sayilar[i]} <span className="text-xs text-silik">%{Math.round(oran * 100)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function YoklamaSonucu({ yoklama, aktifOgrenci, kapat }: { yoklama: YoklamaDurumu; aktifOgrenci: number; kapat: () => Promise<void> }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-d-korku">
            <Vote size={14} /> Yoklama açık
          </p>
          <p className="mt-1 font-semibold leading-snug">{yoklama.soru}</p>
        </div>
        <Dugme boyut="kucuk" tur="tehlike" simge={<Square size={13} />} onClick={kapat}>
          Kapat
        </Dugme>
      </div>
      <YoklamaCubuklari secenekler={yoklama.secenekler} sayilar={yoklama.sayilar} yanitlayan={yoklama.yanitlayan} />
      <p className="text-xs text-silik">
        <span className="rakam">{yoklama.yanitlayan}</span> yanıt, <span className="rakam">{aktifOgrenci}</span> aktif öğrenci
      </p>
    </div>
  );
}

function YoklamaOlustur({
  baslat,
  devreDisi,
  son,
  sonuGizle,
}: {
  baslat: (tur: YoklamaTuru, soru: string, secenekler: string[]) => Promise<void>;
  devreDisi: boolean;
  son: YoklamaDurumu | null;
  sonuGizle: () => void;
}) {
  const [tur, setTur] = useState<YoklamaTuru | null>(null);
  const [soru, setSoru] = useState('');
  const [secenekler, setSecenekler] = useState(['', '', '', '']);
  const [bekliyor, setBekliyor] = useState(false);

  const sec = (t: (typeof SABLONLAR)[number]) => {
    setTur(t.tur);
    setSoru(t.soru);
    setSecenekler(['', '', '', '']);
  };

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tur) return;
    setBekliyor(true);
    try {
      await baslat(tur, soru, secenekler.filter((s) => s.trim()));
      setTur(null);
    } finally {
      setBekliyor(false);
    }
  };

  if (!tur) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-soluk">
          <ListChecks size={15} /> Hızlı yoklama
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {SABLONLAR.map((t) => (
            <button
              key={t.tur}
              disabled={devreDisi}
              onClick={() => sec(t)}
              className="rounded-xl border border-cizgi bg-gece px-3 py-2 text-left text-sm font-medium hover:border-silik disabled:opacity-40"
            >
              {t.ad}
            </button>
          ))}
        </div>
        {son && (
          <div className="rounded-xl bg-gece p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm">
                <span className="text-silik">Son yoklama: </span>
                {son.soru}
              </p>
              <button onClick={sonuGizle} className="text-silik hover:text-metin" aria-label="Son sonucu gizle">
                <X size={15} />
              </button>
            </div>
            <YoklamaCubuklari secenekler={son.secenekler} sayilar={son.sayilar} yanitlayan={son.yanitlayan} />
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={gonder} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-soluk">{SABLONLAR.find((t) => t.tur === tur)?.ad}</h3>
      <input
        autoFocus
        value={soru}
        onChange={(e) => setSoru(e.target.value)}
        maxLength={200}
        required
        placeholder="Soru"
        className="h-10 rounded-xl border border-cizgi bg-gece px-3 text-[15px] outline-none focus:border-gunes/70"
      />
      {tur === 'coktan' && (
        <div className="grid grid-cols-2 gap-1.5">
          {secenekler.map((s, i) => (
            <input
              key={i}
              value={s}
              onChange={(e) => setSecenekler(secenekler.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={60}
              placeholder={`Seçenek ${String.fromCharCode(65 + i)}`}
              className="h-9 rounded-lg border border-cizgi bg-gece px-2.5 text-sm outline-none focus:border-gunes/70"
            />
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Dugme tur="hayalet" boyut="kucuk" type="button" onClick={() => setTur(null)}>
          Vazgeç
        </Dugme>
        <Dugme tur="birincil" boyut="kucuk" type="submit" yukleniyor={bekliyor} disabled={!soru.trim()} simge={<Vote size={15} />}>
          Sor
        </Dugme>
      </div>
      {tur === 'coktan' && <p className="text-xs text-silik">Boş bırakılan seçenekler gösterilmez; hepsi boşsa A, B, C, D kullanılır.</p>}
    </form>
  );
}

export const SINYAL_SIMGESI: Record<SinyalTuru, React.ReactNode> = {
  soru: <Hand size={13} />,
  anlamadim: <CircleHelp size={13} />,
  yavasla: <Snail size={13} />,
};

export const SINYAL_ADI: Record<SinyalTuru, string> = {
  soru: 'Söz istedi',
  anlamadim: 'Anlamadım dedi',
  yavasla: 'Yavaşlama istedi',
};

