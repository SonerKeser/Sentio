import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowDown, Camera, ChartLine, CircleHelp, Coffee, Cpu, Flag, Hand, LayoutDashboard, MonitorPlay, Server, Snail } from 'lucide-react';
import { DUYGU, DUYGULAR, type Duygu } from '../../alan/duygular';
import { Maskot } from '../../bilesenler/Maskot';
import { GithubSimgesi, Logo } from '../../bilesenler/marka';
import { sinif } from '../../bilesenler/ui';
import { DEPO, SURUM, TANITIM_MODU } from '../../ortam';
import { CanliSinif } from './CanliSinif';
import { Indirmeler } from './Indirmeler';

export function Tanitim() {
  return (
    <div className="overflow-x-clip">
      <Ust />
      <Kahraman />
      <Gizlilik />
      <Akis />
      <PanelBolumu />
      <section id="indir" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-8">
        <h2 className="text-5xl font-bold sm:text-6xl">İndir ve kur</h2>
        <p className="mt-4 max-w-2xl text-lg text-soluk">
          Sezgi üç parçadan oluşur: bir sunucu, öğrenci ve öğretmen bilgisayarları için bir masaüstü uygulaması ve kurulum gerektirmeyen web istemcisi. Bir ders için sunucu ve bir tarayıcı yeterlidir.
        </p>
        <div className="mt-10">
          <Indirmeler />
        </div>
      </section>
      <Sorumluluk />
      <Sss />
      <Alt />
    </div>
  );
}

