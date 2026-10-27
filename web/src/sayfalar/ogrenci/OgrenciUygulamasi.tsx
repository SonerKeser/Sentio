import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Cpu, EyeOff, PauseCircle, ShieldCheck } from 'lucide-react';
import { api, ApiHatasi } from '../../api/istemci';
import type { KatilimOnizleme, KatilimYaniti } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Logo } from '../../bilesenler/marka';
import { Alan, Dugme, sinif } from '../../bilesenler/ui';
import { DersEkrani } from './DersEkrani';

const ANAHTAR = 'sezgi.katilim';

interface Basvuru {
  kod: string;
  ad: string;
  onizleme: KatilimOnizleme;
}

type Adim = { tur: 'form' } | { tur: 'onay'; basvuru: Basvuru } | { tur: 'ders'; katilim: KatilimYaniti } | { tur: 'veda'; neden: 'ayrildi' | 'bitti' };

function kayitliKatilim(): KatilimYaniti | null {
  try {
    const k = sessionStorage.getItem(ANAHTAR);
    return k ? (JSON.parse(k) as KatilimYaniti) : null;
  } catch {
    return null;
  }
}

export default function OgrenciUygulamasi() {
  const [adim, setAdim] = useState<Adim | null>(null);

  // Sayfa yenilendiyse aynı sekmedeki katılım sürdürülür.
  useEffect(() => {
    const kayit = kayitliKatilim();
    if (!kayit) {
      setAdim({ tur: 'form' });
      return;
    }
    api<KatilimYaniti>('/api/katilimci/ben', { jeton: kayit.jeton })
      .then((g) => setAdim({ tur: 'ders', katilim: { ...g, jeton: kayit.jeton } }))
      .catch(() => {
        sessionStorage.removeItem(ANAHTAR);
        setAdim({ tur: 'form' });
      });
  }, []);

  const bitir = (neden: 'ayrildi' | 'bitti') => {
    sessionStorage.removeItem(ANAHTAR);
    setAdim({ tur: 'veda', neden });
  };

  if (!adim) return <div className="min-h-dvh" />;

  return (
    <AnimatePresence mode="wait">
      {adim.tur === 'form' && (
        <Sahne key="form">
          <KatilimFormu tamam={(b) => setAdim({ tur: 'onay', basvuru: b })} />
        </Sahne>
      )}
      {adim.tur === 'onay' && (
        <Sahne key="onay">
          <OnayEkrani
            basvuru={adim.basvuru}
            katildi={(katilim) => {
              sessionStorage.setItem(ANAHTAR, JSON.stringify(katilim));
              setAdim({ tur: 'ders', katilim });
            }}
            vazgec={() => setAdim({ tur: 'form' })}
          />
        </Sahne>
      )}
      {adim.tur === 'ders' && (
        <motion.div key="ders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DersEkrani katilim={adim.katilim} bitti={bitir} />
        </motion.div>
      )}
      {adim.tur === 'veda' && (
        <Sahne key="veda">
          <Veda neden={adim.neden} yeniden={() => setAdim({ tur: 'form' })} />
        </Sahne>
      )}
    </AnimatePresence>
  );
}

function Sahne({ children }: { children: React.ReactNode }) {
  return (
    <motion.main
      className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6 sm:px-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="mb-8">
        <Logo />
      </header>
      {children}
    </motion.main>
  );
}

