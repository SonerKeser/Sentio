import { useEffect, useState } from 'react';
import { Copy, Send, TriangleAlert } from 'lucide-react';
import { DUYGU, DUYGULAR, yuzde, type Duygu } from '../../../alan/duygular';
import { api } from '../../../api/istemci';
import type { KatilimciAnligi, OturumAyarlari, OturumDetayi, SistemBilgisi, UyariBildirimi } from '../../../api/turler';
import { QrKod } from '../../../bilesenler/QrKod';
import { Maskot } from '../../../bilesenler/Maskot';
import { Anahtar, Dugme, Halka, Kivilcim, Pencere, sinif, useBildirim } from '../../../bilesenler/ui';
import { durumMetni, KAYNAK_ADI, maskotDurumu } from './OgrenciKarosu';
import { UyariAkisi } from './UyariAkisi';

export function KatilimPenceresi({ acik, kapat, oturum }: { acik: boolean; kapat: () => void; oturum: OturumDetayi }) {
  const [sistem, setSistem] = useState<SistemBilgisi | null>(null);
  const [secili, setSecili] = useState(0);
  const bildir = useBildirim();

  useEffect(() => {
    if (acik && !sistem) api<SistemBilgisi>('/api/sistem').then(setSistem).catch(() => {});
  }, [acik, sistem]);

  const yerel = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const adresler = sistem?.adresler.length ? (yerel ? sistem.adresler : [location.origin, ...sistem.adresler.filter((a) => a !== location.origin)]) : [location.origin];
  const adres = adresler[Math.min(secili, adresler.length - 1)];
  const baglanti = `${adres}/katil/${oturum.katilimKodu}`;
  const guvensiz = adres.startsWith('http://') && !/\/\/(localhost|127\.0\.0\.1)/.test(adres);

  const kopyala = (metin: string) =>
    navigator.clipboard?.writeText(metin).then(
      () => bildir('Panoya kopyalandı.', 'basari'),
      () => bildir('Kopyalanamadı; metni elle seçin.', 'hata'),
    );

  return (
    <Pencere acik={acik} kapat={kapat} baslik="Öğrencileri davet et" genislik="max-w-3xl">
      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm text-soluk">Ders kodu</p>
            <button onClick={() => kopyala(oturum.katilimKodu)} className="rakam text-7xl font-bold tracking-[0.12em] text-gunes hover:opacity-90" title="Kopyala">
              {oturum.katilimKodu}
            </button>
          </div>
          <div>
            <p className="mb-2 text-sm text-soluk">Katılım adresi</p>
            <div className="flex items-center gap-2 rounded-xl border border-cizgi bg-gece px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-medium">{baglanti}</span>
              <button onClick={() => kopyala(baglanti)} className="rounded-lg p-1.5 text-soluk hover:bg-gece-3 hover:text-metin" aria-label="Adresi kopyala">
                <Copy size={17} />
              </button>
            </div>
            {adresler.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {adresler.map((a, i) => (
                  <button key={a} onClick={() => setSecili(i)} className={sinif('rounded-pill border px-2.5 py-1 text-xs', i === secili ? 'border-gunes/60 text-gunes' : 'border-cizgi text-silik hover:text-soluk')}>
                    {a.replace(/^https?:\/\//, '')}
                  </button>
                ))}
              </div>
            )}
          </div>
          {guvensiz && (
            <p className="flex gap-2.5 rounded-xl border border-d-mutlu/30 bg-d-mutlu/[0.07] p-3 text-sm text-metin/85">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-d-mutlu" />
              Tarayıcılar kamerayı yalnızca güvenli (https) adreslerde açar. Yerel ağda öğrencilerin Sentio masaüstü istemcisini kullanmasını ya da sunucuyu https ile yayınlamanızı öneririz.
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <QrKod metin={baglanti} boyut={220} />
          <span className="text-sm text-silik">Telefon kamerasıyla okutun</span>
        </div>
      </div>
    </Pencere>
  );
}

export function AyarlarCekmecesi({ acik, kapat, oturum, kaydedildi }: { acik: boolean; kapat: () => void; oturum: OturumDetayi; kaydedildi: (a: OturumAyarlari) => void }) {
  const [a, setA] = useState<OturumAyarlari>(oturum.ayarlar);
  const [bekliyor, setBekliyor] = useState(false);
  const bildir = useBildirim();
  useEffect(() => {
    if (acik) setA(oturum.ayarlar);
  }, [acik, oturum.ayarlar]);

  const degis = <K extends keyof OturumAyarlari>(k: K, v: OturumAyarlari[K]) => setA((x) => ({ ...x, [k]: v }));
  const duyguDegis = (d: Duygu, acik: boolean) =>
    degis('izlenenDuygular', acik ? [...new Set([...a.izlenenDuygular, d])] : a.izlenenDuygular.filter((x) => x !== d));

  const kaydet = async () => {
    setBekliyor(true);
    try {
      const sonuc = await api<OturumAyarlari>(`/api/oturumlar/${oturum.id}/ayarlar`, { method: 'PUT', govde: a });
      kaydedildi(sonuc);
      bildir('Ayarlar kaydedildi; öğrencilere hemen uygulandı.', 'basari');
      kapat();
    } catch (e) {
      bildir((e as Error).message, 'hata');
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Pencere acik={acik} kapat={kapat} baslik="Ders ayarları" yan>
      <div className="flex flex-col gap-7">
        <section>
          <h3 className="mb-1 font-semibold">Kalıcılık eşiği</h3>
          <p className="mb-3 text-sm text-silik">Olumsuz bir ifade bu süre boyunca kesintisiz sürerse uyarı oluşur.</p>
          <Kaydirici deger={a.kalicilikSn} min={5} max={120} adim={5} birim="sn" degisti={(v) => degis('kalicilikSn', v)} />
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Bekleme süresi</h3>
          <p className="mb-3 text-sm text-silik">Aynı öğrenci için aynı türde iki uyarı arasındaki en kısa süre.</p>
          <Kaydirici deger={a.beklemeSn} min={30} max={600} adim={30} birim="sn" degisti={(v) => degis('beklemeSn', v)} />
        </section>
        <section>
          <h3 className="mb-3 font-semibold">İzlenen ifadeler</h3>
          <div className="flex flex-wrap gap-2">
            {DUYGULAR.filter((d) => DUYGU[d].olumsuz).map((d) => {
              const secili = a.izlenenDuygular.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => duyguDegis(d, !secili)}
                  aria-pressed={secili}
                  className={sinif('flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors', secili ? 'text-gece' : 'border-cizgi text-soluk hover:text-metin')}
                  style={secili ? { background: DUYGU[d].renk, borderColor: DUYGU[d].renk } : undefined}
                >
                  {DUYGU[d].ad}
                </button>
              );
            })}
          </div>
        </section>
        <section className="flex flex-col gap-1">
          <Anahtar acik={a.dikkatIzle} degisti={(v) => degis('dikkatIzle', v)} etiket="Dikkat dağınıklığı" aciklama="Son 30 saniyede ekrana pek bakılmıyorsa." />
          <Anahtar acik={a.uyuklamaIzle} degisti={(v) => degis('uyuklamaIzle', v)} etiket="Yorgunluk" aciklama="Gözler uzun süre büyük ölçüde kapalıysa." />
          <Anahtar acik={a.yoklukIzle} degisti={(v) => degis('yoklukIzle', v)} etiket="Kamerada görünmeme" aciklama="45 saniyeden uzun süre yüz bulunamazsa." />
        </section>
        <section className="flex flex-col gap-1 border-t border-cizgi/60 pt-5">
          <Anahtar acik={a.durtmeAcik} degisti={(v) => degis('durtmeAcik', v)} etiket="Öğrenciye destek bildirimi" aciklama="Uyarı oluştuğunda öğrenciye nazik bir mesaj gider." />
          <Anahtar acik={a.ogrenciKendiniGorsun} degisti={(v) => degis('ogrenciKendiniGorsun', v)} etiket="Öğrenci kendi ifadesini görsün" />
          <Anahtar acik={a.anonim} degisti={(v) => degis('anonim', v)} etiket="Anonim mod" aciklama="Adlar yerine sıra numaraları gösterilir." />
        </section>
        <section>
          <h3 className="mb-3 font-semibold">Ölçüm sıklığı</h3>
          <div className="flex gap-2">
            {[500, 1000, 2000].map((ms) => (
              <button key={ms} onClick={() => degis('orneklemeMs', ms)} className={sinif('flex-1 rounded-xl border py-2 text-sm font-medium', a.orneklemeMs === ms ? 'border-gunes text-gunes' : 'border-cizgi text-soluk')}>
                {ms / 1000} sn
              </button>
            ))}
          </div>
        </section>
        <Dugme tur="birincil" boyut="buyuk" onClick={kaydet} yukleniyor={bekliyor}>
          Kaydet ve uygula
        </Dugme>
      </div>
    </Pencere>
  );
}

function Kaydirici({ deger, min, max, adim, birim, degisti }: { deger: number; min: number; max: number; adim: number; birim: string; degisti: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <input type="range" min={min} max={max} step={adim} value={deger} onChange={(e) => degisti(Number(e.target.value))} className="flex-1 accent-[#FFC94A]" />
      <span className="rakam w-16 text-right text-xl font-semibold">
        {deger} <span className="text-sm text-silik">{birim}</span>
      </span>
    </div>
  );
}

const HAZIR_MESAJLAR = ['Takıldığın bir yer var mı?', 'Harika gidiyorsun!', 'Kısa bir mola vermek ister misin?', 'Bir sonraki soruyu sana soracağım, hazır ol 🙂'];

export function OgrenciCekmecesi({
  k,
  kapat,
  uyarilar,
  mesajGonder,
  adDegistir,
}: {
  k: KatilimciAnligi | null;
  kapat: () => void;
  uyarilar: UyariBildirimi[];
  mesajGonder: (katilimciId: string, metin: string) => Promise<void>;
  adDegistir?: (k: KatilimciAnligi, ad: string) => void;
}) {
  const [metin, setMetin] = useState('');
  const [ad, setAd] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  useEffect(() => {
    setMetin('');
    setAd(k?.ad ?? '');
    // Yalnızca seçilen kişi değiştiğinde sıfırla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k?.id]);

  const gonder = async (m: string) => {
    if (!k || !m.trim()) return;
    setBekliyor(true);
    try {
      await mesajGonder(k.id, m.trim());
      setMetin('');
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Pencere acik={!!k} kapat={kapat} baslik={k?.ad ?? ''} yan>
      {k && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <Maskot duygu={k.baskin} durum={maskotDurumu(k)} boyut={110} />
            <div>
              <p className="text-2xl font-bold">{durumMetni(k)}</p>
              <p className="text-sm text-silik">{KAYNAK_ADI[k.kaynak]}</p>
              <div className="mt-3 flex gap-4">
                <div className="flex items-center gap-2">
                  <Halka deger={k.dikkat} boyut={40} kalinlik={4} />
                  <span className="text-sm">
                    <span className="rakam block text-lg font-semibold leading-none">{yuzde(k.dikkat)}</span>
                    <span className="text-silik">dikkat</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Halka deger={k.katilim} boyut={40} kalinlik={4} renk="var(--color-d-saskin)" />
                  <span className="text-sm">
                    <span className="rakam block text-lg font-semibold leading-none">{yuzde(k.katilim)}</span>
                    <span className="text-silik">katılım</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-soluk">İfade dağılımı (yumuşatılmış)</h3>
            <div className="flex flex-col gap-2">
              {DUYGULAR.map((d, i) => (
                <div key={d} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-soluk">{DUYGU[d].ad}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-gece-4">
                    <div className="h-full rounded-pill transition-[width] duration-500" style={{ width: `${(k.duygular[i] ?? 0) * 100}%`, background: DUYGU[d].renk }} />
                  </div>
                  <span className="rakam w-10 text-right">{yuzde(k.duygular[i])}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-soluk">Katılımın son 40 ölçümü</h3>
            <Kivilcim degerler={k.iz} genislik={360} yukseklik={56} renk="var(--color-d-saskin)" />
          </section>

          {k.kaynak === 'kamera' && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-soluk">Öğrenciye yaz</h3>
              <div className="flex flex-wrap gap-2">
                {HAZIR_MESAJLAR.map((m) => (
                  <button key={m} onClick={() => gonder(m)} disabled={bekliyor} className="rounded-pill border border-cizgi px-3 py-1.5 text-sm text-soluk hover:border-silik hover:text-metin">
                    {m}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  gonder(metin);
                }}
              >
                <input value={metin} onChange={(e) => setMetin(e.target.value)} maxLength={280} placeholder="Kısa bir mesaj…" className="h-11 flex-1 rounded-xl border border-cizgi bg-gece px-3.5 outline-none focus:border-gunes/70" />
                <Dugme tur="birincil" type="submit" disabled={!metin.trim()} yukleniyor={bekliyor} aria-label="Gönder" simge={<Send size={17} />} />
              </form>
            </section>
          )}

          {k.kaynak === 'galeri' && adDegistir && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (ad.trim()) adDegistir(k, ad.trim());
              }}
            >
              <h3 className="text-sm font-semibold text-soluk">Bu yüzü adlandır</h3>
              <div className="flex gap-2">
                <input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={60} className="h-11 flex-1 rounded-xl border border-cizgi bg-gece px-3.5 outline-none focus:border-gunes/70" />
                <Dugme type="submit">Kaydet</Dugme>
              </div>
            </form>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-soluk">Bu öğrenciyle ilgili uyarılar</h3>
            <UyariAkisi uyarilar={uyarilar.filter((u) => u.katilimciId === k.id)} />
          </section>
        </div>
      )}
    </Pencere>
  );
}