function Ust() {
  const [kaydi, setKaydi] = useState(false);
  useEffect(() => {
    const dinle = () => setKaydi(window.scrollY > 24);
    dinle();
    window.addEventListener('scroll', dinle, { passive: true });
    return () => window.removeEventListener('scroll', dinle);
  }, []);
  return (
    <header className={sinif('sticky top-0 z-40 transition-colors', kaydi && 'border-b border-cizgi/60 bg-gece/85 backdrop-blur-md')}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-8">
        <Logo />
        <div className="ml-6 hidden gap-6 text-[15px] text-soluk md:flex">
          <a href="#gizlilik" className="hover:text-metin">Gizlilik</a>
          <a href="#akis" className="hover:text-metin">Nasıl çalışır</a>
          <a href="#panel" className="hover:text-metin">Panel</a>
          <a href="#indir" className="hover:text-metin">İndir</a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={DEPO} target="_blank" rel="noreferrer" className="rounded-full p-2 text-soluk hover:bg-gece-2 hover:text-metin" aria-label="GitHub deposu">
            <GithubSimgesi boyut={20} />
          </a>
          {TANITIM_MODU ? (
            <a href="#indir" className="inline-flex h-10 items-center rounded-pill bg-gunes px-4 font-semibold text-gece hover:bg-gunes-koyu">
              İndir
            </a>
          ) : (
            <>
              <Link to="/katil" className="hidden h-10 items-center rounded-pill px-4 font-semibold text-metin hover:bg-gece-2 sm:inline-flex">
                Derse katıl
              </Link>
              <Link to="/panel" className="inline-flex h-10 items-center rounded-pill bg-gunes px-4 font-semibold text-gece hover:bg-gunes-koyu">
                Öğretmen paneli
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function Kahraman() {
  const azHareket = useReducedMotion();
  const giris = (gecikme: number) =>
    azHareket ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: gecikme, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-10 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:pt-16">
      <div>
        <motion.h1 {...giris(0)} className="text-[clamp(3rem,7.5vw,5.6rem)] font-extrabold leading-[0.9]" style={{ fontVariationSettings: '"wdth" 78, "opsz" 96' }}>
          Ekranın öbür ucundaki sınıfı hissedin.
        </motion.h1>
        <motion.p {...giris(0.12)} className="mt-7 max-w-xl text-xl leading-relaxed text-soluk">
          Sezgi, çevrim içi derste öğrencilerin yüz ifadesini ve dikkatini kendi cihazlarında çözümler; size yalnızca sınıfın nabzını gönderir. Görüntü hiçbir zaman cihazdan çıkmaz.
        </motion.p>
        <motion.div {...giris(0.22)} className="mt-9 flex flex-wrap gap-3">
          <a href="#indir" className="inline-flex h-13 items-center gap-2 rounded-pill bg-gunes px-6 text-base font-semibold text-gece shadow-[0_10px_30px_-12px_rgb(255_201_74/0.9)] hover:bg-gunes-koyu">
            Sunucuyu indir
          </a>
          {TANITIM_MODU ? (
            <a href="#gizlilik" className="inline-flex h-13 items-center gap-2 rounded-pill border border-cizgi px-6 text-base font-semibold hover:bg-gece-2">
              Nasıl çalıştığını gör <ArrowDown size={18} />
            </a>
          ) : (
            <Link to="/panel" className="inline-flex h-13 items-center gap-2 rounded-pill border border-cizgi px-6 text-base font-semibold hover:bg-gece-2">
              Paneli aç
            </Link>
          )}
        </motion.div>
        <motion.ul {...giris(0.32)} className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-silik">
          <li>Açık kaynak, MIT lisansı</li>
          <li>Windows, macOS, Linux, Docker</li>
          <li>İnternetsiz yerel ağda çalışır</li>
        </motion.ul>
      </div>
      <motion.div initial={azHareket ? false : { opacity: 0, y: 30, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
        <CanliSinif />
      </motion.div>
    </section>
  );
}

const PAKET = `{
  "d": [0.62, 0.21, 0.08, 0.04, 0.01, 0.03, 0.01],
  "dikkat": 0.86,
  "goz": 0.93,
  "yuz": true
}`;

function Gizlilik() {
  const azHareket = useReducedMotion();
  const adimlar = [
    { simge: <Camera size={22} />, baslik: 'Kamera', metin: 'Saniyede birkaç kare, yalnızca tarayıcının belleğinde.' },
    { simge: <Cpu size={22} />, baslik: 'Cihazdaki model', metin: 'Yüz bulma, 468 noktalı yüz ağı, ifade sınıflandırma; ekran kartında.' },
    { simge: <Server size={22} />, baslik: 'Sezgi sunucusu', metin: 'Sayıları yumuşatır, kuralları işletir, saklar.' },
    { simge: <LayoutDashboard size={22} />, baslik: 'Öğretmen paneli', metin: 'Canlı sınıf nabzı, uyarılar, rapor.' },
  ];
  return (
    <section id="gizlilik" className="scroll-mt-20 border-y border-cizgi/60 bg-gece-2/50">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-5xl font-bold sm:text-6xl">Görüntü cihazda kalır.</h2>
          <p className="mt-5 text-lg leading-relaxed text-soluk">
            Yüz çözümlemesi öğrencinin kendi tarayıcısında, kendi ekran kartında yapılır. Sunucuya ve öğretmene saniyede bir yalnızca sağdaki gibi birkaç sayı gider: yedi ifadenin olasılığı, dikkat ve göz açıklığı tahmini. Fotoğraf, video ya da yüz izi
            saklanmaz.
          </p>
          <ol className="mt-10 flex flex-col gap-1">
            {adimlar.map((a, i) => (
              <li key={a.baslik} className="relative flex gap-4 pb-6 last:pb-0">
                {i < adimlar.length - 1 && <span className="absolute left-[22px] top-12 h-[calc(100%-3rem)] w-px bg-cizgi" />}
                <span className={sinif('grid h-11 w-11 shrink-0 place-items-center rounded-xl', i < 2 ? 'bg-d-igrenme/15 text-d-igrenme' : 'bg-gece-3 text-gunes')}>{a.simge}</span>
                <div>
                  <p className="font-semibold">
                    {a.baslik}
                    {i === 1 && <span className="ml-2 rounded-pill bg-d-igrenme/15 px-2 py-0.5 text-xs font-medium text-d-igrenme">cihazın içinde</span>}
                  </p>
                  <p className="text-soluk">{a.metin}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col justify-center gap-6">
          <div className="relative overflow-hidden rounded-kart border border-cizgi bg-gece p-6">
            <p className="mb-3 text-sm text-silik">Bir öğrencinin bir saniyede gönderdiği her şey</p>
            <pre className="text-[15px] leading-relaxed text-metin/90">
              <code>{PAKET}</code>
            </pre>
            {!azHareket && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-gunes/10 to-transparent"
                initial={{ x: '-30%' }}
                animate={{ x: '520%' }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
              />
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DUYGULAR.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5 text-center">
                <Maskot duygu={d} boyut={44} canli={false} />
                <span className="text-[11px] leading-tight text-soluk">{DUYGU[d].ad}</span>
                <span className="rakam text-xs text-silik">d[{i}]</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Akis() {
  const adimlar: { baslik: string; metin: string; duygu: Duygu }[] = [
    { baslik: 'Dersi başlatın', metin: 'Panelde bir ders açın. Sezgi altı karakterlik bir kod ve karekod üretir; kalıcılık eşiği, izlenen ifadeler ve anonim mod derse özeldir.', duygu: 'notr' },
    { baslik: 'Öğrenciler kodla katılır', metin: 'Tarayıcıdan ya da masaüstü uygulamasından; açık rıza ekranını onaylayan öğrencinin kamerası kendi cihazında çözümlenmeye başlar.', duygu: 'saskin' },
    { baslik: 'Sınıfın nabzını izleyin', metin: 'İfade, dikkat ve sınıfın havası saniye saniye akar. Dersi bölümlere ayırır, yoklama açar, mola verirsiniz; öğrenciler de "Anlamadım" diyebilir ya da söz isteyebilir.', duygu: 'mutlu' },
    { baslik: 'Raporla değerlendirin', metin: 'Ders bitince bölüm bölüm ölçümler, yoklama sonuçları, ısı haritası ve öğrenci özetleri hazırdır. Dönem analitiği dersleri birbiriyle karşılaştırır.', duygu: 'mutlu' },
  ];
  return (
    <section id="akis" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-8">
      <h2 className="max-w-3xl text-5xl font-bold sm:text-6xl">Bir dersin akışı</h2>
      <ol className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
        {adimlar.map((a, i) => (
          <motion.li key={a.baslik} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.1, duration: 0.55 }} className="relative">
            <div className="flex items-end gap-3">
              <span className="rakam text-6xl font-bold leading-none text-gece-4">{i + 1}</span>
              <Maskot duygu={a.duygu} boyut={46} canli={false} />
            </div>
            <h3 className="mt-5 text-2xl font-bold">{a.baslik}</h3>
            <p className="mt-2 leading-relaxed text-soluk">{a.metin}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function PanelBolumu() {
  const uyarilar = [
    { renk: DUYGU.uzgun.renk, metin: 'Kerem yaklaşık 20 sn’dir üzgün görünüyor.', alt: 'Öğrenciye destek mesajı gitti' },
    { renk: DUYGU.mutlu.renk, metin: 'Arda son 30 sn’de ekrana pek bakmıyor (dikkat %22).', alt: '14:32' },
    { renk: DUYGU.ofkeli.renk, metin: 'Olumsuz ifade taşıyan öğrenci oranı %45 ve bu durum 15 sn’dir sürüyor.', alt: 'Sınıf geneli' },
  ];
  const harita: Duygu[][] = [
    ['notr', 'notr', 'mutlu', 'mutlu', 'notr', 'saskin', 'notr', 'korku', 'korku', 'notr', 'mutlu', 'mutlu', 'notr', 'notr'],
    ['mutlu', 'mutlu', 'mutlu', 'notr', 'notr', 'notr', 'uzgun', 'uzgun', 'uzgun', 'notr', 'notr', 'mutlu', 'mutlu', 'notr'],
    ['notr', 'saskin', 'notr', 'notr', 'notr', 'notr', 'korku', 'uzgun', 'notr', 'notr', 'saskin', 'notr', 'notr', 'mutlu'],
    ['notr', 'notr', 'notr', 'igrenme', 'notr', 'mutlu', 'notr', 'korku', 'korku', 'korku', 'notr', 'notr', 'mutlu', 'mutlu'],
  ];
  return (
    <section id="panel" className="scroll-mt-20 border-y border-cizgi/60 bg-gece-2/50">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <h2 className="max-w-3xl text-5xl font-bold sm:text-6xl">Panel, dikkatinizi gerektiren anı söyler.</h2>
        <p className="mt-5 max-w-2xl text-lg text-soluk">
          Tek tek yüzlere bakmanız gerekmez. Sezgi kısa dalgalanmaları süzer; bir öğrencinin ifadesi belirlediğiniz süre boyunca olumsuz kalırsa ya da sınıfın büyük kısmı zorlanıyorsa haber verir.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold">Uyarılar ve destek bildirimleri</h3>
            <p className="text-soluk">Kalıcı olumsuz ifade, dikkat dağınıklığı, yorgunluk ve kamerada görünmeme. Öğrenciye giden mesaj suçlayıcı değil, cesaretlendiricidir.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {uyarilar.map((u) => (
                <li key={u.metin} className="flex gap-3 rounded-xl border border-cizgi/60 bg-gece p-3 text-sm">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: u.renk }} />
                  <span>
                    <span className="block">{u.metin}</span>
                    <span className="text-xs text-silik">{u.alt}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold">Isı haritası ve rapor</h3>
            <p className="text-soluk">Her satır bir öğrenci, her sütun bir zaman dilimi. Dersin hangi anında kimin zorlandığı tek bakışta görünür; Excel çıktısı aynı tabloyu renkleriyle taşır.</p>
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-cizgi/60 bg-gece p-4">
              {harita.map((satir, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-14 text-xs text-soluk">{['Ada', 'Kerem', 'Ece', 'Arda'][i]}</span>
                  <div className="grid flex-1 grid-cols-[repeat(14,1fr)] gap-[3px]">
                    {satir.map((d, j) => (
                      <motion.span
                        key={j}
                        className="h-5 rounded-[3px]"
                        style={{ background: DUYGU[d].renk }}
                        initial={{ opacity: 0, scaleY: 0.3 }}
                        whileInView={{ opacity: 1, scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: j * 0.03 + i * 0.05 }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <OgrencininSesi />

        <div className="mt-16 grid items-center gap-8 rounded-kart border border-cizgi/70 bg-gece p-6 md:grid-cols-[auto_1fr] md:p-8">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gece-3 text-d-saskin">
            <MonitorPlay size={30} />
          </span>
          <div>
            <h3 className="text-2xl font-bold">Öğrenci bir şey kuramıyorsa: galeri analizi</h3>
            <p className="mt-2 leading-relaxed text-soluk">
              Zoom, Meet ya da Teams penceresini panele paylaşın. Galerideki yüzler sizin tarayıcınızda, küçük yüzleri kaçırmamak için döşemelere bölünerek çözümlenir; kişiler galeri düzeni değişse de izlenir ve adlandırılabilir. Eski
              sistemdeki ekran görüntüsü yaklaşımının çağdaş, sunucuya görüntü göndermeyen karşılığı.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Duygu tahminini tamamlayan açık beyanlar: yoklama ve öğrenci sinyalleri. */
function OgrencininSesi() {
  const secenekler: [string, number, string][] = [
    ['Anladım', 0.58, '#7BDB8A'],
    ['Kısmen', 0.25, '#FFC94A'],
    ['Anlamadım', 0.17, '#FF6B5E'],
  ];
  const ozellikler = [
    { simge: <Flag size={18} />, ad: 'Ders bölümleri', metin: 'Konu değiştikçe yeni bölüm açın; rapor her bölümü ayrı değerlendirir, en zorlayıcı olanı işaretler.' },
    { simge: <Coffee size={18} />, ad: 'Mola', metin: 'Geri sayım boyunca kameralar kapanır, uyarı üretilmez; süre dolunca ders kaldığı yerden sürer.' },
    { simge: <ChartLine size={18} />, ad: 'Dönem analitiği', metin: 'Bir sınıfın dersler boyunca katılımı, anlama oranı ve ilgi bekleyen öğrenciler tek sayfada.' },
  ];
  return (
    <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h3 className="text-3xl font-bold">Yüz ifadesi tek başına yetmez</h3>
        <p className="mt-3 max-w-xl leading-relaxed text-soluk">
          Öğrenci tek dokunuşla “Anlamadım” diyebilir, söz isteyebilir ya da yavaşlamanızı isteyebilir. Siz de anlama, evet/hayır, çoktan seçmeli ya da puan yoklaması açarsınız. Bu açık beyanlar
          ifade tahminiyle birlikte raporda ve analitikte buluşur.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {ozellikler.map((o) => (
            <li key={o.ad} className="flex gap-3">
              <span className="mt-0.5 text-gunes">{o.simge}</span>
              <span>
                <span className="font-semibold">{o.ad}</span>
                <span className="block text-soluk">{o.metin}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-kart border border-cizgi/60 bg-gece p-5">
          <p className="text-xs font-semibold text-d-korku">Yoklama açık</p>
          <p className="mt-1 font-semibold">Snell yasası anlaşıldı mı?</p>
          <div className="mt-4 flex flex-col gap-2">
            {secenekler.map(([ad, oran, renk], i) => (
              <div key={ad} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-soluk">{ad}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-gece-4">
                  <motion.div
                    className="h-full rounded-md"
                    style={{ background: renk }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${oran * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 90, damping: 18 }}
                  />
                </div>
                <span className="rakam w-10 text-right">%{Math.round(oran * 100)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-silik">22 yanıt, 24 aktif öğrenci</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              [<CircleHelp key="a" size={17} />, 'Anlamadım', '3', '#FF6B5E'],
              [<Hand key="s" size={17} />, 'Söz isteyen', '2', '#FFC94A'],
              [<Snail key="y" size={17} />, 'Yavaşlayın', '1', '#FFC94A'],
            ] as [React.ReactNode, string, string, string][]
          ).map(([simge, ad, sayi, renk]) => (
            <div key={ad} className="rounded-2xl border border-cizgi/60 bg-gece p-3">
              <span className="flex items-center gap-1.5 text-sm" style={{ color: renk }}>
                {simge} {ad}
              </span>
              <span className="rakam mt-1 block text-2xl font-semibold">{sayi}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sorumluluk() {
  const maddeler = [
    ['Açık rıza önce gelir', 'Öğrenci, kameranın ne için ve nasıl kullanılacağını okuyup onaylamadan analiz başlamaz. İstediği an duraklatabilir; duraklatınca kamera kapanır.'],
    ['İfade, duygu değildir', 'Yüz ifadesi iç dünyanın kesin bir göstergesi değildir; model kültüre, ışığa ve açıya göre yanılabilir. Sezgi bu yüzden tek tek karelere değil kalıcı eğilimlere bakar.'],
    ['Notlandırma aracı değildir', 'Raporlar dersin akışını iyileştirmek içindir. Öğrenciyi değerlendirmek, cezalandırmak ya da sıralamak için kullanılmamalıdır.'],
    ['Mevzuata uyun', 'KVKK kapsamında aydınlatma ve açık rıza gerekir. AB Yapay Zekâ Yasası, eğitim kurumlarında duygu çıkarımı yapan sistemleri tıbbi ve güvenlik amaçları dışında yasaklar; AB’de kullanmayın. Araştırmalarda etik kurul onayı alın.'],
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Maskot duygu="notr" boyut={120} />
          <h2 className="mt-6 text-5xl font-bold">Sorumlu kullanım</h2>
          <p className="mt-4 text-lg text-soluk">Sezgi akademik bir fikirden doğdu ve öyle kullanılmalı: öğrencinin rızasıyla, öğretmene yardımcı olmak için.</p>
        </div>
        <dl className="grid gap-6 sm:grid-cols-2">
          {maddeler.map(([b, m]) => (
            <div key={b} className="border-t border-cizgi pt-4">
              <dt className="text-lg font-semibold">{b}</dt>
              <dd className="mt-2 leading-relaxed text-soluk">{m}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Sss() {
  const sorular = [
    ['İnternet bağlantısı gerekir mi?', 'Hayır. Sunucu, analiz modelleri dahil her şeyi kendisi barındırır. Okulun yerel ağında, dışarıya hiç çıkmadan çalışabilir.'],
    ['Hangi video konferans araçlarıyla çalışır?', 'Hepsiyle. Öğrenci istemcisi konferans aracından bağımsız çalışır; galeri analizi ise paylaşılabilen her pencereyi çözümler.'],
    ['Öğrenci bilgisayarı yeterince güçlü olmalı mı?', 'Sıradan bir dizüstü yeterlidir. Analiz saniyede yaklaşık altı kare işler ve ekran kartını kullanır; ekran kartı yoksa işlemciye geçer.'],
    ['Veriler nerede ve ne kadar saklanır?', 'Yalnızca sizin sunucunuzdaki SQLite veritabanında. Biten dersler varsayılan olarak 180 gün sonra kendiliğinden silinir; süre ayarlanabilir, dersler panelden hemen silinebilir. Öğrenci dersten ayrılırken kendi verilerinin silinmesini de seçebilir.'],
    ['Yedek nasıl alınır?', 'Yönetici hesabıyla Ayarlar sayfasındaki "Yedek indir" düğmesi, sunucu çalışırken tutarlı bir veritabanı kopyası indirir.'],
    ['Tarayıcı neden kamera izni vermiyor?', 'Tarayıcılar kamerayı yalnızca https ya da localhost üzerinde açar. Yerel ağda https yoksa Sezgi Masaüstü uygulaması bu kısıtı sizin sunucunuz için güvenle kaldırır.'],
  ];
  return (
    <section className="border-t border-cizgi/60 bg-gece-2/50">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-8">
        <h2 className="text-5xl font-bold">Sık sorulanlar</h2>
        <div className="mt-10 divide-y divide-cizgi/60 border-y border-cizgi/60">
          {sorular.map(([s, c]) => (
            <details key={s} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {s}
                <span className="text-2xl text-silik transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-soluk">{c}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Alt() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-4 py-12 text-sm text-silik sm:px-8">
      <Logo />
      <span>© 2026 Soner Keser</span>
      <span>MIT lisansı</span>
      <span>Sürüm {SURUM}</span>
      <a href={DEPO} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 hover:text-metin">
        <GithubSimgesi boyut={16} /> GitHub
      </a>
    </footer>
  );
}
