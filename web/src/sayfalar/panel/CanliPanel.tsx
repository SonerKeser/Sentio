import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { HubConnectionState } from '@microsoft/signalr';
import { BarChart3, Bot, ChevronLeft, MonitorPlay, QrCode, Send, SlidersHorizontal, Square, Users, WifiOff } from 'lucide-react';
import { DUYGU, yuzde } from '../../alan/duygular';
import { useGaleriAnalizi } from '../../analiz/galeri';
import { api, hataMesaji } from '../../api/istemci';
import type { GaleriOkumasi, KatilimciAnligi } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Donen, Dugme, Halka, Pencere, sinif, sureYaz, TayfCubugu, useBildirim, useZamanlayici } from '../../bilesenler/ui';
import { DuyguAkisi, Gosterge } from './canli/DuyguAkisi';
import { GaleriBolumu } from './canli/GaleriBolumu';
import { OgrenciKarosu } from './canli/OgrenciKarosu';
import { AyarlarCekmecesi, KatilimPenceresi, OgrenciCekmecesi } from './canli/Pencereler';
import { UyariAkisi } from './canli/UyariAkisi';
import { useCanliOturum } from './canli/useCanliOturum';

type Siralama = 'onemli' | 'ad' | 'katilim';

const SINIF_MESAJLARI = ['Sorusu olan var mı?', 'Beş dakika mola veriyoruz.', 'Harika gidiyorsunuz!', 'Şimdi kısa bir alıştırma yapalım.'];

