import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Globe, HardDrive, Laptop, Package, Server } from 'lucide-react';
import { api, boyutYaz } from '../../api/istemci';
import type { SistemBilgisi } from '../../api/turler';
import { sinif } from '../../bilesenler/ui';
import { DEPO, TANITIM_MODU } from '../../ortam';

interface Varlik {
  ad: string;
  etiket: string;
  not: string;
}

interface Bilesen {
  ad: string;
  rol: string;
  aciklama: string;
  simge: React.ReactNode;
  varliklar: Varlik[];
}

/** Sürüm dosyası adları sabittir; "latest/download" bağlantısı her zaman son sürümü indirir. */
const BILESENLER: Bilesen[] = [
  {
    ad: 'Sezgi Sunucu',
    rol: 'Okulun ya da öğretmenin bilgisayarında çalışır',
    aciklama: 'Öğretmen panelini, öğrenci web istemcisini ve analiz modellerini barındırır; ölçümleri saklar, kuralları işletir, rapor üretir. Kurulum gerektirmez, internetsiz yerel ağda çalışır.',
    simge: <Server size={22} />,
    varliklar: [
      { ad: 'Sezgi-Sunucu-win-x64.zip', etiket: 'Windows x64', not: 'Klasöre açın, Sezgi.Sunucu.exe’yi çalıştırın' },
      { ad: 'Sezgi-Sunucu-linux-x64.tar.gz', etiket: 'Linux x64', not: 'systemd hizmeti olarak çalışabilir' },
      { ad: 'Sezgi-Sunucu-linux-arm64.tar.gz', etiket: 'Linux ARM64', not: 'Raspberry Pi 4/5 ve ARM sunucular' },
    ],
  },
  {
    ad: 'Sezgi Masaüstü',
    rol: 'Öğrenci ve öğretmen bilgisayarlarına',
    aciklama: 'Sunucuya bağlanan uygulama. Arka planda çalışmayı sürdürür, destek bildirimlerini öne getirir, yerel ağda https olmadan da kamerayı açar ve galeri analizi için pencere seçtirir.',
    simge: <Laptop size={22} />,
    varliklar: [
      { ad: 'Sezgi-Masaustu-Kurulum.exe', etiket: 'Windows kurulum', not: 'Kendini güncel tutar' },
      { ad: 'Sezgi-Masaustu-Tasinabilir.exe', etiket: 'Windows taşınabilir', not: 'Kurulumsuz, tek dosya' },
    ],
  },
];

interface SurumBilgisi {
  surum: string;
  tarih: string;
  boyutlar: Record<string, number>;
}

function useSonSurum() {
  const [bilgi, setBilgi] = useState<SurumBilgisi | null>(null);
  useEffect(() => {
    const yol = DEPO.replace('https://github.com/', 'https://api.github.com/repos/') + '/releases/latest';
    fetch(yol, { headers: { Accept: 'application/vnd.github+json' } })
      .then((y) => (y.ok ? y.json() : null))
      .then((r) => {
        if (!r) return;
        setBilgi({
          surum: String(r.tag_name ?? '').replace(/^v/, ''),
          tarih: r.published_at,
          boyutlar: Object.fromEntries((r.assets ?? []).map((a: { name: string; size: number }) => [a.name, a.size])),
        });
      })
      .catch(() => {});
  }, []);
  return bilgi;
}

