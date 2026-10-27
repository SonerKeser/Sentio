import { useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { DUYGULAR, type Duygu } from '../../../alan/duygular';
import { api, hubBaglantisi } from '../../../api/istemci';
import type { AnlikGoruntu, IzlemeBaslangici, OturumDetayi, Rapor, UyariBildirimi } from '../../../api/turler';

export type AkisNoktasi = { t: number; dikkat: number; aktif: number } & Record<Duygu, number>;

const AKIS_SINIRI = 60 * 60; // bir saatlik saniyelik nokta

function nokta(t: number, dagilim: number[], dikkat: number, aktif: number): AkisNoktasi {
  const n = { t, dikkat, aktif } as AkisNoktasi;
  DUYGULAR.forEach((d, i) => (n[d] = dagilim[i] ?? 0));
  return n;
}

/** Öğretmen hub'ına bağlanır, oturumu izler ve canlı akışı (anlık görüntü, uyarılar, zaman serisi) tutar. */
export function useCanliOturum(oturumId: string) {
  const [oturum, setOturum] = useState<OturumDetayi | null>(null);
  const [anlik, setAnlik] = useState<AnlikGoruntu | null>(null);
  const [uyarilar, setUyarilar] = useState<UyariBildirimi[]>([]);
  const [akis, setAkis] = useState<AkisNoktasi[]>([]);
  const [baglanti, setBaglanti] = useState<'baglaniyor' | 'bagli' | 'yeniden' | 'kopuk'>('baglaniyor');
  const [hata, setHata] = useState<string | null>(null);
  const hubRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    let iptal = false;
    const hub = hubBaglantisi('/hub/ogretmen');
    hubRef.current = hub;

    hub.on('Anlik', (a: AnlikGoruntu) => {
      setAnlik(a);
      if (a.sinif.aktif > 0) {
        setAkis((l) => {
          const yeni = [...l, nokta(a.zamanMs, a.sinif.dagilim, a.sinif.dikkat, a.sinif.aktif)];
          return yeni.length > AKIS_SINIRI ? yeni.slice(-AKIS_SINIRI) : yeni;
        });
      }
    });
    hub.on('Uyari', (u: UyariBildirimi) => setUyarilar((l) => (l.some((x) => x.id === u.id) ? l : [u, ...l].slice(0, 200))));
    hub.on('OturumGuncellendi', (o: OturumDetayi) => setOturum(o));
    hub.on('OturumBitti', (o: OturumDetayi) => setOturum(o));

    const izle = async () => {
      const b = await hub.invoke<IzlemeBaslangici>('Izle', oturumId);
      if (iptal) return;
      setOturum(b.oturum);
      setAnlik(b.anlik);
      setUyarilar(b.uyarilar);
    };
    hub.onreconnecting(() => setBaglanti('yeniden'));
    hub.onreconnected(() => {
      setBaglanti('bagli');
      izle().catch(() => {});
    });
    hub.onclose(() => setBaglanti('kopuk'));

    (async () => {
      try {
        // Sayfa yenilenirse zaman serisi, raporun 5 saniyelik dilimleriyle yeniden doldurulur.
        const gecmis = await api<Rapor>(`/api/oturumlar/${oturumId}/rapor?aralik=5`).catch(() => null);
        if (gecmis && !iptal) setAkis(gecmis.zaman.dilimler.filter((d) => d.aktif > 0).map((d) => nokta(d.zamanMs, d.dagilim, d.dikkat, d.aktif)));
        await hub.start();
        if (iptal) return;
        setBaglanti('bagli');
        await izle();
      } catch (e) {
        if (iptal) return;
        const mesaj = (e as Error).message ?? String(e);
        if (mesaj.includes('canlı değil')) {
          const o = await api<OturumDetayi>(`/api/oturumlar/${oturumId}`).catch(() => null);
          if (o) setOturum(o);
          else setHata('Ders bulunamadı.');
        } else setHata(mesaj);
      }
    })();

    return () => {
      iptal = true;
      if (hub.state === HubConnectionState.Connected) hub.invoke('Birak', oturumId).catch(() => {});
      hub.stop();
    };
  }, [oturumId]);

  return useMemo(() => ({ oturum, setOturum, anlik, uyarilar, akis, baglanti, hata, hub: hubRef }), [oturum, anlik, uyarilar, akis, baglanti, hata]);
}
