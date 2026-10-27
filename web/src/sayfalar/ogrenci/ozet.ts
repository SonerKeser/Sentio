import { DUYGULAR } from '../../alan/duygular';
import type { OkumaGirdisi } from '../../api/turler';

/** Öğrencinin kendi cihazında tuttuğu ders özeti; sunucuya gönderilmez. */
export interface DersOzeti {
  sureMs: number;
  olcum: number;
  yuzlu: number;
  dagilim: number[];
  dikkat: number;
  yoklama: number;
  sinyal: number;
  verilerSilindi: boolean;
}

export class OzetToplayici {
  private readonly baslangic = Date.now();
  private olcum = 0;
  private yuzlu = 0;
  private readonly dagilim = new Array<number>(DUYGULAR.length).fill(0);
  private dikkat = 0;
  private readonly yoklamalar = new Set<string>();
  private sinyal = 0;

  ekle(o: OkumaGirdisi) {
    this.olcum++;
    if (!o.yuz) return;
    this.yuzlu++;
    o.d.forEach((x, i) => (this.dagilim[i] += x));
    this.dikkat += o.dikkat;
  }

  yoklamaYanitlandi(id: string) {
    this.yoklamalar.add(id);
  }

  sinyalGonderildi() {
    this.sinyal++;
  }

  sonuc(verilerSilindi: boolean): DersOzeti {
    const n = Math.max(1, this.yuzlu);
    return {
      sureMs: Date.now() - this.baslangic,
      olcum: this.olcum,
      yuzlu: this.yuzlu,
      dagilim: this.dagilim.map((x) => x / n),
      dikkat: this.dikkat / n,
      yoklama: this.yoklamalar.size,
      sinyal: this.sinyal,
      verilerSilindi,
    };
  }
}
