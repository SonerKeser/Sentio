// Sayfalara açılan dar köprü. Node.js ya da dosya sistemine erişim verilmez.
const { contextBridge, ipcRenderer } = require('electron');

// Sunucudan yüklenen Sentio arayüzü bu dört işlevi görür.
const kopru = {
  surum: '1.2.0',
  durtme: (bilgi) => ipcRenderer.send('masaustu:durtme', { baslik: String(bilgi?.baslik ?? ''), metin: String(bilgi?.metin ?? '') }),
  durum: (bilgi) => ipcRenderer.send('masaustu:durum', { metin: String(bilgi?.metin ?? ''), aktif: !!bilgi?.aktif }),
  sunucuDegistir: () => ipcRenderer.send('masaustu:sunucu-degistir'),
};
contextBridge.exposeInMainWorld('sentioMasaustu', kopru);
// Sezgi adıyla yayımlanan 1.x sunucularının arayüzü köprüyü eski adıyla arar.
contextBridge.exposeInMainWorld('sezgiMasaustu', kopru);

// Uygulamayla gelen yerel sayfalar (bağlantı ekranı, pencere seçici) ayrıca ayarlara erişir.
// Ana süreç bu isteklerin gerçekten yerel sayfadan geldiğini ayrıca denetler.
if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('sentio', {
    ayarlar: () => ipcRenderer.invoke('ayarlar:oku'),
    dene: (adres) => ipcRenderer.invoke('sunucu:dene', adres),
    baglan: (koken, rol) => ipcRenderer.invoke('sunucu:baglan', { koken, rol }),
    kaynaklar: () => ipcRenderer.invoke('secici:kaynaklar'),
    sec: (id) => ipcRenderer.invoke('secici:sec', id),
  });
}
