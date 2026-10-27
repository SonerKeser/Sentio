import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ChartLine, LayoutGrid, LogOut, Settings } from 'lucide-react';
import { api } from '../../api/istemci';
import type { HesapDurumu, OgretmenBilgisi } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Logo, LogoIsareti } from '../../bilesenler/marka';
import { Alan, Donen, Dugme, sinif } from '../../bilesenler/ui';

interface PanelBaglami {
  ogretmen: OgretmenBilgisi;
  surum: string;
}

const Baglam = createContext<PanelBaglami | null>(null);
export const usePanel = () => useContext(Baglam)!;

export default function PanelKabugu() {
  const [durum, setDurum] = useState<HesapDurumu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const git = useNavigate();

  const yenile = useCallback(() => {
    api<HesapDurumu>('/api/hesap/durum')
      .then(setDurum)
      .catch((e) => setHata(e.message));
  }, []);
  useEffect(yenile, [yenile]);

  const cikis = async () => {
    await api('/api/hesap/cikis', { method: 'POST' }).catch(() => {});
    setDurum((d) => (d ? { ...d, ogretmen: null } : d));
    git('/panel');
  };

  if (hata) return <div className="grid min-h-dvh place-items-center p-6 text-center text-d-ofkeli">{hata}</div>;
  if (!durum)
    return (
      <div className="grid min-h-dvh place-items-center text-soluk">
        <Donen boyut={28} />
      </div>
    );
  if (!durum.ogretmen) return <GirisEkrani kurulum={durum.kurulumGerekli} tamam={yenile} />;

  return (
    <Baglam.Provider value={{ ogretmen: durum.ogretmen, surum: durum.surum }}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <nav className="yazdirma-gizle flex shrink-0 items-center gap-1 border-b border-cizgi/60 bg-gece px-4 py-2.5 lg:sticky lg:top-0 lg:h-dvh lg:w-[76px] lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-5">
          <NavLink to="/" className="mr-3 lg:mb-6 lg:mr-0" aria-label="Sezgi ana sayfa">
            <LogoIsareti boyut={34} />
          </NavLink>
          <RayBag to="/panel" end simge={<LayoutGrid size={21} />} etiket="Dersler" />
          <RayBag to="/panel/analitik" simge={<ChartLine size={21} />} etiket="Analitik" />
          <RayBag to="/panel/ayarlar" simge={<Settings size={21} />} etiket="Ayarlar" />
          <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:mt-auto lg:flex-col">
            <span
              title={durum.ogretmen.adSoyad}
              className="grid h-9 w-9 place-items-center rounded-full bg-gece-3 text-sm font-semibold text-soluk"
            >
              {durum.ogretmen.adSoyad
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </span>
            <button onClick={cikis} className="rounded-xl p-2.5 text-silik hover:bg-gece-3 hover:text-metin" aria-label="Çıkış yap" title="Çıkış yap">
              <LogOut size={19} />
            </button>
          </div>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </Baglam.Provider>
  );
}

function RayBag({ to, simge, etiket, end }: { to: string; simge: React.ReactNode; etiket: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={etiket}
      className={({ isActive }) =>
        sinif(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:h-12 lg:w-12 lg:justify-center lg:p-0',
          isActive ? 'bg-gece-3 text-gunes' : 'text-silik hover:bg-gece-2 hover:text-metin',
        )
      }
    >
      {simge}
      <span className="lg:sr-only">{etiket}</span>
    </NavLink>
  );
}

function GirisEkrani({ kurulum, tamam }: { kurulum: boolean; tamam: () => void }) {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [parola, setParola] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    try {
      await api(kurulum ? '/api/hesap/kurulum' : '/api/hesap/giris', {
        method: 'POST',
        govde: kurulum ? { kullaniciAdi, adSoyad, parola } : { kullaniciAdi, parola },
      });
      tamam();
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-cizgi/60 bg-gece-2 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div className="flex items-end gap-6">
          {(['mutlu', 'saskin', 'notr'] as const).map((d, i) => (
            <motion.div key={d} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 * i, type: 'spring', stiffness: 120 }}>
              <Maskot duygu={d} boyut={[150, 110, 130][i]} />
            </motion.div>
          ))}
        </div>
        <p className="max-w-md text-2xl leading-snug text-metin/90 baslik">
          Ekranın öbür ucundaki sınıfı, yüzler cihazdan çıkmadan hissedin.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <form onSubmit={gonder} className="flex w-full max-w-sm flex-col gap-5">
          <div>
            <h1 className="text-4xl font-bold">{kurulum ? 'Sezgi’yi kuralım' : 'Öğretmen girişi'}</h1>
            <p className="mt-2 text-soluk">
              {kurulum ? 'Bu sunucunun ilk hesabını oluşturun. Bu hesap diğer öğretmenleri ekleyebilen yönetici olur.' : 'Ders başlatmak ve raporlarınızı görmek için giriş yapın.'}
            </p>
          </div>
          {kurulum && <Alan etiket="Ad soyad" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} autoComplete="name" required />}
          <Alan etiket="Kullanıcı adı" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} autoComplete="username" required />
          <Alan
            etiket="Parola"
            type="password"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            autoComplete={kurulum ? 'new-password' : 'current-password'}
            ipucu={kurulum ? 'En az 8 karakter.' : undefined}
            required
          />
          {hata && <p className="text-d-ofkeli">{hata}</p>}
          <Dugme tur="birincil" boyut="buyuk" type="submit" yukleniyor={bekliyor}>
            {kurulum ? 'Hesabı oluştur' : 'Giriş yap'}
          </Dugme>
        </form>
      </section>
    </main>
  );
}
