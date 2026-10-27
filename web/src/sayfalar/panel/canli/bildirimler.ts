import { useEffect, useRef } from 'react';
import type { SinyalBildirimi, UyariBildirimi } from '../../../api/turler';

let ses: AudioContext | null = null;

/** Kısa, yumuşak iki tonlu bir uyarı sesi; dosya gerektirmez. */
export function zilCal() {
  try {
    ses ??= new AudioContext();
    const baslangic = ses.currentTime;
    [660, 880].forEach((frekans, i) => {
      const osilator = ses!.createOscillator();
      const kazanc = ses!.createGain();
      osilator.type = 'sine';
      osilator.frequency.value = frekans;
      kazanc.gain.setValueAtTime(0, baslangic + i * 0.14);
      kazanc.gain.linearRampToValueAtTime(0.12, baslangic + i * 0.14 + 0.02);
      kazanc.gain.exponentialRampToValueAtTime(0.0001, baslangic + i * 0.14 + 0.35);
      osilator.connect(kazanc).connect(ses!.destination);
      osilator.start(baslangic + i * 0.14);
      osilator.stop(baslangic + i * 0.14 + 0.4);
    });
  } catch {
    /* ses aygıtı yok */
  }
}

export async function bildirimIzniIste(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/**
 * Öğretmen başka bir pencereye (ör. video konferans) geçtiğinde yeni uyarıları ve söz isteklerini
 * sistem bildirimi ve kısa bir sesle duyurur. Sezgi penceresi öndeyken sessiz kalır.
 */
export function useOgretmenBildirimleri(acik: boolean, uyarilar: UyariBildirimi[], sorular: SinyalBildirimi[]) {
  const gorulen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const anahtarlar = [...uyarilar.map((u) => `u${u.id}`), ...sorular.map((s) => `s${s.id}`)];
    if (gorulen.current === null) {
      gorulen.current = new Set(anahtarlar);
      return;
    }
    const yeniUyarilar = uyarilar.filter((u) => !gorulen.current!.has(`u${u.id}`) && u.tur !== 'ogretmenMesaji');
    const yeniSorular = sorular.filter((s) => !gorulen.current!.has(`s${s.id}`));
    anahtarlar.forEach((a) => gorulen.current!.add(a));

    if (!acik || document.hasFocus() || (yeniUyarilar.length === 0 && yeniSorular.length === 0)) return;
    zilCal();
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    for (const s of yeniSorular.slice(0, 3)) {
      new Notification(`${s.ad} söz istiyor`, { body: s.metin ?? 'Sorusu var.', tag: `soru-${s.id}`, silent: true });
    }
    for (const u of yeniUyarilar.slice(0, 3)) {
      new Notification('Sezgi', { body: u.mesaj, tag: `uyari-${u.id}`, silent: true });
    }
  }, [acik, uyarilar, sorular]);
}
