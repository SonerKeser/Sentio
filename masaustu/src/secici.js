(async () => {
  const izgara = document.getElementById('izgara');
  const kaynaklar = await window.sezgi.kaynaklar();
  if (kaynaklar.length === 0) {
    document.getElementById('yukleniyor').textContent = 'Paylaşılabilecek bir pencere bulunamadı.';
    return;
  }
  // Pencereler önce: galeri analizi çoğunlukla video konferans penceresiyle yapılır.
  kaynaklar.sort((a, b) => Number(a.ekran) - Number(b.ekran));
  izgara.replaceChildren(
    ...kaynaklar.map((k) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'kaynak';
      const resim = document.createElement('img');
      resim.className = 'onizleme';
      resim.src = k.resim;
      resim.alt = '';
      const ad = document.createElement('span');
      ad.className = 'ad';
      if (k.simge) {
        const simge = document.createElement('img');
        simge.src = k.simge;
        simge.alt = '';
        ad.append(simge);
      }
      ad.append(k.ekran && !/ekran|screen/i.test(k.ad) ? `Ekran: ${k.ad}` : k.ad);
      d.append(resim, ad);
      d.addEventListener('click', () => window.sezgi.sec(k.id));
      return d;
    }),
  );
  document.getElementById('vazgec').addEventListener('click', () => window.sezgi.sec(null));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && window.sezgi.sec(null));
})();
