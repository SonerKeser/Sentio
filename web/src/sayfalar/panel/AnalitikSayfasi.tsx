import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldCheck, TrendingDown } from 'lucide-react';
import { DUYGU, DUYGULAR, YIGIN_SIRASI, yuzde } from '../../alan/duygular';
import { api } from '../../api/istemci';
import type { Analitik, AnalitikOgrenci } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Donen, Kivilcim, sinif, useBildirim } from '../../bilesenler/ui';

const kisaTarih = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

function sureMetni(sn: number) {
  const sa = Math.floor(sn / 3600);
  const dk = Math.round((sn % 3600) / 60);
  return sa > 0 ? `${sa} sa ${dk} dk` : `${dk} dk`;
}

type Siralama = 'ilgi' | 'ad' | 'ders';

/** Olumsuz ifade oranı ile yoklamada anlaşılmayanların birleşik ölçüsü. */
const zorluk = (d: { olumsuzOran: number; anlamaOrani: number | null }) => d.olumsuzOran + (1 - (d.anlamaOrani ?? 1)) * 0.5;

/** Dönem analitiği: bir sınıfın dersler arasındaki seyri ve öğrencilerin ortalamaları. */
export default function AnalitikSayfasi() {
  const [secili, setSecili] = useState<string | undefined>(undefined);
  const [veri, setVeri] = useState<Analitik | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [siralama, setSiralama] = useState<Siralama>('ilgi');
  const bildir = useBildirim();

  useEffect(() => {
    setYukleniyor(true);
    const sorgu = secili === undefined ? '' : `?sinif=${encodeURIComponent(secili)}`;
    api<Analitik>(`/api/analitik${sorgu}`)
      .then(setVeri)
      .catch((e) => bildir(e.message, 'hata'))
      .finally(() => setYukleniyor(false));
  }, [secili, bildir]);

  const dersVerisi = useMemo(() => {
    const dersler = veri?.dersler ?? [];
    // Aynı gün birden çok ders varsa eksende saat de yazılır.
    const gunler = dersler.map((d) => kisaTarih(d.tarih));
    const tekrar = new Set(gunler).size < gunler.length;
    return dersler.map((d, i) => {
        const etiket = tekrar ? `${gunler[i]} ${new Date(d.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : gunler[i];
        const satir: Record<string, number | string | null> = {
          sira: i + 1,
          ad: `${etiket} ${d.baslik}`,
          tarih: etiket,
          katilim: d.katilim,
          dikkat: d.dikkat,
          anlama: d.anlamaOrani,
        };
        DUYGULAR.forEach((x, j) => (satir[x] = d.dagilim[j] ?? 0));
        return satir;
      });
  }, [veri]);

  const ogrenciler = useMemo(() => {
    const liste = [...(veri?.ogrenciler ?? [])];
    if (siralama === 'ad') liste.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    else if (siralama === 'ders') liste.sort((a, b) => b.dersSayisi - a.dersSayisi);
    else liste.sort((a, b) => a.katilim - b.katilim);
    return liste;
  }, [veri, siralama]);

  const zorlayicilar = useMemo(
    () =>
      [...(veri?.dersler ?? [])]
        .filter((d) => d.olumsuzOran > 0.08 || (d.anlamaOrani !== null && d.anlamaOrani < 0.6))
        .sort((a, b) => zorluk(b) - zorluk(a))
        .slice(0, 3),
    [veri],
  );

  const sinifAdi = (ad: string | null) => ad ?? 'Sınıf belirtilmemiş';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-8 sm:px-8">
      <header>
        <h1 className="text-4xl font-bold sm:text-5xl">Analitik</h1>
        <p className="mt-2 max-w-2xl text-soluk">Biten derslerin özetleri. Bir sınıfın dersler boyunca nasıl seyrettiğini ve hangi öğrencilerin ilgi beklediğini gösterir.</p>
      </header>

      {veri && veri.siniflar.length > 0 && (
        <nav className="flex flex-wrap gap-2" aria-label="Sınıf seçimi">
          <Cip secili={secili === undefined} onClick={() => setSecili(undefined)}>
            Tüm sınıflar
          </Cip>
          {veri.siniflar.map((s) => (
            <Cip key={s.ad ?? '-'} secili={secili === (s.ad ?? '-')} onClick={() => setSecili(s.ad ?? '-')}>
              {sinifAdi(s.ad)} <span className="text-silik">{s.dersSayisi}</span>
            </Cip>
          ))}
        </nav>
      )}

      {yukleniyor && !veri ? (
        <div className="grid place-items-center py-24 text-soluk">
          <Donen boyut={26} />
        </div>
      ) : !veri || veri.ozet.dersSayisi === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Maskot duygu="saskin" boyut={150} />
          <h2 className="text-2xl font-bold">Henüz özetlenecek ders yok</h2>
          <p className="max-w-md text-soluk">Analitik biten derslerden oluşur. Bir dersi bitirdiğinizde özeti burada belirir; sanal sınıfla da deneyebilirsiniz.</p>
        </div>
      ) : (
        <motion.div key={secili ?? 'hepsi'} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className={sinif('flex flex-col gap-7', yukleniyor && 'opacity-60')}>
          <section className="yuzey grid grid-cols-2 gap-5 p-6 md:grid-cols-5">
            <Olcu ad="Ders" deger={String(veri.ozet.dersSayisi)} />
            <Olcu ad="Toplam süre" deger={sureMetni(veri.ozet.toplamSureSn)} />
            <Olcu ad="Ortalama dikkat" deger={yuzde(veri.ozet.dikkat)} />
            <Olcu ad="Ortalama katılım" deger={yuzde(veri.ozet.katilim)} />
            <Olcu ad="Yoklamada anlama" deger={veri.ozet.anlamaOrani === null ? '—' : yuzde(veri.ozet.anlamaOrani)} />
          </section>

          <section className="yuzey p-5">
            <h2 className="mb-1 text-lg font-semibold">Dersler boyunca katılım, dikkat ve anlama</h2>
            <p className="mb-4 text-sm text-silik">Çubuklar yoklamalardaki anlama oranıdır; yoklama yapılmayan derslerde boştur.</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dersVerisi} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-cizgi)" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="tarih" stroke="var(--color-silik)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `%${Math.round(v * 100)}`} width={42} stroke="var(--color-silik)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-gece-3)', border: '1px solid var(--color-cizgi)', borderRadius: 12 }}
                  labelFormatter={(_, p) => (p?.[0]?.payload?.ad as string) ?? ''}
                  formatter={(v, ad) => [v === null ? '—' : `%${Math.round(Number(v) * 100)}`, ad]}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="anlama" name="Anlama" fill="#A784FF" fillOpacity={0.55} radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="katilim" name="Katılım" stroke="#FF7AD9" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="dikkat" name="Dikkat" stroke="#FFC94A" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="yuzey p-5">
              <h2 className="mb-4 text-lg font-semibold">Derslerin ifade dağılımı</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dersVerisi} stackOffset="expand" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="tarih" stroke="var(--color-silik)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `%${Math.round(v * 100)}`} width={42} stroke="var(--color-silik)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} ticks={[0, 0.5, 1]} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-gece-3)', border: '1px solid var(--color-cizgi)', borderRadius: 12 }}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.ad as string) ?? ''}
                    formatter={(v, ad) => [`%${Math.round(Number(v) * 100)}`, DUYGU[ad as keyof typeof DUYGU]?.ad ?? ad]}
                  />
                  {YIGIN_SIRASI.map((d) => (
                    <Bar key={d} dataKey={d} stackId="a" fill={DUYGU[d].renk} maxBarSize={36} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="yuzey p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <TrendingDown size={18} className="text-d-ofkeli" /> Gözden geçirilecek dersler
              </h2>
              {zorlayicilar.length === 0 ? (
                <p className="text-sm text-silik">Belirgin biçimde zorlayıcı bir ders görünmüyor.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {zorlayicilar.map((d) => (
                    <li key={d.id}>
                      <Link to={`/panel/oturum/${d.id}/rapor`} className="block rounded-xl border border-cizgi/60 bg-gece p-3 hover:border-silik">
                        <p className="font-semibold">{d.baslik}</p>
                        <p className="text-sm text-silik">
                          {kisaTarih(d.tarih)}, olumsuz ifade {yuzde(d.olumsuzOran)}
                          {d.anlamaOrani !== null ? `, anlama ${yuzde(d.anlamaOrani)}` : ''}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Öğrenciler <span className="text-silik">{ogrenciler.length}</span>
              </h2>
              <div className="flex rounded-pill border border-cizgi p-0.5 text-sm">
                {(
                  [
                    ['ilgi', 'İlgi bekleyen önce'],
                    ['ders', 'Ders sayısı'],
                    ['ad', 'Ad'],
                  ] as [Siralama, string][]
                ).map(([d, ad]) => (
                  <button key={d} onClick={() => setSiralama(d)} className={sinif('rounded-pill px-3 py-1', siralama === d ? 'bg-gece-3 text-metin' : 'text-silik hover:text-soluk')}>
                    {ad}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-kart border border-cizgi/60">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gece-2 text-soluk">
                  <tr>
                    <th className="px-4 py-3 font-medium">Öğrenci</th>
                    <th className="px-4 py-3 text-right font-medium">Ders</th>
                    <th className="px-4 py-3 font-medium">Katılımın seyri</th>
                    <th className="px-4 py-3 text-right font-medium">Katılım</th>
                    <th className="px-4 py-3 text-right font-medium">Dikkat</th>
                    <th className="px-4 py-3 text-right font-medium">Kamerada</th>
                    <th className="px-4 py-3 text-right font-medium">Anlamadım</th>
                  </tr>
                </thead>
                <tbody>
                  {ogrenciler.map((o) => (
                    <OgrenciSatiri key={o.ad} o={o} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex gap-2 text-xs text-silik">
              <ShieldCheck size={15} className="shrink-0 text-d-igrenme" />
              Öğrenciler dersler arasında adlarıyla eşleştirilir; anonim dersler ve verilerini silen öğrenciler bu listeye girmez. Bu tablo öğrenciyi değerlendirmek için değil, kime destek
              gerekebileceğini görmek içindir.
            </p>
          </section>
        </motion.div>
      )}
    </div>
  );
}

function Cip({ secili, onClick, children }: { secili: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={secili}
      className={sinif('flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm font-medium', secili ? 'border-gunes bg-gunes/10 text-gunes' : 'border-cizgi text-soluk hover:text-metin')}
    >
      {children}
    </button>
  );
}

function Olcu({ ad, deger }: { ad: string; deger: string }) {
  return (
    <div>
      <p className="rakam text-3xl font-semibold">{deger}</p>
      <p className="text-sm text-silik">{ad}</p>
    </div>
  );
}

function OgrenciSatiri({ o }: { o: AnalitikOgrenci }) {
  return (
    <tr className="border-t border-cizgi/40 hover:bg-gece-2/60">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Maskot duygu={o.baskin ?? 'notr'} boyut={30} canli={false} />
          <span className="font-semibold">{o.ad}</span>
        </div>
      </td>
      <td className="rakam px-4 py-2.5 text-right text-base">{o.dersSayisi}</td>
      <td className="px-4 py-2.5">
        <Kivilcim degerler={o.egilim.map((e) => e.katilim)} genislik={110} yukseklik={22} renk="var(--color-d-saskin)" />
      </td>
      <td className={sinif('rakam px-4 py-2.5 text-right text-base', o.katilim < 0.45 && 'text-d-ofkeli')}>{yuzde(o.katilim)}</td>
      <td className="rakam px-4 py-2.5 text-right text-base">{yuzde(o.dikkat)}</td>
      <td className="rakam px-4 py-2.5 text-right text-base">{yuzde(o.yuzOrani)}</td>
      <td className="rakam px-4 py-2.5 text-right text-base">{o.anlamadimSayisi}</td>
    </tr>
  );
}
