import { useMemo } from 'react';
import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { DUYGU, YIGIN_SIRASI } from '../../../alan/duygular';
import type { AkisNoktasi } from './useCanliOturum';

/** Saniyelik noktaları eşit genişlikte kovalara toplar; grafik uzun derslerde de hafif kalır. */
export function kovala(akis: AkisNoktasi[], kovaMs: number): AkisNoktasi[] {
  const kovalar = new Map<number, { n: number; nokta: AkisNoktasi }>();
  for (const p of akis) {
    const anahtar = Math.floor(p.t / kovaMs) * kovaMs;
    const k = kovalar.get(anahtar);
    if (!k) {
      kovalar.set(anahtar, { n: 1, nokta: { ...p, t: anahtar } });
      continue;
    }
    k.n++;
    for (const d of YIGIN_SIRASI) k.nokta[d] += p[d];
    k.nokta.dikkat += p.dikkat;
    k.nokta.aktif = Math.max(k.nokta.aktif, p.aktif);
  }
  return [...kovalar.values()].map(({ n, nokta }) => {
    const sonuc = { ...nokta, dikkat: nokta.dikkat / n };
    for (const d of YIGIN_SIRASI) sonuc[d] = nokta[d] / n;
    return sonuc;
  });
}

const saat = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const saniyeli = (t: number) => new Date(t).toLocaleTimeString('tr-TR');

function Ipucu({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as AkisNoktasi;
  const toplam = YIGIN_SIRASI.reduce((a, d) => a + p[d], 0) || 1;
  return (
    <div className="rounded-xl border border-cizgi bg-gece-3/95 px-3 py-2 text-sm shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold">{new Date(label as number).toLocaleTimeString('tr-TR')}</div>
      {[...YIGIN_SIRASI].reverse().map((d) => (
        <div key={d} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-soluk">
            <span className="h-2 w-2 rounded-full" style={{ background: DUYGU[d].renk }} />
            {DUYGU[d].ad}
          </span>
          <span className="rakam">%{Math.round((p[d] / toplam) * 100)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-6 border-t border-cizgi/60 pt-1">
        <span className="text-soluk">Dikkat</span>
        <span className="rakam">%{Math.round(p.dikkat * 100)}</span>
      </div>
    </div>
  );
}

export interface GrafikBolumu {
  ad: string;
  mola: boolean;
  baslangicMs: number;
  bitisMs: number | null;
}

export function DuyguAkisi({
  akis,
  yukseklik = 220,
  pencereMs = 15 * 60_000,
  bolumler = [],
  isaretler = [],
}: {
  akis: AkisNoktasi[];
  yukseklik?: number;
  pencereMs?: number;
  bolumler?: GrafikBolumu[];
  /** Yoklama gibi anlık olaylar için dikey çizgiler. */
  isaretler?: { zamanMs: number; etiket: string }[];
}) {
  const veri = useMemo(() => {
    if (akis.length === 0) return [];
    const son = akis[akis.length - 1].t;
    const pencere = akis.filter((p) => p.t >= son - pencereMs);
    const kapsam = (pencere[pencere.length - 1]?.t ?? 0) - (pencere[0]?.t ?? 0);
    return kovala(pencere, kapsam > 5 * 60_000 ? 10_000 : 5_000);
  }, [akis, pencereMs]);

  if (veri.length < 2) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-cizgi/70 text-center text-sm text-silik" style={{ height: yukseklik }}>
        Öğrenciler katıldıkça sınıfın ifade akışı burada belirecek.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={yukseklik}>
      <ComposedChart data={veri} stackOffset="expand" margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={veri[veri.length - 1].t - veri[0].t < 10 * 60_000 ? saniyeli : saat} stroke="var(--color-silik)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tickFormatter={(v) => `%${Math.round(v * 100)}`} width={42} stroke="var(--color-silik)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} ticks={[0, 0.5, 1]} />
        <Tooltip content={(p) => <Ipucu {...(p as TooltipContentProps<number, string>)} />} cursor={{ stroke: 'var(--color-metin)', strokeOpacity: 0.3 }} />
        {YIGIN_SIRASI.map((d) => (
          <Area key={d} type="monotone" dataKey={d} stackId="1" stroke="none" fill={DUYGU[d].renk} fillOpacity={0.92} isAnimationActive={false} />
        ))}
        <Line type="monotone" dataKey="dikkat" stroke="#F1EEFF" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        {bolumler.map((b) => {
          const bas = Math.max(b.baslangicMs, veri[0].t);
          const bit = Math.min(b.bitisMs ?? veri[veri.length - 1].t, veri[veri.length - 1].t);
          if (bit <= bas) return null;
          return b.mola ? (
            <ReferenceArea key={`b${b.baslangicMs}`} x1={bas} x2={bit} y1={0} y2={1} fill="#1A1535" fillOpacity={0.85} stroke="none" label={{ value: 'Mola', fill: '#AAA4D1', fontSize: 12 }} />
          ) : (
            <ReferenceLine key={`b${b.baslangicMs}`} x={bas} stroke="#F1EEFF" strokeOpacity={0.55} label={{ value: b.ad, position: 'insideTopLeft', fill: '#F1EEFF', fontSize: 11 }} />
          );
        })}
        {isaretler.map((i) =>
          i.zamanMs >= veri[0].t && i.zamanMs <= veri[veri.length - 1].t ? (
            <ReferenceLine key={`i${i.zamanMs}`} x={i.zamanMs} stroke="#A784FF" strokeDasharray="2 3" label={{ value: i.etiket, position: 'insideBottomRight', fill: '#A784FF', fontSize: 11 }} />
          ) : null,
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Gosterge() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-soluk">
      {[...YIGIN_SIRASI].reverse().map((d) => (
        <span key={d} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: DUYGU[d].renk }} />
          {DUYGU[d].ad}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-dashed border-metin" /> Dikkat
      </span>
    </div>
  );
}
