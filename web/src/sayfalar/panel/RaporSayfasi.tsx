import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ChevronLeft, FileSpreadsheet, FileText, Radio, Sparkles, TrendingDown, Frown } from 'lucide-react';
import { DUYGU, DUYGULAR, yuzde, type Duygu } from '../../alan/duygular';
import { api } from '../../api/istemci';
import type { Rapor } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Donen, Dugme, sinif, sureYaz, tarihYaz, TayfCubugu, useBildirim } from '../../bilesenler/ui';
import { DuyguAkisi, Gosterge } from './canli/DuyguAkisi';
import { KAYNAK_ADI } from './canli/OgrenciKarosu';
import type { AkisNoktasi } from './canli/useCanliOturum';
import { UyariAkisi } from './canli/UyariAkisi';

const saat = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function RaporSayfasi() {
  const { id = '' } = useParams();
  const [rapor, setRapor] = useState<Rapor | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const bildir = useBildirim();

  useEffect(() => {
    api<Rapor>(`/api/oturumlar/${id}/rapor`)
      .then(setRapor)
      .catch((e) => setHata(e.message));
  }, [id]);

  const akis = useMemo<AkisNoktasi[]>(
    () =>
      (rapor?.zaman.dilimler ?? [])
        .filter((d) => d.aktif > 0)
        .map((d) => {
          const n = { t: d.zamanMs, dikkat: d.dikkat, aktif: d.aktif } as AkisNoktasi;
          DUYGULAR.forEach((x, i) => (n[x] = d.dagilim[i]));
          return n;
        }),
    [rapor],
  );

  if (hata) return <p className="p-10 text-center text-d-ofkeli">{hata}</p>;
  if (!rapor)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-soluk">
        <Donen boyut={28} />
      </div>
    );

  const { oturum, sinif: s } = rapor;
  const indir = (yol: string) => {
    window.location.href = yol;
    bildir('İndirme başladı.', 'bilgi');
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-start gap-4">
        <Link to="/panel" className="mt-1 rounded-full p-2 text-silik hover:bg-gece-2 hover:text-metin" aria-label="Derslere dön">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-soluk">
            {oturum.sinifAdi ? `${oturum.sinifAdi} · ` : ''}
            {tarihYaz(oturum.baslangic)} · {sureYaz(oturum.sureSn * 1000)}
          </p>
          <h1 className="text-4xl font-bold sm:text-5xl">{oturum.baslik}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {oturum.durum === 'canli' && (
            <Link to={`/panel/oturum/${id}`} className="inline-flex h-10 items-center gap-2 rounded-pill border border-d-ofkeli/40 px-4 font-semibold text-d-ofkeli">
              <Radio size={17} /> Canlı panele dön
            </Link>
          )}
          <Dugme tur="birincil" simge={<FileSpreadsheet size={18} />} onClick={() => indir(`/api/oturumlar/${id}/rapor.xlsx`)}>
            Excel
          </Dugme>
          <Dugme simge={<FileText size={18} />} onClick={() => indir(`/api/oturumlar/${id}/okumalar.csv`)}>
            Ham veri (CSV)
          </Dugme>
        </div>
      </header>

      {s.okumaSayisi === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Maskot duygu="notr" boyut={140} />
          <p className="text-soluk">Bu derste hiç ölçüm alınmadı.</p>
        </div>
      ) : (
        <>
          <section className="yuzey grid gap-6 p-6 md:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-5">
              <Maskot duygu={s.baskin ?? 'notr'} boyut={120} />
              <div>
                <p className="text-sm text-soluk">Dersin baskın ifadesi</p>
                <p className="baslik text-3xl font-bold">{s.baskin ? DUYGU[s.baskin].ad : '—'}</p>
                <p className="text-sm text-silik">{s.katilimciSayisi} katılımcı · {s.okumaSayisi.toLocaleString('tr-TR')} ölçüm</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Rakam ad="Ortalama dikkat" deger={yuzde(s.dikkat)} />
              <Rakam ad="Ortalama katılım" deger={yuzde(s.katilim)} />
              <Rakam ad="Kamerada görünme" deger={yuzde(s.yuzOrani)} />
              <Rakam ad="Uyarı" deger={String(s.uyariSayisi)} />
              <div className="col-span-full">
                <TayfCubugu dagilim={s.dagilim} yukseklik={12} />
              </div>
            </div>
          </section>

          {rapor.onemliAnlar.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">Öne çıkan anlar</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {rapor.onemliAnlar.map((a, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-3 rounded-2xl border border-cizgi/60 bg-gece-2 p-4">
                    <span className={sinif('mt-0.5', a.tur === 'olumsuz' ? 'text-d-ofkeli' : a.tur === 'dikkat' ? 'text-d-mutlu' : 'text-d-igrenme')}>
                      {a.tur === 'olumsuz' ? <Frown size={20} /> : a.tur === 'dikkat' ? <TrendingDown size={20} /> : <Sparkles size={20} />}
                    </span>
                    <div>
                      <p className="rakam text-lg font-semibold">{saat(a.zamanMs)}</p>
                      <p className="text-sm text-soluk">{a.aciklama}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section className="yuzey p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Ders boyunca sınıfın ifadesi</h2>
              <Gosterge />
            </div>
            <DuyguAkisi akis={akis} yukseklik={240} pencereMs={Number.MAX_SAFE_INTEGER} />
          </section>

          <IsiHaritasi rapor={rapor} />

          <section>
            <h2 className="mb-3 text-xl font-semibold">Öğrenciler</h2>
            <div className="overflow-x-auto rounded-kart border border-cizgi/60">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gece-2 text-soluk">
                  <tr>
                    <th className="px-4 py-3 font-medium">Öğrenci</th>
                    <th className="px-4 py-3 font-medium">Baskın</th>
                    <th className="w-[30%] px-4 py-3 font-medium">İfade dağılımı</th>
                    <th className="px-4 py-3 text-right font-medium">Dikkat</th>
                    <th className="px-4 py-3 text-right font-medium">Katılım</th>
                    <th className="px-4 py-3 text-right font-medium">Kamerada</th>
                    <th className="px-4 py-3 text-right font-medium">Uyarı</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.katilimcilar.map((k) => (
                    <tr key={k.id} className="border-t border-cizgi/40 hover:bg-gece-2/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Maskot duygu={k.baskin ?? 'notr'} boyut={32} canli={false} />
                          <div>
                            <p className="font-semibold">{k.ad}</p>
                            <p className="text-xs text-silik">
                              {KAYNAK_ADI[k.kaynak]} · {sureYaz(k.sureSn * 1000)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{k.baskin ? DUYGU[k.baskin].ad : '—'}</td>
                      <td className="px-4 py-3">
                        <TayfCubugu dagilim={k.dagilim} yukseklik={8} />
                      </td>
                      <td className="rakam px-4 py-3 text-right text-base">{yuzde(k.dikkat)}</td>
                      <td className="rakam px-4 py-3 text-right text-base">{yuzde(k.katilim)}</td>
                      <td className="rakam px-4 py-3 text-right text-base">{yuzde(k.yuzOrani)}</td>
                      <td className="rakam px-4 py-3 text-right text-base">{k.uyariSayisi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Uyarılar ve mesajlar</h2>
            <UyariAkisi uyarilar={[...rapor.uyarilar].reverse()} />
          </section>

          <p className="text-sm text-silik">
            İfade tahminleri yüzdeki görünür ifadeyi kabaca sınıflar; bir öğrencinin iç dünyası hakkında kesin bilgi vermez. Bu rapor dersin akışını değerlendirmek içindir, öğrenci notlandırmasında kullanılmamalıdır.
          </p>
        </>
      )}
    </div>
  );
}

function Rakam({ ad, deger }: { ad: string; deger: string }) {
  return (
    <div>
      <p className="rakam text-4xl font-semibold">{deger}</p>
      <p className="text-sm text-silik">{ad}</p>
    </div>
  );
}

/** Öğrenci × zaman ısı haritası: her hücre o dilimdeki baskın ifadenin rengidir. */
function IsiHaritasi({ rapor }: { rapor: Rapor }) {
  const { dilimler, isiHaritasi, aralikSn } = rapor.zaman;
  const etiketAdimi = Math.max(1, Math.ceil(dilimler.length / 8));
  const kisa = rapor.oturum.sureSn < 20 * 60;
  const etiket = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', kisa ? undefined : { hour: '2-digit', minute: '2-digit' });
  const hucreAdi = (h: number): string => (h >= 0 ? DUYGU[DUYGULAR[h] as Duygu].ad : h === -2 ? 'Kamerada yok' : 'Veri yok');

  return (
    <section className="yuzey p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Isı haritası</h2>
          <p className="text-sm text-silik">Her sütun {aralikSn} saniye; hücrenin rengi o aralıktaki baskın ifadedir.</p>
        </div>
      </div>
      <div className="kaydirma-ince overflow-x-auto">
        <div className="grid min-w-full gap-x-px gap-y-1" style={{ gridTemplateColumns: `minmax(120px, 180px) repeat(${dilimler.length}, minmax(5px, 1fr))`, width: Math.max(dilimler.length * 7 + 180, 0) }}>
          {isiHaritasi.map((satir) => (
            <div key={satir.katilimciId} className="contents">
              <div className="truncate pr-3 text-sm text-soluk">{satir.ad}</div>
              {satir.hucreler.map((h, i) => (
                <div
                  key={i}
                  title={`${satir.ad} · ${saat(dilimler[i].zamanMs)} · ${hucreAdi(h)}`}
                  className={sinif('h-5', h === -1 && 'bg-transparent', h === -2 && 'bg-[repeating-linear-gradient(45deg,var(--color-gece-4)_0_2px,transparent_2px_5px)]')}
                  style={h >= 0 ? { background: DUYGU[DUYGULAR[h] as Duygu].renk } : undefined}
                />
              ))}
            </div>
          ))}
          <div />
          {dilimler.map((d, i) => (
            <div key={i} className="relative h-5">
              {i % etiketAdimi === 0 && <span className="absolute left-0 top-1 whitespace-nowrap text-[11px] text-silik">{etiket(d.zamanMs)}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
