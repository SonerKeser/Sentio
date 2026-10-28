import { useEffect, useState } from 'react';
import { Database, ExternalLink, HardDriveDownload, Trash2, UserPlus } from 'lucide-react';
import { api, boyutYaz } from '../../api/istemci';
import type { OgretmenBilgisi, SunucuDurumu } from '../../api/turler';
import { Alan, Anahtar, Dugme, useBildirim } from '../../bilesenler/ui';
import { DEPO } from '../../ortam';
import { usePanel } from './PanelKabugu';

export default function AyarlarSayfasi() {
  const { ogretmen, surum } = usePanel();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-8">
      <h1 className="text-4xl font-bold sm:text-5xl">Ayarlar</h1>
      <ParolaBolumu />
      {ogretmen.yonetici && <SunucuBolumu />}
      {ogretmen.yonetici && <OgretmenBolumu />}
      <section className="yuzey p-6">
        <h2 className="text-xl font-semibold">Bu sunucu hakkında</h2>
        <p className="mt-2 text-soluk">
          Sentio sürüm <span className="rakam font-semibold text-metin">{surum}</span>. Ders ayarları (kalıcılık eşiği, izlenen ifadeler, anonim mod) her dersin kendi panelinden değiştirilir. Veri saklama süresi ve
          https sertifikası sunucunun <code className="rounded bg-gece px-1.5 py-0.5 text-sm">appsettings.json</code> dosyasından ayarlanır.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <a href={`${DEPO}#readme`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-gunes hover:underline">
            Kurulum belgeleri <ExternalLink size={14} />
          </a>
          <a href="/openapi/v1.json" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-gunes hover:underline">
            OpenAPI tanımı <ExternalLink size={14} />
          </a>
        </div>
      </section>
    </div>
  );
}

function SunucuBolumu() {
  const [durum, setDurum] = useState<SunucuDurumu | null>(null);
  useEffect(() => {
    const yukle = () => api<SunucuDurumu>('/api/yonetim/durum').then(setDurum).catch(() => {});
    yukle();
    const z = setInterval(yukle, 15_000);
    return () => clearInterval(z);
  }, []);

  const calisma = durum ? `${Math.floor(durum.calismaSuresiSn / 3600)} sa ${Math.floor((durum.calismaSuresiSn % 3600) / 60)} dk` : '—';
  const olcular: [string, string][] = durum
    ? [
        ['Canlı ders', String(durum.canliDers)],
        ['Bağlı öğrenci', String(durum.cevrimiciOgrenci)],
        ['Toplam ders', String(durum.dersSayisi)],
        ['Ölçüm', durum.olcumSayisi.toLocaleString('tr-TR')],
        ['Veritabanı', boyutYaz(durum.veritabaniBayt)],
        ['Çalışma süresi', calisma],
      ]
    : [];

  return (
    <section className="yuzey flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Database size={20} className="text-gunes" /> Sunucu
          </h2>
          <p className="mt-1 text-sm text-silik">Yedek, sunucu çalışırken alınabilen tutarlı bir SQLite dosyasıdır. Geri yüklemek için sunucuyu durdurup veri klasöründeki sentio.db ile değiştirin.</p>
        </div>
        <a href="/api/yonetim/yedek" className="inline-flex h-10 items-center gap-2 rounded-pill bg-gunes px-4 font-semibold text-gece hover:bg-gunes-koyu">
          <HardDriveDownload size={18} /> Yedek indir
        </a>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {olcular.map(([ad, deger]) => (
          <div key={ad}>
            <dt className="text-sm text-silik">{ad}</dt>
            <dd className="rakam text-2xl font-semibold">{deger}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ParolaBolumu() {
  const [mevcut, setMevcut] = useState('');
  const [yeni, setYeni] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const bildir = useBildirim();
  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    try {
      await api('/api/hesap/parola', { method: 'POST', govde: { mevcut, yeni } });
      bildir('Parolanız değiştirildi.', 'basari');
      setMevcut('');
      setYeni('');
    } catch (e) {
      bildir((e as Error).message, 'hata');
    } finally {
      setBekliyor(false);
    }
  };
  return (
    <form onSubmit={kaydet} className="yuzey flex flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold">Parola</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Alan etiket="Mevcut parola" type="password" value={mevcut} onChange={(e) => setMevcut(e.target.value)} autoComplete="current-password" required />
        <Alan etiket="Yeni parola" type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} autoComplete="new-password" ipucu="En az 8 karakter." required />
      </div>
      <Dugme type="submit" className="self-start" yukleniyor={bekliyor}>
        Parolayı değiştir
      </Dugme>
    </form>
  );
}

function OgretmenBolumu() {
  const { ogretmen } = usePanel();
  const [liste, setListe] = useState<OgretmenBilgisi[]>([]);
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [parola, setParola] = useState('');
  const [yonetici, setYonetici] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const bildir = useBildirim();

  const yukle = () => api<OgretmenBilgisi[]>('/api/ogretmenler').then(setListe).catch(() => {});
  useEffect(() => {
    yukle();
  }, []);

  const ekle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    try {
      await api('/api/ogretmenler', { method: 'POST', govde: { kullaniciAdi, adSoyad, parola, yonetici } });
      bildir(`${adSoyad} eklendi.`, 'basari');
      setKullaniciAdi('');
      setAdSoyad('');
      setParola('');
      setYonetici(false);
      yukle();
    } catch (e) {
      bildir((e as Error).message, 'hata');
    } finally {
      setBekliyor(false);
    }
  };

  const sil = async (o: OgretmenBilgisi) => {
    if (!confirm(`${o.adSoyad} hesabı ve tüm dersleri silinsin mi?`)) return;
    try {
      await api(`/api/ogretmenler/${o.id}`, { method: 'DELETE' });
      yukle();
    } catch (e) {
      bildir((e as Error).message, 'hata');
    }
  };

  return (
    <section className="yuzey flex flex-col gap-5 p-6">
      <h2 className="text-xl font-semibold">Öğretmenler</h2>
      <ul className="flex flex-col divide-y divide-cizgi/50">
        {liste.map((o) => (
          <li key={o.id} className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="font-semibold">{o.adSoyad}</p>
              <p className="text-sm text-silik">
                {o.kullaniciAdi}
                {o.yonetici ? ' · yönetici' : ''}
              </p>
            </div>
            {o.id !== ogretmen.id && (
              <button onClick={() => sil(o)} className="rounded-full p-2 text-silik hover:bg-gece-3 hover:text-d-ofkeli" aria-label={`${o.adSoyad} hesabını sil`}>
                <Trash2 size={17} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={ekle} className="flex flex-col gap-4 border-t border-cizgi/60 pt-5">
        <h3 className="font-semibold">Öğretmen ekle</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Alan etiket="Ad soyad" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} required />
          <Alan etiket="Kullanıcı adı" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} autoComplete="off" required />
          <Alan etiket="Geçici parola" type="password" value={parola} onChange={(e) => setParola(e.target.value)} autoComplete="new-password" required />
        </div>
        <Anahtar acik={yonetici} degisti={setYonetici} etiket="Yönetici" aciklama="Diğer öğretmenleri ekleyip silebilir." />
        <Dugme type="submit" tur="birincil" className="self-start" simge={<UserPlus size={17} />} yukleniyor={bekliyor}>
          Ekle
        </Dugme>
      </form>
    </section>
  );
}
