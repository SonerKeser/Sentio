import { CircleHelp, Coffee, Flag, Hand, Snail, Vote } from 'lucide-react';
import { DUYGU, yuzde } from '../../../alan/duygular';
import type { Rapor, SinyalTuru } from '../../../api/turler';
import { sinif, sureYaz, TayfCubugu } from '../../../bilesenler/ui';
import { YoklamaCubuklari } from '../canli/EtkilesimPaneli';

const saat = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const SINYAL: Record<SinyalTuru, { ad: string; simge: React.ReactNode }> = {
  anlamadim: { ad: 'Anlamadım', simge: <CircleHelp size={15} /> },
  soru: { ad: 'Söz istedi', simge: <Hand size={15} /> },
  yavasla: { ad: 'Yavaşlama istedi', simge: <Snail size={15} /> },
};

/** Dersin bölümleri: hangi konuda sınıf zorlandı, hangisinde dikkat düştü. */
export function BolumTablosu({ rapor }: { rapor: Rapor }) {
  const bolumler = rapor.etkilesim.bolumler;
  if (bolumler.length === 0) return null;
  const enZor = bolumler.filter((b) => !b.mola && b.aktif > 0).sort((a, b) => b.olumsuzOran - a.olumsuzOran)[0];
  return (
    <section className="yazdirma-blok">
      <h2 className="mb-3 text-xl font-semibold">Bölümler</h2>
      <div className="overflow-x-auto rounded-kart border border-cizgi/60">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-gece-2 text-soluk">
            <tr>
              <th className="px-4 py-3 font-medium">Bölüm</th>
              <th className="px-4 py-3 font-medium">Süre</th>
              <th className="w-[28%] px-4 py-3 font-medium">İfade dağılımı</th>
              <th className="px-4 py-3 text-right font-medium">Dikkat</th>
              <th className="px-4 py-3 text-right font-medium">Olumsuz</th>
              <th className="px-4 py-3 text-right font-medium">Anlamadım</th>
              <th className="px-4 py-3 text-right font-medium">Söz</th>
            </tr>
          </thead>
          <tbody>
            {bolumler.map((b) => (
              <tr key={b.id} className={sinif('border-t border-cizgi/40', b.mola && 'text-silik', b === enZor && 'bg-d-ofkeli/[0.06]')}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold">
                    {b.mola ? <Coffee size={15} className="text-d-mutlu" /> : <Flag size={15} className="text-gunes" />}
                    {b.ad}
                    {b === enZor && b.olumsuzOran > 0.15 && <span className="rounded-pill bg-d-ofkeli/15 px-2 py-0.5 text-xs font-medium text-d-ofkeli">en zorlayıcı</span>}
                  </span>
                  <span className="text-xs text-silik">{saat(b.baslangicMs)}</span>
                </td>
                <td className="rakam px-4 py-3">{sureYaz(b.bitisMs - b.baslangicMs)}</td>
                <td className="px-4 py-3">{b.aktif > 0 ? <TayfCubugu dagilim={b.dagilim} yukseklik={8} /> : <span className="text-silik">—</span>}</td>
                <td className="rakam px-4 py-3 text-right text-base">{b.aktif > 0 ? yuzde(b.dikkat) : '—'}</td>
                <td className="rakam px-4 py-3 text-right text-base">{b.aktif > 0 ? yuzde(b.olumsuzOran) : '—'}</td>
                <td className="rakam px-4 py-3 text-right text-base">{b.anlamadim}</td>
                <td className="rakam px-4 py-3 text-right text-base">{b.soru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function YoklamaSonuclari({ rapor }: { rapor: Rapor }) {
  const yoklamalar = rapor.etkilesim.yoklamalar;
  if (yoklamalar.length === 0) return null;
  return (
    <section className="yazdirma-blok">
      <h2 className="mb-3 text-xl font-semibold">Yoklamalar</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {yoklamalar.map((y) => (
          <article key={y.id} className="yuzey flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-silik">
                  <Vote size={13} /> {saat(y.zamanMs)}
                </p>
                <h3 className="mt-1 font-semibold leading-snug">{y.soru}</h3>
              </div>
              {y.anlamaOrani !== null && (
                <span className="text-right">
                  <span className="rakam block text-2xl font-semibold" style={{ color: y.anlamaOrani >= 0.7 ? DUYGU.igrenme.renk : y.anlamaOrani >= 0.5 ? DUYGU.mutlu.renk : DUYGU.ofkeli.renk }}>
                    {yuzde(y.anlamaOrani)}
                  </span>
                  <span className="text-xs text-silik">anlama</span>
                </span>
              )}
              {y.ortalama !== null && (
                <span className="text-right">
                  <span className="rakam block text-2xl font-semibold">{y.ortalama.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</span>
                  <span className="text-xs text-silik">ortalama</span>
                </span>
              )}
            </div>
            <YoklamaCubuklari secenekler={y.secenekler} sayilar={y.sayilar} yanitlayan={y.yanitlayan} />
            <p className="text-xs text-silik">
              <span className="rakam">{y.yanitlayan}</span> yanıt, <span className="rakam">{y.katilimci}</span> öğrenci
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SinyalListesi({ rapor }: { rapor: Rapor }) {
  const { sinyaller, anlamadim, soru, yavasla } = rapor.etkilesim;
  if (sinyaller.length === 0) return null;
  const sorular = sinyaller.filter((s) => s.tur === 'soru');
  return (
    <section className="yazdirma-blok">
      <h2 className="mb-3 text-xl font-semibold">Öğrencilerin sesi</h2>
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex gap-6 md:flex-col md:gap-3">
          {(
            [
              ['anlamadim', anlamadim],
              ['soru', soru],
              ['yavasla', yavasla],
            ] as [SinyalTuru, number][]
          ).map(([tur, sayi]) => (
            <div key={tur} className="flex items-center gap-2">
              <span className="text-soluk">{SINYAL[tur].simge}</span>
              <span className="rakam text-2xl font-semibold">{sayi}</span>
              <span className="text-sm text-silik">{SINYAL[tur].ad}</span>
            </div>
          ))}
        </div>
        {sorular.length > 0 && (
          <ul className="flex flex-col gap-2">
            {sorular.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-xl border border-cizgi/60 bg-gece-2 p-3 text-sm">
                <Hand size={16} className="mt-0.5 shrink-0 text-gunes" />
                <span className="flex-1">
                  <span className="font-semibold">{s.ad}</span>
                  {s.metin && <span className="text-metin/85">: {s.metin}</span>}
                  <span className="block text-xs text-silik">
                    {saat(s.zamanMs)}
                    {s.yanitlandi ? ', yanıtlandı' : ', yanıtlanmadı'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