export default function CanliPanel() {
  const { id = '' } = useParams();
  const git = useNavigate();
  const bildir = useBildirim();
  const { oturum, setOturum, anlik, uyarilar, akis, baglanti, hata, hub } = useCanliOturum(id);
  const [secili, setSecili] = useState<string | null>(null);
  const [siralama, setSiralama] = useState<Siralama>('onemli');
  const [davet, setDavet] = useState(false);
  const [ayarlar, setAyarlar] = useState(false);
  const [simulasyon, setSimulasyon] = useState(false);
  const [bitirOnayi, setBitirOnayi] = useState(false);
  const [galeriAcik, setGaleriAcik] = useState(false);
  const simdi = useZamanlayici(1000);

  const galeriGonder = useCallback(
    (okumalar: GaleriOkumasi[]) => {
      if (hub.current?.state === HubConnectionState.Connected) hub.current.invoke('GaleriOkumalari', id, okumalar).catch(() => {});
    },
    [hub, id],
  );
  const galeri = useGaleriAnalizi(galeriGonder);

  useEffect(() => {
    if (oturum?.durum === 'bitti') galeri.durdur();
  }, [oturum?.durum, galeri.durdur]);

  const katilimcilar = useMemo(() => {
    // Sıralama kaba gruplarla yapılır; saniyelik küçük değişimler karoların sürekli yer değiştirmesine yol açmasın.
    const liste = [...(anlik?.katilimcilar ?? [])];
    const ad = (a: KatilimciAnligi, b: KatilimciAnligi) => a.ad.localeCompare(b.ad, 'tr');
    const grup = (k: KatilimciAnligi) => (k.uyariDuygusu ? 0 : k.durum !== 'aktif' || !k.yuz ? 2 : k.katilim < 0.4 ? 1 : 3);
    if (siralama === 'ad') liste.sort(ad);
    else if (siralama === 'katilim') liste.sort((a, b) => Math.round(b.katilim * 5) - Math.round(a.katilim * 5) || ad(a, b));
    else liste.sort((a, b) => grup(a) - grup(b) || ad(a, b));
    return liste;
  }, [anlik, siralama]);

  const seciliKatilimci = anlik?.katilimcilar.find((k) => k.id === secili) ?? null;

  const mesajGonder = async (katilimciId: string | null, metin: string) => {
    try {
      await hub.current?.invoke('MesajGonder', id, katilimciId, metin);
      bildir(katilimciId ? 'Mesaj öğrenciye iletildi.' : 'Mesaj tüm sınıfa iletildi.', 'basari');
    } catch (e) {
      bildir(hataMesaji(e), 'hata');
      throw e;
    }
  };

  const galeriAdDegistir = async (k: KatilimciAnligi, ad: string) => {
    if (!k.disKimlik) return;
    galeri.adDegistir(k.disKimlik, ad);
    await hub.current?.invoke('GaleriAdDegistir', id, k.disKimlik, ad).catch(() => {});
    bildir('Ad güncellendi.', 'basari');
  };

  const bitir = async () => {
    try {
      await api(`/api/oturumlar/${id}/bitir`, { method: 'POST' });
      git(`/panel/oturum/${id}/rapor`);
    } catch (e) {
      bildir((e as Error).message, 'hata');
    }
  };

  if (hata)
    return (
      <div className="grid min-h-[60dvh] place-items-center p-6 text-center">
        <div>
          <p className="text-d-ofkeli">{hata}</p>
          <Link to="/panel" className="mt-4 inline-block text-gunes">
            Derslere dön
          </Link>
        </div>
      </div>
    );
  if (!oturum)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-soluk">
        <Donen boyut={28} />
      </div>
    );

  const bitti = oturum.durum === 'bitti';
  const s = anlik?.sinif;
  const baslangic = new Date(oturum.olusturmaZamani).getTime();

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6">
      {/* Üst şerit */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link to="/panel" className="rounded-full p-2 text-silik hover:bg-gece-2 hover:text-metin" aria-label="Derslere dön">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{oturum.baslik}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-soluk">
            {oturum.sinifAdi && <span>{oturum.sinifAdi}</span>}
            {!bitti && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-d-ofkeli [--nabiz-renk:rgb(255_107_94/0.6)] animate-nabiz" />
                Canlı · <span className="rakam">{sureYaz(simdi - baslangic)}</span>
              </span>
            )}
            {baglanti !== 'bagli' && !bitti && (
              <span className="flex items-center gap-1 text-d-mutlu">
                <WifiOff size={14} /> {baglanti === 'baglaniyor' ? 'Bağlanıyor' : 'Yeniden bağlanıyor'}
              </span>
            )}
          </p>
        </div>

        {bitti ? (
          <Dugme tur="birincil" simge={<BarChart3 size={18} />} onClick={() => git(`/panel/oturum/${id}/rapor`)}>
            Raporu aç
          </Dugme>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setDavet(true)} className="flex h-10 items-center gap-2 rounded-pill border border-gunes/40 bg-gunes/10 pl-3 pr-4 font-semibold text-gunes hover:bg-gunes/15">
              <QrCode size={18} />
              <span className="rakam text-lg tracking-[0.16em]">{oturum.katilimKodu}</span>
            </button>
            <Dugme tur={galeriAcik ? 'birincil' : 'ikincil'} simge={<MonitorPlay size={17} />} onClick={() => setGaleriAcik(!galeriAcik)}>
              Galeri
            </Dugme>
            <Dugme simge={<Bot size={17} />} onClick={() => setSimulasyon(true)}>
              {oturum.simulasyonCalisiyor ? 'Sanal sınıf açık' : 'Sanal sınıf'}
            </Dugme>
            <Dugme tur="hayalet" simge={<SlidersHorizontal size={17} />} onClick={() => setAyarlar(true)} aria-label="Ders ayarları" />
            <Dugme tur="tehlike" simge={<Square size={15} />} onClick={() => setBitirOnayi(true)}>
              Dersi bitir
            </Dugme>
          </div>
        )}
      </header>

      <AnimatePresence>{galeriAcik && !bitti && <GaleriBolumu {...galeri} />}</AnimatePresence>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Sınıfın nabzı */}
          <section className="yuzey grid gap-6 p-5 md:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-5">
              <Maskot duygu={s?.baskin ?? 'notr'} durum={s && s.aktif > 0 ? 'aktif' : 'yok'} boyut={128} etiket="Sınıfın baskın ifadesi" />
              <div>
                <p className="text-sm text-soluk">Sınıfın havası</p>
                <p className="text-3xl font-bold baslik">{s?.baskin && s.aktif > 0 ? DUYGU[s.baskin].ad : 'Bekleniyor'}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-soluk">
                  <Users size={15} />
                  <span className="rakam">{s?.aktif ?? 0}</span> aktif / {s?.toplam ?? 0} katılımcı
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4">
              <div className="grid grid-cols-3 gap-3">
                <Olcu ad="Dikkat" deger={s?.dikkat ?? 0} renk="var(--color-gunes)" />
                <Olcu ad="Katılım" deger={s?.katilim ?? 0} renk="var(--color-d-saskin)" />
                <Olcu ad="Olumsuz ifade" deger={s?.olumsuzOran ?? 0} renk="var(--color-d-ofkeli)" />
              </div>
              <TayfCubugu dagilim={s?.dagilim ?? [1, 0, 0, 0, 0, 0, 0]} yukseklik={12} />
            </div>
          </section>

          {/* Zaman içinde ifade akışı */}
          <section className="yuzey p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Son 15 dakika</h2>
              <Gosterge />
            </div>
            <DuyguAkisi akis={akis} />
          </section>

          {/* Öğrenciler */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Öğrenciler <span className="text-silik">{katilimcilar.length}</span>
              </h2>
              <div className="flex rounded-pill border border-cizgi p-0.5 text-sm">
                {(
                  [
                    ['onemli', 'İlgi bekleyen önce'],
                    ['katilim', 'Katılım'],
                    ['ad', 'Ad'],
                  ] as [Siralama, string][]
                ).map(([deger, ad]) => (
                  <button key={deger} onClick={() => setSiralama(deger)} className={sinif('rounded-pill px-3 py-1', siralama === deger ? 'bg-gece-3 text-metin' : 'text-silik hover:text-soluk')}>
                    {ad}
                  </button>
                ))}
              </div>
            </div>
            {katilimcilar.length === 0 ? (
              <BosSinif kod={oturum.katilimKodu} davet={() => setDavet(true)} simulasyon={() => setSimulasyon(true)} bitti={bitti} />
            ) : (
              <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                <AnimatePresence>
                  {katilimcilar.map((k) => (
                    <OgrenciKarosu key={k.id} k={k} sec={setSecili} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </section>
        </div>

        {/* Sağ sütun: uyarılar ve sınıfa mesaj */}
        <aside className="flex flex-col gap-5 xl:sticky xl:top-5 xl:max-h-[calc(100dvh-2.5rem)]">
          {!bitti && <SinifaMesaj gonder={(m) => mesajGonder(null, m)} />}
          <section className="yuzey flex flex-col p-4 xl:min-h-0 xl:flex-1">
            <h2 className="mb-3 flex items-center justify-between text-lg font-semibold">
              Uyarılar <span className="rakam text-base text-silik">{uyarilar.filter((u) => u.tur !== 'ogretmenMesaji').length}</span>
            </h2>
            <div className="kaydirma-ince -mr-2 max-h-[28rem] overflow-y-auto pr-2 xl:max-h-none xl:min-h-0 xl:flex-1">
              <UyariAkisi uyarilar={uyarilar} sec={setSecili} />
            </div>
          </section>
        </aside>
      </div>

      <OgrenciCekmecesi k={seciliKatilimci} kapat={() => setSecili(null)} uyarilar={uyarilar} mesajGonder={mesajGonder} adDegistir={galeriAdDegistir} />
      <KatilimPenceresi acik={davet} kapat={() => setDavet(false)} oturum={oturum} />
      <AyarlarCekmecesi acik={ayarlar} kapat={() => setAyarlar(false)} oturum={oturum} kaydedildi={(a) => setOturum({ ...oturum, ayarlar: a })} />
      <SimulasyonPenceresi acik={simulasyon} kapat={() => setSimulasyon(false)} oturumId={id} calisiyor={oturum.simulasyonCalisiyor} degisti={(c) => setOturum({ ...oturum, simulasyonCalisiyor: c })} />
      <Pencere acik={bitirOnayi} kapat={() => setBitirOnayi(false)} baslik="Ders bitirilsin mi?">
        <p className="text-soluk">Öğrencilerin kameraları kapanır, bağlantıları sonlanır ve katılım kodu geçersiz olur. Ardından dersin raporunu göreceksiniz.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Dugme tur="hayalet" onClick={() => setBitirOnayi(false)}>
            Vazgeç
          </Dugme>
          <Dugme tur="birincil" onClick={bitir}>
            Dersi bitir
          </Dugme>
        </div>
      </Pencere>
    </div>
  );
}

function Olcu({ ad, deger, renk }: { ad: string; deger: number; renk: string }) {
  return (
    <div className="flex items-center gap-3">
      <Halka deger={deger} boyut={46} kalinlik={5} renk={renk} />
      <div>
        <p className="rakam text-2xl font-semibold leading-none">{yuzde(deger)}</p>
        <p className="mt-1 text-xs text-silik">{ad}</p>
      </div>
    </div>
  );
}

function SinifaMesaj({ gonder }: { gonder: (m: string) => Promise<void> }) {
  const [metin, setMetin] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const yolla = async (m: string) => {
    if (!m.trim()) return;
    setBekliyor(true);
    try {
      await gonder(m.trim());
      setMetin('');
    } catch {
      /* bildirim gösterildi */
    } finally {
      setBekliyor(false);
    }
  };
  return (
    <section className="yuzey p-4">
      <h2 className="mb-3 text-lg font-semibold">Sınıfa yaz</h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SINIF_MESAJLARI.map((m) => (
          <button key={m} onClick={() => yolla(m)} disabled={bekliyor} className="rounded-pill border border-cizgi px-2.5 py-1 text-[13px] text-soluk hover:border-silik hover:text-metin">
            {m}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          yolla(metin);
        }}
      >
        <input value={metin} onChange={(e) => setMetin(e.target.value)} maxLength={280} placeholder="Tüm öğrencilere…" className="h-10 min-w-0 flex-1 rounded-xl border border-cizgi bg-gece px-3 text-[15px] outline-none focus:border-gunes/70" />
        <Dugme tur="birincil" type="submit" disabled={!metin.trim()} yukleniyor={bekliyor} simge={<Send size={16} />} aria-label="Gönder" />
      </form>
    </section>
  );
}

function BosSinif({ kod, davet, simulasyon, bitti }: { kod: string; davet: () => void; simulasyon: () => void; bitti: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-kart border border-dashed border-cizgi/70 px-6 py-12 text-center">
      <Maskot duygu="saskin" boyut={110} />
      {bitti ? (
        <p className="text-soluk">Bu derse kimse katılmadı.</p>
      ) : (
        <>
          <p className="max-w-md text-soluk">
            Öğrenciler <span className="rakam font-bold tracking-widest text-gunes">{kod}</span> koduyla katıldıkça burada belirecek. Öğrencisiz denemek için sanal bir sınıf ekleyebilirsiniz.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Dugme tur="birincil" simge={<QrCode size={17} />} onClick={davet}>
              Öğrencileri davet et
            </Dugme>
            <Dugme simge={<Bot size={17} />} onClick={simulasyon}>
              Sanal sınıf ekle
            </Dugme>
          </div>
        </>
      )}
    </div>
  );
}

function SimulasyonPenceresi({ acik, kapat, oturumId, calisiyor, degisti }: { acik: boolean; kapat: () => void; oturumId: string; calisiyor: boolean; degisti: (c: boolean) => void }) {
  const [sayi, setSayi] = useState(16);
  const [bekliyor, setBekliyor] = useState(false);
  const bildir = useBildirim();
  const islem = async () => {
    setBekliyor(true);
    try {
      if (calisiyor) await api(`/api/oturumlar/${oturumId}/simulasyon`, { method: 'DELETE' });
      else await api(`/api/oturumlar/${oturumId}/simulasyon`, { method: 'POST', govde: { kisiSayisi: sayi } });
      degisti(!calisiyor);
      bildir(calisiyor ? 'Sanal sınıf durduruldu.' : `${sayi} sanal öğrenci derse katıldı.`, 'basari');
      kapat();
    } catch (e) {
      bildir((e as Error).message, 'hata');
    } finally {
      setBekliyor(false);
    }
  };
  return (
    <Pencere acik={acik} kapat={kapat} baslik="Sanal sınıf">
      <p className="text-soluk">
        Sanal öğrenciler gerçek öğrencilerle aynı yoldan geçer: ölçümleri kurallara takılır, uyarılar üretir ve rapora girer. Paneli tanıtmak ya da ayarları denemek için kullanın; raporda “Sanal öğrenci” olarak işaretlenirler.
      </p>
      {!calisiyor && (
        <div className="mt-5 flex gap-2">
          {[8, 16, 24, 32].map((n) => (
            <button key={n} onClick={() => setSayi(n)} className={sinif('rakam flex-1 rounded-xl border py-3 text-2xl font-semibold', sayi === n ? 'border-gunes text-gunes' : 'border-cizgi text-soluk')}>
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <Dugme tur={calisiyor ? 'tehlike' : 'birincil'} onClick={islem} yukleniyor={bekliyor}>
          {calisiyor ? 'Sanal sınıfı durdur' : `${sayi} öğrenciyle başlat`}
        </Dugme>
      </div>
    </Pencere>
  );
}
