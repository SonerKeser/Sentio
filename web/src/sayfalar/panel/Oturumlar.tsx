import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BarChart3, Plus, Radio, Trash2, Users } from 'lucide-react';
import { api } from '../../api/istemci';
import type { OturumDetayi, OturumOzeti } from '../../api/turler';
import { Maskot } from '../../bilesenler/Maskot';
import { Alan, Anahtar, Donen, Dugme, Pencere, tarihYaz, useBildirim } from '../../bilesenler/ui';
import { usePanel } from './PanelKabugu';

export default function Oturumlar() {
  const { ogretmen } = usePanel();
  const [liste, setListe] = useState<OturumOzeti[] | null>(null);
  const [yeniAcik, setYeniAcik] = useState(false);
  const bildir = useBildirim();

  const yukle = () =>
    api<OturumOzeti[]>('/api/oturumlar')
      .then(setListe)
      .catch((e) => bildir(e.message, 'hata'));

  useEffect(() => {
    yukle();
    const z = setInterval(yukle, 10_000);
    return () => clearInterval(z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sil = async (o: OturumOzeti) => {
    if (!confirm(`"${o.baslik}" dersi ve tüm ölçümleri kalıcı olarak silinsin mi?`)) return;
    try {
      await api(`/api/oturumlar/${o.id}`, { method: 'DELETE' });
      bildir('Ders silindi.', 'basari');
      yukle();
    } catch (e) {
      bildir((e as Error).message, 'hata');
    }
  };

  const canli = liste?.filter((o) => o.durum === 'canli') ?? [];
  const biten = liste?.filter((o) => o.durum === 'bitti') ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-soluk">Merhaba {ogretmen.adSoyad.split(' ')[0]},</p>
          <h1 className="text-4xl font-bold sm:text-5xl">Dersler</h1>
        </div>
        <Dugme tur="birincil" boyut="buyuk" simge={<Plus size={20} />} onClick={() => setYeniAcik(true)}>
          Yeni ders başlat
        </Dugme>
      </header>

      {!liste ? (
        <div className="grid place-items-center py-24 text-soluk">
          <Donen boyut={26} />
        </div>
      ) : liste.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-5 text-center">
          <Maskot duygu="saskin" boyut={180} />
          <h2 className="text-3xl font-bold">Henüz bir ders yok</h2>
          <p className="max-w-md text-soluk">
            Bir ders başlattığınızda öğrencileriniz size verilen kodla katılır. Öğrenci olmadan denemek isterseniz dersi açtıktan sonra sanal sınıf ekleyebilirsiniz.
          </p>
          <Dugme tur="birincil" boyut="buyuk" onClick={() => setYeniAcik(true)}>
            İlk dersini başlat
          </Dugme>
        </div>
      ) : (
        <>
          {canli.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-soluk">
                <Radio size={18} className="text-d-ofkeli" /> Şu an süren
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {canli.map((o, i) => (
                  <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link
                      to={`/panel/oturum/${o.id}`}
                      className="group relative flex items-center gap-5 overflow-hidden rounded-kart border border-gunes/30 bg-gradient-to-br from-gece-3 to-gece-2 p-5 transition-colors hover:border-gunes/60"
                    >
                      <span className="absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-d-ofkeli [--nabiz-renk:rgb(255_107_94/0.6)] animate-nabiz" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-2xl font-bold">{o.baslik}</h3>
                        <p className="mt-1 text-soluk">{o.sinifAdi ?? 'Sınıf belirtilmedi'} · {tarihYaz(o.olusturmaZamani)}</p>
                        <div className="mt-4 flex items-center gap-4 text-sm">
                          <span className="rakam rounded-lg bg-gece px-2.5 py-1 text-lg font-bold tracking-[0.18em] text-gunes">{o.katilimKodu}</span>
                          <span className="flex items-center gap-1.5 text-soluk">
                            <Users size={16} /> {o.aktifSayisi} aktif / {o.katilimciSayisi}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gunes opacity-0 transition-opacity group-hover:opacity-100">Panele dön</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {biten.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-3 text-lg font-semibold text-soluk">Geçmiş dersler</h2>
              <div className="overflow-hidden rounded-kart border border-cizgi/60">
                {biten.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-cizgi/40 bg-gece-2/60 px-5 py-4 last:border-b-0 hover:bg-gece-2">
                    <div className="min-w-0 flex-1">
                      <Link to={`/panel/oturum/${o.id}/rapor`} className="text-lg font-semibold hover:text-gunes">
                        {o.baslik}
                      </Link>
                      <p className="text-sm text-silik">
                        {o.sinifAdi ? `${o.sinifAdi} · ` : ''}
                        {tarihYaz(o.olusturmaZamani)}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-soluk">
                      <Users size={15} /> {o.katilimciSayisi}
                    </span>
                    <span className="w-24 text-sm text-soluk">{o.uyariSayisi} uyarı</span>
                    <div className="flex gap-1">
                      <Link to={`/panel/oturum/${o.id}/rapor`} className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-metin hover:bg-gece-3">
                        <BarChart3 size={16} /> Rapor
                      </Link>
                      <button onClick={() => sil(o)} className="rounded-full p-2 text-silik hover:bg-gece-3 hover:text-d-ofkeli" aria-label={`${o.baslik} dersini sil`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <YeniDers acik={yeniAcik} kapat={() => setYeniAcik(false)} />
    </div>
  );
}

function YeniDers({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const [baslik, setBaslik] = useState('');
  const [sinifAdi, setSinifAdi] = useState('');
  const [anonim, setAnonim] = useState(false);
  const [durtme, setDurtme] = useState(true);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const git = useNavigate();

  const olustur = async (e: React.FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    try {
      const o = await api<OturumDetayi>('/api/oturumlar', {
        method: 'POST',
        govde: { baslik, sinifAdi: sinifAdi || null, ayarlar: { anonim, durtmeAcik: durtme } },
      });
      git(`/panel/oturum/${o.id}`);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Pencere acik={acik} kapat={kapat} baslik="Yeni ders">
      <form onSubmit={olustur} className="flex flex-col gap-5">
        <Alan etiket="Ders başlığı" value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="Ör. Fizik: Işığın kırılması" maxLength={160} autoFocus required />
        <Alan etiket="Sınıf" value={sinifAdi} onChange={(e) => setSinifAdi(e.target.value)} placeholder="Ör. 11-A" maxLength={80} />
        <div className="flex flex-col gap-1 rounded-2xl border border-cizgi/60 p-3">
          <Anahtar acik={durtme} degisti={setDurtme} etiket="Öğrencilere destek bildirimi gönder" aciklama="Kalıcı olumsuz ifade, dikkat dağınıklığı ya da yorgunlukta öğrenciye nazik bir mesaj gider." />
          <Anahtar acik={anonim} degisti={setAnonim} etiket="Anonim mod" aciklama="Panelde ve raporda öğrenci adları yerine sıra numaraları görünür." />
        </div>
        {hata && <p className="text-d-ofkeli">{hata}</p>}
        <Dugme tur="birincil" boyut="buyuk" type="submit" yukleniyor={bekliyor}>
          Dersi başlat
        </Dugme>
      </form>
    </Pencere>
  );
}
