// Sayfalara açılan dar köprü. Node.js ya da dosya sistemine erişim verilmez.
const { contextBridge, ipcRenderer } = require('electron');

// Sunucudan yüklenen Sezgi arayüzü bu dört işlevi görür.
contextBridge.exposeInMainWorld('sezgiMasaustu', {
  surum: '1.1.0',
  durtme: (bilgi) => ipcRenderer.send('masaustu:durtme', { baslik: String(bilgi?.baslik ?? ''), metin: String(bilgi?.metin ?? '') }),
  durum: (bilgi) => ipcRenderer.send('masaustu:durum', { metin: String(bilgi?.metin ?? ''), aktif: !!bilgi?.aktif }),
  sunucuDegistir: () => ipcRenderer.send('masaustu:sunucu-degistir'),
});

// Uygulamayla gelen yerel sayfalar (bağlantı ekranı, pencere seçici) ayrıca ayarlara erişir.
// Ana süreç bu isteklerin gerçekten yerel sayfadan geldiğini ayrıca denetler.
if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('sezgi', {
    ayarlar: () => ipcRenderer.invoke('ayarlar:oku'),
    dene: (adres) => ipcRenderer.invoke('sunucu:dene', adres),
    baglan: (koken, rol) => ipcRenderer.invoke('sunucu:baglan', { koken, rol }),
    kaynaklar: () => ipcRenderer.invoke('secici:kaynaklar'),
    sec: (id) => ipcRenderer.invoke('secici:sec', id),
  });
}
