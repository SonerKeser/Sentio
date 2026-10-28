import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { Eye, EyeOff, LogOut, Pause, Play, ShieldCheck, Vote, Wifi, WifiOff } from 'lucide-react';
import { baskin, DUYGU, yuzde } from '../../alan/duygular';
import { useKameraAnalizi, type AnlikIfade } from '../../analiz/kamera';
import { hubBaglantisi } from '../../api/istemci';
import type { DurtmeBildirimi, KatilimYaniti, MolaBildirimi, OgrenciAyarlari, OgrenciDurumu, OkumaGirdisi, SinyalTuru, YoklamaBildirimi } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Logo } from '../../bilesenler/marka';
import { Donen, Dugme, Halka, sinif, TayfCubugu, useBildirim, useKalici } from '../../bilesenler/ui';
import { masaustu } from '../../ortam';
import { durtmeIcerigi, type DurtmeIcerigi } from './durtmeler';
import { AyrilPenceresi, MolaEkrani, SinyalCubugu, YoklamaKarti } from './Etkilesim';
import { OzetToplayici, type DersOzeti } from './ozet';

/** "Anlamadım" ve "Yavaşlar mısınız" sunucuda olduğu gibi burada da 90 saniye sonra düşer. */
const SINYAL_OMRU_MS = 90_000;

type BaglantiDurumu = 'baglaniyor' | 'bagli' | 'yeniden' | 'kopuk';