export function Indirmeler() {
  const surum = useSonSurum();
  const [yerel, setYerel] = useState<SistemBilgisi | null>(null);
  useEffect(() => {
    if (!TANITIM_MODU) api<SistemBilgisi>('/api/sistem').then(setYerel).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {yerel && yerel.indirmeler.length > 0 && (
        <div className="rounded-kart border border-d-igrenme/40 bg-d-igrenme/[0.06] p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <HardDrive size={20} className="text-d-igrenme" /> Bu sunucudan indir
          </h3>
          <p className="mt-1 text-sm text-soluk">Okulunuzun sunucusuna konmuş kurulum dosyaları; internet bağlantısı gerekmez.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {yerel.indirmeler.map((d) => (
              <a key={d.ad} href={d.adres} download className="inline-flex items-center gap-2 rounded-pill border border-cizgi bg-gece-2 px-4 py-2 text-sm font-semibold hover:border-silik">
                <Download size={16} /> {d.ad} <span className="font-normal text-silik">{boyutYaz(d.boyut)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {BILESENLER.map((b, i) => (
        <motion.article
          key={b.ad}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-6 rounded-kart border border-cizgi/70 bg-gece-2 p-6 md:grid-cols-[1fr_1.1fr]"
        >
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gece-3 text-gunes">{b.simge}</span>
              <div>
                <h3 className="text-2xl font-bold">{b.ad}</h3>
                <p className="text-sm text-silik">{b.rol}</p>
              </div>
            </div>
            <p className="mt-4 leading-relaxed text-soluk">{b.aciklama}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {/* Son sürümde bulunmayan dosyalar (ör. henüz üretilmemiş bir platform) listelenmez. */}
            {b.varliklar.filter((v) => !surum || v.ad in surum.boyutlar).map((v) => (
              <li key={v.ad}>
                <a
                  href={`${DEPO}/releases/latest/download/${v.ad}`}
                  className="group flex items-center gap-4 rounded-2xl border border-cizgi/60 bg-gece px-4 py-3 transition-colors hover:border-gunes/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{v.etiket}</span>
                    <span className="block truncate text-sm text-silik">{v.not}</span>
                  </span>
                  {surum?.boyutlar[v.ad] ? <span className="text-sm text-silik">{boyutYaz(surum.boyutlar[v.ad])}</span> : null}
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gunes text-gece transition-transform group-hover:scale-110">
                    <Download size={17} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </motion.article>
      ))}

      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-kart border border-cizgi/70 bg-gece-2 p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gece-3 text-gunes">
              <Globe size={22} />
            </span>
            <h3 className="text-2xl font-bold">Web istemcisi</h3>
          </div>
          <p className="mt-4 leading-relaxed text-soluk">
            Kurulum yok. Öğrenciler sunucu adresindeki <code className="rounded bg-gece px-1.5 py-0.5 text-sm text-metin">/katil</code> sayfasından ya da öğretmenin gösterdiği karekodla tarayıcıdan katılır. Kamera için
            https gerekir.
          </p>
          {!TANITIM_MODU && (
            <a href="/katil" className="mt-4 inline-flex font-semibold text-gunes hover:underline">
              Bu sunucudaki derse katıl
            </a>
          )}
        </article>
        <article className="rounded-kart border border-cizgi/70 bg-gece-2 p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gece-3 text-gunes">
              <Package size={22} />
            </span>
            <h3 className="text-2xl font-bold">Docker ve kaynak kod</h3>
          </div>
          <p className="mt-4 leading-relaxed text-soluk">Sunucuyu kapsayıcıda çalıştırmak için depodaki Dockerfile hazır; veriler bir hacimde kalır.</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-gece p-3 text-[13px] leading-relaxed text-metin/90">
            <code>{`git clone ${DEPO}.git\ncd Sezgi && docker compose up -d`}</code>
          </pre>
          <a href={DEPO} target="_blank" rel="noreferrer" className="mt-4 inline-flex font-semibold text-gunes hover:underline">
            GitHub deposu
          </a>
        </article>
      </div>

      <p className={sinif('text-sm text-silik', !surum && 'invisible')}>
        Son sürüm {surum?.surum}
        {surum?.tarih ? `, ${new Date(surum.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Windows SmartScreen imzasız uygulamalar için uyarı gösterebilir: “Ek bilgi” → “Yine de
        çalıştır”.
      </p>
    </div>
  );
}
