declare const __SURUM__: string;

/** GitHub Pages'te yayımlanan tanıtım derlemesi: yalnız ön sayfa, sunucu uçları yok. */
export const TANITIM_MODU = import.meta.env.MODE === 'tanitim';
export const SURUM = __SURUM__;
export const DEPO = 'https://github.com/SonerKeser/Sezgi';

/** Masaüstü istemcisinin (Electron) ön yükleme betiğiyle sayfaya açtığı köprü. */
export interface MasaustuKoprusu {
  surum: string;
  durtme(bilgi: { baslik: string; metin: string }): void;
  durum(bilgi: { metin: string; aktif: boolean }): void;
  sunucuDegistir(): void;
}

declare global {
  interface Window {
    sezgiMasaustu?: MasaustuKoprusu;
  }
}

export const masaustu = (): MasaustuKoprusu | undefined => (typeof window !== 'undefined' ? window.sezgiMasaustu : undefined);
