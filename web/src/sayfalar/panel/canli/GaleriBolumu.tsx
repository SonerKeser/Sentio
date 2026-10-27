import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { FileVideo, MonitorUp, ShieldCheck, Square } from 'lucide-react';
import { baskin, DUYGU } from '../../../alan/duygular';
import type { GaleriDurumu, IzGorunumu } from '../../../analiz/galeri';
import { Maskot } from '../../../bilesenler/Maskot';
import { Donen, Dugme, sinif } from '../../../bilesenler/ui';

interface Ozellikler {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  durum: GaleriDurumu;
  hata: string | null;
  izler: IzGorunumu[];
  doseme: number;
  setDoseme: (n: number) => void;
  baslat: (k: 'ekran' | File) => void;
  durdur: () => void;
  kaynakAdi: string;
}

/**
 * Öğrencilerin Sezgi istemcisi kuramadığı derslerde, öğretmen video konferans penceresini paylaşır;
 * galerideki yüzler bu tarayıcıda çözümlenir. Eski sistemin ekran görüntüsü yaklaşımının çağdaş karşılığı.
 */
export function GaleriBolumu(o: Ozellikler) {
  const dosyaRef = useRef<HTMLInputElement>(null);
  const tuvalRef = useRef<HTMLCanvasElement>(null);
  const calisiyor = o.durum === 'calisiyor' || o.durum === 'model';

  // Kutuları videonun ekrandaki boyutuna göre çiz (object-contain).
  useEffect(() => {
    const tuval = tuvalRef.current;
    const video = o.videoRef.current;
    if (!tuval || !video) return;
    const kutu = tuval.getBoundingClientRect();
    tuval.width = kutu.width * devicePixelRatio;
    tuval.height = kutu.height * devicePixelRatio;
    const c = tuval.getContext('2d')!;
    c.scale(devicePixelRatio, devicePixelRatio);
    c.clearRect(0, 0, kutu.width, kutu.height);
    const W = video.videoWidth;
    const H = video.videoHeight;
    if (!W || !H) return;
    const olcek = Math.min(kutu.width / W, kutu.height / H);
    const ox = (kutu.width - W * olcek) / 2;
    const oy = (kutu.height - H * olcek) / 2;
    c.font = '600 12px "Figtree Variable", sans-serif';
    for (const iz of o.izler) {
      if (!iz.gorunur) continue;
      const renk = DUYGU[baskin(iz.d)].renk;
      const [x, y, w, h] = iz.kutu;
      const rx = ox + x * olcek;
      const ry = oy + y * olcek;
      c.strokeStyle = renk;
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(rx, ry, w * olcek, h * olcek, 8);
      c.stroke();
      const etiket = `${iz.ad} · ${DUYGU[baskin(iz.d)].ad}`;
      const gen = c.measureText(etiket).width + 12;
      c.fillStyle = renk;
      c.beginPath();
      c.roundRect(rx, Math.max(0, ry - 20), gen, 18, 6);
      c.fill();
      c.fillStyle = '#1A1535';
      c.fillText(etiket, rx + 6, Math.max(0, ry - 20) + 13);
    }
  }, [o.izler, o.videoRef]);

  return (
    <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="yuzey grid gap-5 p-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-gece">
          <video ref={o.videoRef} playsInline muted className={sinif('h-full w-full object-contain', !calisiyor && 'hidden')} />
          <canvas ref={tuvalRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {!calisiyor && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="max-w-sm text-soluk">
                Zoom, Meet ya da Teams penceresini galeri görünümünde paylaşın. Görüntüdeki yüzler bu tarayıcıda çözümlenir ve her biri sınıfa bir katılımcı olarak eklenir.
              </p>
              {o.hata && <p className="max-w-sm text-sm text-d-ofkeli">{o.hata}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                <Dugme tur="birincil" simge={<MonitorUp size={18} />} onClick={() => o.baslat('ekran')}>
                  Pencere paylaş
                </Dugme>
                <Dugme simge={<FileVideo size={18} />} onClick={() => dosyaRef.current?.click()}>
                  Ders kaydı seç
                </Dugme>
                <input
                  ref={dosyaRef}
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) o.baslat(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          )}
          {o.durum === 'model' && (
            <div className="absolute inset-0 grid place-items-center bg-gece/60 text-soluk">
              <span className="flex items-center gap-2">
                <Donen /> Analiz motoru hazırlanıyor
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Galeri analizi</h3>
              <p className="text-sm text-silik">{calisiyor ? o.kaynakAdi : 'Kaynak seçilmedi'}</p>
            </div>
            {calisiyor && (
              <Dugme tur="tehlike" boyut="kucuk" simge={<Square size={14} />} onClick={o.durdur}>
                Durdur
              </Dugme>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm text-soluk">Tarama ayrıntısı</p>
            <div className="flex gap-2">
              {[
                [1, 'Tek kare', 'En hızlı; büyük yüzler'],
                [2, '2 × 2', 'Önerilen'],
                [3, '3 × 3', 'Kalabalık galeri'],
              ].map(([n, ad, aciklama]) => (
                <button
                  key={n}
                  onClick={() => o.setDoseme(n as number)}
                  title={aciklama as string}
                  className={sinif('flex-1 rounded-xl border px-2 py-2 text-sm', o.doseme === n ? 'border-gunes text-gunes' : 'border-cizgi text-soluk hover:text-metin')}
                >
                  {ad}
                </button>
              ))}
            </div>
          </div>
          <div className="kaydirma-ince flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {o.izler.length === 0 ? (
              <p className="text-sm text-silik">{calisiyor ? 'Yüz aranıyor…' : 'İzlenen yüz yok.'}</p>
            ) : (
              o.izler.map((iz) => (
                <div key={iz.id} className={sinif('flex items-center gap-3 rounded-xl px-2 py-1.5', !iz.gorunur && 'opacity-45')}>
                  <Maskot duygu={baskin(iz.d)} boyut={30} canli={false} />
                  <span className="flex-1 truncate text-sm font-medium">{iz.ad}</span>
                  <span className="text-xs text-silik">{iz.gorunur ? DUYGU[baskin(iz.d)].ad : 'görünmüyor'}</span>
                </div>
              ))
            )}
          </div>
          <p className="mt-auto flex gap-2 text-xs text-silik">
            <ShieldCheck size={15} className="shrink-0 text-d-igrenme" />
            Ekran görüntüsü kaydedilmez ve sunucuya gitmez. Yüz tanımlayıcıları yalnızca bu sayfa açıkken bellekte tutulur. Yüzleri öğrencilerin panelinden adlandırabilirsiniz.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