function KatilimFormu({ tamam }: { tamam: (b: Basvuru) => void }) {
  const { kod: adresKodu } = useParams();
  const [kod, setKod] = useState((adresKodu ?? '').toUpperCase().slice(0, 6));
  const [ad, setAd] = useState(() => localStorage.getItem('sezgi.ad') ?? '');
  const [onizleme, setOnizleme] = useState<KatilimOnizleme | null>(null);
  const [kodHatasi, setKodHatasi] = useState<string | null>(null);
  const temizKod = kod.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  useEffect(() => {
    setOnizleme(null);
    setKodHatasi(null);
    if (temizKod.length !== 6) return;
    const iptal = new AbortController();
    api<KatilimOnizleme>(`/api/katil/${temizKod}`, { signal: iptal.signal })
      .then(setOnizleme)
      .catch((e) => !iptal.signal.aborted && setKodHatasi(e instanceof ApiHatasi ? e.message : 'Kod doğrulanamadı.'));
    return () => iptal.abort();
  }, [temizKod]);

  // Katılım kaydı ancak açık rıza onaylandıktan sonra oluşturulur.
  const gonder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onizleme) return;
    try {
      localStorage.setItem('sezgi.ad', ad.trim());
    } catch {
      /* özel pencere */
    }
    tamam({ kod: temizKod, ad: ad.trim(), onizleme });
  };

  return (
    <div className="grid flex-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={gonder} className="flex max-w-md flex-col gap-6">
        <div>
          <h1 className="text-5xl font-bold leading-[0.95] sm:text-6xl">Derse katıl</h1>
          <p className="mt-4 text-lg text-soluk">Öğretmeninin paylaştığı altı karakterlik kodu ve adını yaz.</p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-soluk">Ders kodu</span>
          <input
            value={kod}
            onChange={(e) => setKod(e.target.value.toUpperCase().slice(0, 7))}
            placeholder="K7M2QX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            aria-invalid={!!kodHatasi}
            className={sinif(
              'rakam h-20 rounded-2xl border bg-gece-2 px-5 text-center text-5xl font-bold tracking-[0.25em] uppercase outline-none transition-colors placeholder:text-gece-4 focus:border-gunes/70',
              kodHatasi ? 'border-d-ofkeli/70' : onizleme ? 'border-d-igrenme/60' : 'border-cizgi',
            )}
          />
          <AnimatePresence mode="wait">
            {onizleme ? (
              <motion.span key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-[15px] text-d-igrenme">
                <Check size={18} /> {onizleme.baslik}
                {onizleme.sinifAdi ? `, ${onizleme.sinifAdi}` : ''} · {onizleme.ogretmenAdi}
              </motion.span>
            ) : kodHatasi ? (
              <motion.span key="hata" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[15px] text-d-ofkeli">
                {kodHatasi}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </label>

        <Alan etiket="Adın ve soyadın" value={ad} onChange={(e) => setAd(e.target.value)} autoComplete="name" maxLength={60} placeholder="Ör. Defne Arslan" />

        <Dugme tur="birincil" boyut="buyuk" type="submit" disabled={!onizleme || ad.trim().length < 2}>
          Devam et
        </Dugme>
      </form>

      <div className="hidden justify-center md:flex">
        <div className="animate-suzul">
          <Maskot duygu={onizleme ? 'mutlu' : 'notr'} boyut={300} etiket="Sezgi maskotu" />
        </div>
      </div>
    </div>
  );
}

function OnayEkrani({ basvuru, katildi, vazgec }: { basvuru: Basvuru; katildi: (k: KatilimYaniti) => void; vazgec: () => void }) {
  const [okudum, setOkudum] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const { onizleme } = basvuru;
  const onayla = async () => {
    setBekliyor(true);
    setHata(null);
    try {
      katildi(await api<KatilimYaniti>('/api/katil', { method: 'POST', govde: { kod: basvuru.kod, ad: basvuru.ad } }));
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
      setBekliyor(false);
    }
  };
  const maddeler = [
    { simge: <Cpu size={22} />, metin: 'Kameran yalnızca bu cihazda, tarayıcının içinde çözümlenir. Görüntü kaydedilmez ve hiçbir yere gönderilmez.' },
    { simge: <ShieldCheck size={22} />, metin: `${onizleme.ogretmenAdi} adlı öğretmenine saniyede bir yalnızca sayılar gider: yedi ifade olasılığı, dikkat ve göz açıklığı tahmini.` },
    { simge: <PauseCircle size={22} />, metin: 'İstediğin an Duraklat ile kamerayı kapatabilirsin. Ders bitince bağlantı kendiliğinden sonlanır.' },
    { simge: <EyeOff size={22} />, metin: 'Sistem duygularını bilemez; yalnızca yüzündeki görünür ifadeyi kabaca sınıflar ve yanılabilir. Bir not ya da değerlendirme aracı değildir.' },
  ];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7">
      <div>
        <p className="text-soluk">
          {onizleme.baslik}
          {onizleme.sinifAdi ? `, ${onizleme.sinifAdi}` : ''}
        </p>
        <h1 className="mt-1 text-4xl font-bold sm:text-5xl">Başlamadan önce, {basvuru.ad.split(' ')[0]}</h1>
      </div>
      <ul className="flex flex-col gap-3">
        {maddeler.map((m, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * i }}
            className="flex gap-4 rounded-2xl border border-cizgi/60 bg-gece-2 p-4"
          >
            <span className="mt-0.5 text-gunes">{m.simge}</span>
            <span className="text-[15px] leading-relaxed text-metin/90">{m.metin}</span>
          </motion.li>
        ))}
      </ul>
      <label className="flex cursor-pointer items-start gap-3 text-[15px]">
        <input type="checkbox" checked={okudum} onChange={(e) => setOkudum(e.target.checked)} className="mt-1 h-5 w-5 accent-[#FFC94A]" />
        <span>Okudum; kameramın bu ders süresince cihazımda çözümlenmesine açık rıza veriyorum.</span>
      </label>
      {hata && <p className="text-d-ofkeli">{hata}</p>}
      <div className="flex flex-wrap gap-3">
        <Dugme tur="birincil" boyut="buyuk" disabled={!okudum} yukleniyor={bekliyor} onClick={onayla}>
          Kamerayı aç ve katıl
        </Dugme>
        <Dugme tur="hayalet" boyut="buyuk" onClick={vazgec}>
          Vazgeç
        </Dugme>
      </div>
    </div>
  );
}

function Veda({ neden, yeniden }: { neden: 'ayrildi' | 'bitti'; yeniden: () => void }) {
  const git = useNavigate();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Maskot duygu="mutlu" boyut={220} />
      <h1 className="text-4xl font-bold">{neden === 'bitti' ? 'Ders bitti' : 'Dersten ayrıldın'}</h1>
      <p className="max-w-md text-lg text-soluk">Kameran kapatıldı ve bağlantı sonlandırıldı. Katıldığın için teşekkürler.</p>
      <div className="flex gap-3">
        <Dugme tur="ikincil" onClick={yeniden}>
          Başka bir derse katıl
        </Dugme>
        <Dugme tur="hayalet" onClick={() => git('/')}>
          Ana sayfa
        </Dugme>
      </div>
    </div>
  );
}
