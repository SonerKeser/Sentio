const $ = (id) => document.getElementById(id);
let rol = 'ogrenci';

function rolSec(yeni) {
  rol = yeni;
  for (const d of document.querySelectorAll('.rol button')) d.setAttribute('aria-pressed', String(d.dataset.rol === rol));
}

function yonga(metin, tikla) {
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'yonga';
  d.textContent = metin;
  d.addEventListener('click', tikla);
  return d;
}

async function baglan(adres) {
  $('hata').textContent = '';
  $('baglan').disabled = true;
  $('baglan').textContent = 'Bağlanıyor…';
  const sonuc = await window.sezgi.dene(adres);
  if (!sonuc.tamam) {
    $('hata').textContent = sonuc.hata;
    $('baglan').disabled = false;
    $('baglan').textContent = 'Bağlan';
    return;
  }
  await window.sezgi.baglan(sonuc.koken, rol);
}

async function bulunanlariGoster() {
  const ayarlar = await window.sezgi.ayarlar();
  const liste = ayarlar.bulunan ?? [];
  $('bulunanBolum').hidden = liste.length === 0;
  $('bulunan').replaceChildren(
    ...liste.map((s) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'sunucu';
      const nokta = document.createElement('span');
      nokta.className = 'nokta';
      const metin = document.createElement('span');
      metin.textContent = s.koken.replace(/^https?:\/\//, '');
      const alt = document.createElement('small');
      const diger = s.digerleri?.length ? `${s.digerleri.length} başka adres daha` : '';
      alt.textContent = [s.makine, s.surum && `Sezgi ${s.surum}`, diger].filter(Boolean).join(', ');
      metin.append(alt);
      d.append(nokta, metin);
      d.addEventListener('click', () => baglan(s.koken));
      return d;
    }),
  );
}

(async () => {
  const ayarlar = await window.sezgi.ayarlar();
  rolSec(ayarlar.rol || 'ogrenci');
  if (ayarlar.sunucu) $('adres').value = ayarlar.sunucu.replace(/^http:\/\//, '');
  $('sonlar').replaceChildren(...(ayarlar.sonSunucular || []).map((s) => yonga(s.replace(/^https?:\/\//, ''), () => baglan(s))));
  $('surum').textContent = `Sezgi Masaüstü ${ayarlar.surum}`;
  const hata = new URLSearchParams(location.search).get('hata');
  if (hata) $('hata').textContent = hata;

  for (const d of document.querySelectorAll('.rol button')) d.addEventListener('click', () => rolSec(d.dataset.rol));
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    baglan($('adres').value);
  });

  bulunanlariGoster();
  setInterval(bulunanlariGoster, 2000);
  $('adres').focus();
})();
