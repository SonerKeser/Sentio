// Uygulama ve sistem tepsisi simgelerini tek bir SVG'den üretir: node betikler/simge-uret.mjs
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = (arkaPlan) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="g" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#FFE3A1"/>
      <stop offset=".55" stop-color="#FFC94A"/>
      <stop offset="1" stop-color="#FF7AD9"/>
    </radialGradient>
  </defs>
  ${arkaPlan ? '<rect width="64" height="64" rx="14" fill="#1A1535"/>' : ''}
  <g transform="${arkaPlan ? 'translate(7 7) scale(.78)' : ''}">
    <path fill="url(#g)" d="M32 4c14 0 27 9 28 26 1 16-11 30-28 30S3 47 4 31C5 14 18 4 32 4Z"/>
    <ellipse cx="23" cy="28" rx="3.6" ry="4.6" fill="#1A1535"/>
    <ellipse cx="41" cy="28" rx="3.6" ry="4.6" fill="#1A1535"/>
    <path d="M21 40c6 6 16 6 22 0" fill="none" stroke="#1A1535" stroke-width="3.6" stroke-linecap="round"/>
  </g>
</svg>`;

// macOS menü çubuğu "şablon" simgesi ister: tek renk siyah ve saydamlık; sistem açık/koyu temaya göre boyar.
// Gözler ve ağız yüzden oyulur.
const sablon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <mask id="m">
    <path fill="#fff" d="M32 4c14 0 27 9 28 26 1 16-11 30-28 30S3 47 4 31C5 14 18 4 32 4Z"/>
    <ellipse cx="23" cy="28" rx="3.6" ry="4.6" fill="#000"/>
    <ellipse cx="41" cy="28" rx="3.6" ry="4.6" fill="#000"/>
    <path d="M21 40c6 6 16 6 22 0" fill="none" stroke="#000" stroke-width="3.6" stroke-linecap="round"/>
  </mask>
  <rect width="64" height="64" fill="#000" mask="url(#m)"/>
</svg>`;

const yaz = (dosya, kaynak, boyut) => {
  const png = new Resvg(kaynak, { fitTo: { mode: 'width', value: boyut } }).render().asPng();
  writeFileSync(new URL(`../simge/${dosya}`, import.meta.url), png);
  console.log(`simge/${dosya} (${boyut}px)`);
};

yaz('simge.png', svg(true), 512);
yaz('tepsi.png', svg(false), 32);
yaz('tepsi@2x.png', svg(false), 64);
yaz('tepsiTemplate.png', sablon, 18);
yaz('tepsiTemplate@2x.png', sablon, 36);
