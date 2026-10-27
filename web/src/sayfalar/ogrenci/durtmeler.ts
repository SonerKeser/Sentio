import type { Duygu } from '../../alan/duygular';
import type { DurtmeBildirimi } from '../../api/turler';

export interface DurtmeIcerigi {
  baslik: string;
  metin: string;
  /** Maskot önce bu ifadeyle karşılar, sonra cesaretlendiren bir gülümsemeye döner. */
  ilkIfade: Duygu;
  sonIfade: Duygu;
}

const OLUMSUZ: Record<string, Omit<DurtmeIcerigi, 'ilkIfade' | 'sonIfade'>> = {
  uzgun: {
    baslik: 'Biraz zorlanıyor gibisin',
    metin: 'Takıldığın bir yer varsa sormaktan çekinme; öğretmenin yardım etmeye hazır.',
  },
  ofkeli: {
    baslik: 'Bir şey canını sıkmış gibi',
    metin: 'Derin bir nefes al. İstersen öğretmenine yazabilir ya da kısa bir ara isteyebilirsin.',
  },
  korku: {
    baslik: 'Endişelenme, herkes bazen kaybolur',
    metin: 'Anlamadığın yeri not et; birlikte üzerinden geçmek için iyi bir başlangıç olur.',
  },
  igrenme: {
    baslik: 'Bu kısım pek içine sinmedi gibi',
    metin: 'Merak ettiğin bir şey varsa sor; dersi senin için daha anlamlı kılabilir.',
  },
};

export function durtmeIcerigi(d: DurtmeBildirimi): DurtmeIcerigi {
  switch (d.tur) {
    case 'olumsuzIfade': {
      const duygu = d.duygu ?? 'uzgun';
      const icerik = OLUMSUZ[duygu] ?? OLUMSUZ.uzgun;
      return { ...icerik, ilkIfade: duygu, sonIfade: 'mutlu' };
    }
    case 'dikkatDagildi':
      return {
        baslik: 'Aklın biraz başka yerde gibi',
        metin: 'Ekrana geri dönelim mi? Ders kaldığı yerden sürüyor.',
        ilkIfade: 'saskin',
        sonIfade: 'mutlu',
      };
    case 'uyuklama':
      return {
        baslik: 'Gözlerin yorulmuş görünüyor',
        metin: 'Birkaç saniye uzağa bak, omuzlarını esnet, bir yudum su iç. İyi gelir.',
        ilkIfade: 'notr',
        sonIfade: 'mutlu',
      };
    case 'kameradaYok':
      return {
        baslik: 'Seni bir süredir göremiyoruz',
        metin: 'Hazır olduğunda kameranın karşısına geçebilirsin. Ara veriyorsan Duraklat düğmesini kullan.',
        ilkIfade: 'saskin',
        sonIfade: 'notr',
      };
    default:
      return {
        baslik: 'Öğretmeninden bir mesaj var',
        metin: d.metin ?? '',
        ilkIfade: 'saskin',
        sonIfade: 'mutlu',
      };
  }
}