export function DersEkrani({ katilim, bitti }: { katilim: KatilimYaniti; bitti: (neden: 'ayrildi' | 'bitti', ozet?: DersOzeti) => void }) {
  const [ayarlar, setAyarlar] = useState<OgrenciAyarlari>(katilim.ayarlar);
  const [yoklama, setYoklama] = useState<YoklamaBildirimi | null>(null);
  const [yoklamaGizli, setYoklamaGizli] = useState(false);
  const [molaBitis, setMolaBitis] = useState<number | null>(null);
  const [acikSinyaller, setAcikSinyaller] = useState<Set<SinyalTuru>>(new Set());
  const [ayrilAcik, setAyrilAcik] = useState(false);
  const ozetRef = useRef(new OzetToplayici());
  const sinyalZamanlari = useRef(new Map<SinyalTuru, ReturnType<typeof setTimeout>>());
  const bildir = useBildirim();
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;
  const [duraklatildi, setDuraklatildi] = useState(false);
  const [baglanti, setBaglanti] = useState<BaglantiDurumu>('baglaniyor');
  const [durtme, setDurtme] = useState<DurtmeIcerigi | null>(null);
  const [onizleme, setOnizleme] = useKalici('sentio.onizleme', true);
  const hubRef = useRef<HubConnection | null>(null);
  const bittiRef = useRef(bitti);
  bittiRef.current = bitti;

  useEffect(() => {
    const hub = hubBaglantisi('/hub/ogrenci', () => katilim.jeton);
    hubRef.current = hub;
    hub.on('Ayarlar', (a: OgrenciAyarlari) => setAyarlar(a));
    hub.on('Durum', (d: OgrenciDurumu) => {
      setAyarlar(d.ayarlar);
      setYoklama(d.yoklama);
      setMolaBitis(d.mola?.bitisMs ?? null);
      setAcikSinyaller(new Set(d.acikSinyaller));
    });
    hub.on('Yoklama', (y: YoklamaBildirimi) => {
      setYoklama(y);
      setYoklamaGizli(false);
      masaustu()?.durtme({ baslik: 'Öğretmeninden kısa bir soru', metin: y.soru });
    });
    hub.on('YoklamaKapandi', (id: string) => setYoklama((y) => (y?.id === id ? null : y)));
    hub.on('Mola', (m: MolaBildirimi | null) => setMolaBitis(m?.bitisMs ?? null));
    hub.on('SinyalKapandi', (tur: SinyalTuru) => {
      setAcikSinyaller((s) => {
        const yeni = new Set(s);
        yeni.delete(tur);
        return yeni;
      });
      if (tur === 'soru') bildirRef.current('Öğretmenin söz isteğini gördü.', 'basari');
    });
    hub.on('OturumBitti', () => bittiRef.current('bitti', ozetRef.current.sonuc(false)));
    hub.on('Durtme', (d: DurtmeBildirimi) => {
      const icerik = durtmeIcerigi(d);
      setDurtme(icerik);
      masaustu()?.durtme({ baslik: icerik.baslik, metin: icerik.metin });
    });
    hub.onreconnecting(() => setBaglanti('yeniden'));
    hub.onreconnected(() => setBaglanti('bagli'));
    hub.onclose(() => setBaglanti('kopuk'));

    let iptal = false;
    const baslat = async () => {
      try {
        await hub.start();
        if (!iptal) setBaglanti('bagli');
      } catch {
        if (iptal) return;
        setBaglanti('kopuk');
        setTimeout(baslat, 4000);
      }
    };
    baslat();
    return () => {
      iptal = true;
      hub.stop();
    };
  }, [katilim.jeton]);

  const okuma = useCallback((o: OkumaGirdisi) => {
    const hub = hubRef.current;
    if (hub?.state !== HubConnectionState.Connected) return;
    hub.send('Okuma', o).catch(() => {});
    ozetRef.current.ekle(o);
  }, []);

  const molada = molaBitis !== null;
  const { videoRef, durum, hata, anlik } = useKameraAnalizi({ etkin: !duraklatildi && !molada, orneklemeMs: ayarlar.orneklemeMs, okuma });

  const sinyalDegis = (tur: SinyalTuru, acik: boolean) =>
    setAcikSinyaller((s) => {
      const yeni = new Set(s);
      if (acik) yeni.add(tur);
      else yeni.delete(tur);
      return yeni;
    });

  const sinyalGonder = async (tur: SinyalTuru, metin?: string) => {
    const hub = hubRef.current;
    if (hub?.state !== HubConnectionState.Connected) return;
    const tamam = await hub.invoke<boolean>('Sinyal', tur, metin ?? null).catch(() => false);
    if (!tamam) {
      bildir('Birkaç saniye sonra yeniden dene.', 'bilgi');
      return;
    }
    ozetRef.current.sinyalGonderildi();
    sinyalDegis(tur, true);
    clearTimeout(sinyalZamanlari.current.get(tur));
    if (tur !== 'soru') sinyalZamanlari.current.set(tur, setTimeout(() => sinyalDegis(tur, false), SINYAL_OMRU_MS));
  };

  const sinyalGeriAl = async (tur: SinyalTuru) => {
    sinyalDegis(tur, false);
    clearTimeout(sinyalZamanlari.current.get(tur));
    await hubRef.current?.invoke('SinyalGeriAl', tur).catch(() => {});
  };

  const yoklamaYanitla = async (secim: number) => {
    if (!yoklama) return;
    const tamam = await hubRef.current?.invoke<boolean>('YoklamaYanitla', yoklama.id, secim).catch(() => false);
    if (tamam) {
      ozetRef.current.yoklamaYanitlandi(yoklama.id);
      setYoklama({ ...yoklama, secim });
      setTimeout(() => setYoklamaGizli(true), 900);
    }
  };

  const duraklat = async (d: boolean) => {
    setDuraklatildi(d);
    if (hubRef.current?.state === HubConnectionState.Connected) await hubRef.current.invoke('Duraklat', d).catch(() => {});
  };

  const ayril = async (verileriSil: boolean) => {
    if (hubRef.current?.state === HubConnectionState.Connected) await hubRef.current.invoke('Ayril', verileriSil).catch(() => {});
    bitti('ayrildi', ozetRef.current.sonuc(verileriSil));
  };

  const duygu = anlik?.yuz ? baskin(anlik.d) : 'notr';
  const kendiniGor = ayarlar.ogrenciKendiniGorsun;
  const maskotDurumu = duraklatildi ? 'duraklatildi' : !anlik?.yuz && durum === 'calisiyor' ? 'yok' : anlik && anlik.goz < 0.2 ? 'uykulu' : 'aktif';

  useEffect(() => {
    masaustu()?.durum({ metin: duraklatildi ? 'Analiz duraklatıldı' : `${katilim.baslik} dersindesin`, aktif: !duraklatildi });
  }, [duraklatildi, katilim.baslik]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-soluk sm:inline">
            {katilim.baslik} · {katilim.ogretmenAdi}
          </span>
          <BaglantiRozeti durum={baglanti} />
        </div>
      </header>

      <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col items-center text-center">
          <div className={sinif(maskotDurumu === 'aktif' && 'animate-suzul')}>
            <Maskot duygu={kendiniGor ? duygu : 'notr'} durum={maskotDurumu} boyut={280} etiket="Anlık ifaden" />
          </div>
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
            {duraklatildi
              ? 'Analiz duraklatıldı'
              : durum === 'model'
                ? 'Analiz motoru hazırlanıyor'
                : durum === 'izin'
                  ? 'Kamera izni bekleniyor'
                  : durum === 'hata'
                    ? 'Kamera açılamadı'
                    : !anlik?.yuz
                      ? 'Yüzünü göremiyorum'
                      : kendiniGor
                        ? `Şu an ${DUYGU[duygu].sifat} görünüyorsun`
                        : 'Analiz sürüyor'}
          </h1>
          <p className="mt-2 max-w-md text-soluk">
            {duraklatildi
              ? 'Kameran kapalı ve öğretmenine hiçbir ölçüm gitmiyor. Hazır olduğunda sürdür.'
              : durum === 'hata'
                ? hata
                : durum === 'model'
                  ? 'Modeller ilk seferde bu sunucudan indirilir; birkaç saniye sürebilir.'
                  : 'Derse odaklanabilirsin. Bu pencereyi kapatma; arka planda çalışmaya devam eder.'}
          </p>

          {!duraklatildi && (
            <div className="mt-6 w-full">
              <SinyalCubugu acik={acikSinyaller} gonder={sinyalGonder} geriAl={sinyalGeriAl} devreDisi={baglanti !== 'bagli'} />
            </div>
          )}

          {kendiniGor && anlik?.yuz && !duraklatildi && (
            <div className="mt-6 flex w-full max-w-sm items-center gap-4">
              <Halka deger={anlik.dikkat} boyut={52}>
                <span className="rakam text-sm font-semibold">{Math.round(anlik.dikkat * 100)}</span>
              </Halka>
              <div className="flex-1 text-left">
                <div className="mb-1.5 flex justify-between text-xs text-silik">
                  <span>Dikkat {yuzde(anlik.dikkat)}</span>
                  <span>İfade dağılımı</span>
                </div>
                <TayfCubugu dagilim={anlik.d} yukseklik={10} />
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="yuzey overflow-hidden">
            <div className="relative aspect-[4/3] bg-gece">
              <video ref={videoRef} playsInline muted className={sinif('h-full w-full -scale-x-100 object-cover transition-opacity', (!onizleme || duraklatildi) && 'opacity-0')} />
              {onizleme && !duraklatildi && anlik?.mesh && <AgKatmani anlik={anlik} />}
              {(durum === 'model' || durum === 'izin') && (
                <div className="absolute inset-0 grid place-items-center text-soluk">
                  <Donen boyut={26} />
                </div>
              )}
              {(!onizleme || duraklatildi) && durum !== 'model' && (
                <div className="absolute inset-0 grid place-items-center text-sm text-silik">{duraklatildi ? 'Kamera kapalı' : 'Önizleme gizli'}</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-soluk">
                <ShieldCheck size={16} className="text-d-igrenme" /> Görüntün bu cihazdan çıkmıyor
              </span>
              <button onClick={() => setOnizleme(!onizleme)} className="rounded-full p-1.5 text-soluk hover:bg-gece-3 hover:text-metin" aria-label={onizleme ? 'Önizlemeyi gizle' : 'Önizlemeyi göster'}>
                {onizleme ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Dugme tur={duraklatildi ? 'birincil' : 'ikincil'} boyut="buyuk" simge={duraklatildi ? <Play size={18} /> : <Pause size={18} />} onClick={() => duraklat(!duraklatildi)}>
            {duraklatildi ? 'Analizi sürdür' : 'Duraklat'}
          </Dugme>
          {yoklama && yoklamaGizli && (
            <Dugme tur="ikincil" simge={<Vote size={17} />} onClick={() => setYoklamaGizli(false)}>
              {yoklama.secim === null ? 'Açık yoklamayı yanıtla' : 'Yoklama yanıtını gör'}
            </Dugme>
          )}
          <Dugme tur="hayalet" simge={<LogOut size={16} />} onClick={() => setAyrilAcik(true)}>
            Dersten ayrıl
          </Dugme>
          {masaustu() && (
            <button onClick={() => masaustu()?.sunucuDegistir()} className="text-sm text-silik underline-offset-4 hover:text-soluk hover:underline">
              Başka bir sunucuya bağlan
            </button>
          )}
        </aside>
      </section>

      <AnimatePresence>{durtme && !molada && <DurtmeKarti icerik={durtme} kapat={() => setDurtme(null)} />}</AnimatePresence>
      <AnimatePresence>{yoklama && !yoklamaGizli && !molada && <YoklamaKarti yoklama={yoklama} yanitla={yoklamaYanitla} kapat={() => setYoklamaGizli(true)} />}</AnimatePresence>
      <AnimatePresence>{molaBitis !== null && <MolaEkrani bitisMs={molaBitis} />}</AnimatePresence>
      <AyrilPenceresi acik={ayrilAcik} kapat={() => setAyrilAcik(false)} ayril={ayril} />
    </main>
  );
}

function BaglantiRozeti({ durum }: { durum: BaglantiDurumu }) {
  const bagli = durum === 'bagli';
  return (
    <span className={sinif('inline-flex items-center gap-1.5 rounded-pill border px-3 py-1', bagli ? 'border-d-igrenme/40 text-d-igrenme' : 'border-d-mutlu/40 text-d-mutlu')}>
      {bagli ? <Wifi size={14} /> : <WifiOff size={14} />}
      {durum === 'bagli' ? 'Bağlı' : durum === 'baglaniyor' ? 'Bağlanıyor' : durum === 'yeniden' ? 'Yeniden bağlanıyor' : 'Bağlantı yok'}
    </span>
  );
}

/** Yüz ağının noktalarını önizlemenin üzerine çizer; öğrenci analizin neye baktığını görür. */
function AgKatmani({ anlik }: { anlik: AnlikIfade }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const tuval = ref.current;
    const mesh = anlik.mesh;
    if (!tuval || !mesh) return;
    tuval.width = anlik.genislik;
    tuval.height = anlik.yukseklik;
    const c = tuval.getContext('2d')!;
    c.clearRect(0, 0, tuval.width, tuval.height);
    c.fillStyle = DUYGU[baskin(anlik.d)].renk;
    c.globalAlpha = 0.75;
    for (let i = 0; i < mesh.length; i += 2) {
      const [x, y] = mesh[i];
      c.fillRect(x - 1, y - 1, 2, 2);
    }
  }, [anlik]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />;
}

function DurtmeKarti({ icerik, kapat }: { icerik: DurtmeIcerigi; kapat: () => void }) {
  const [ifade, setIfade] = useState(icerik.ilkIfade);
  useEffect(() => {
    setIfade(icerik.ilkIfade);
    const donus = setTimeout(() => setIfade(icerik.sonIfade), 1400);
    const kapanis = setTimeout(kapat, 14_000);
    return () => {
      clearTimeout(donus);
      clearTimeout(kapanis);
    };
  }, [icerik, kapat]);

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#0d0a1f]/75 backdrop-blur-md" onClick={kapat} />
      <motion.div
        role="alertdialog"
        aria-live="assertive"
        className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-[2rem] border border-cizgi bg-gece-2 px-7 pb-7 pt-4 text-center shadow-2xl"
        initial={{ y: 40, scale: 0.9 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <motion.div className="-mt-20" initial={{ y: 30, rotate: -8 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}>
          <Maskot duygu={ifade} boyut={170} />
        </motion.div>
        <h2 className="text-2xl font-bold">{icerik.baslik}</h2>
        <p className="text-lg leading-relaxed text-metin/85">{icerik.metin}</p>
        <Dugme tur="birincil" boyut="buyuk" className="mt-2 w-full" onClick={kapat} autoFocus>
          Tamam
        </Dugme>
      </motion.div>
    </motion.div>
  );
}
