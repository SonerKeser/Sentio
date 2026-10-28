// Sentio masaüstü istemcisi: ana süreç.
// Arayüzün kendisi Sentio sunucusundan yüklenir; bu süreç pencereyi, sistem tepsisini, izinleri,
// destek bildirimlerini, ekran seçiciyi ve yerel ağdaki sunucuların bulunmasını yönetir.
const { app, BrowserWindow, Tray, Menu, ipcMain, session, desktopCapturer, shell, nativeImage, Notification, net, systemPreferences } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const dgram = require('node:dgram');

const DUYURU_PORTU = 5758;
const MAC = process.platform === 'darwin';
const ayarDosyasi = () => path.join(app.getPath('userData'), 'ayarlar.json');
// Sentio 1.2 sürümüne kadar "Sezgi" adını taşıyordu: eski kurulumun ayarları ve o sürümlerin sunucuları tanınır.
const ESKI_AD = 'Sezgi';
const eskiAyarDosyasi = () => path.join(app.getPath('appData'), ESKI_AD, 'ayarlar.json');
const sentioSunucusuMu = (ad) => ad === 'Sentio' || ad === ESKI_AD;

function ayarlariOku() {
  for (const dosya of [ayarDosyasi(), eskiAyarDosyasi()]) {
    try {
      return JSON.parse(fs.readFileSync(dosya, 'utf8'));
    } catch {
      /* sıradaki dosya */
    }
  }
  return { sunucu: null, rol: 'ogrenci', sonSunucular: [] };
}

function ayarlariYaz(ayarlar) {
  fs.mkdirSync(path.dirname(ayarDosyasi()), { recursive: true });
  fs.writeFileSync(ayarDosyasi(), JSON.stringify(ayarlar, null, 2));
}

/** "192.168.1.5:5757" gibi kısa yazımları tam köke çevirir. */
function adresNormallestir(girdi) {
  let metin = String(girdi || '').trim();
  if (!metin) return null;
  if (!/^https?:\/\//i.test(metin)) metin = `http://${metin}`;
  try {
    const url = new URL(metin);
    if (!url.port && url.protocol === 'http:' && !/\./.test(url.hostname) && url.hostname !== 'localhost') return null;
    return url.origin;
  } catch {
    return null;
  }
}

let ayarlar = ayarlariOku();

// Tarayıcılar kamerayı yalnızca güvenli bağlamda açar. Okul ağlarında sunucu çoğu zaman düz http ile
// çalıştığından, yalnızca kullanıcının seçtiği Sentio sunucusu güvenli kabul edilir. Bu anahtar başlangıçta
// verilmek zorunda olduğundan sunucu değişince uygulama yeniden başlatılır.
if (ayarlar.sunucu && ayarlar.sunucu.startsWith('http://')) {
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', ayarlar.sunucu);
}
// Öğrenci video konferans penceresindeyken analiz yavaşlamasın.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/** @type {BrowserWindow | null} */
let pencere = null;
/** @type {Tray | null} */
let tepsi = null;
let cikiliyor = false;
let tepsiBilgisiGosterildi = false;
let bekleyenEkranIstegi = null;
const bulunanSunucular = new Map();

const simgeYolu = (ad) => path.join(__dirname, '..', 'simge', ad);

function hedefAdres() {
  const yol = ayarlar.rol === 'ogretmen' ? '/panel' : '/katil';
  return `${ayarlar.sunucu}${yol}`;
}

function sunucuKokenindenMi(adres) {
  try {
    return ayarlar.sunucu && new URL(adres).origin === ayarlar.sunucu;
  } catch {
    return false;
  }
}

function baglantiSayfasiniAc(hata) {
  pencere?.loadFile(path.join(__dirname, 'baglanti.html'), { query: hata ? { hata } : {} });
}

function pencereOlustur() {
  pencere = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#1A1535',
    title: 'Sentio',
    icon: simgeYolu('simge.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'onyukleme.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  pencere.once('ready-to-show', () => pencere.show());

  // Sunucu dışındaki bağlantılar (ör. GitHub) varsayılan tarayıcıda açılır; uygulama içinde başka siteye gidilmez.
  pencere.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  pencere.webContents.on('will-navigate', (olay, url) => {
    if (url.startsWith('file:') || sunucuKokenindenMi(url)) return;
    olay.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  pencere.webContents.on('did-fail-load', (_o, kod, aciklama, url, anaCerceve) => {
    if (anaCerceve && sunucuKokenindenMi(url)) baglantiSayfasiniAc(`Sunucuya ulaşılamadı (${aciklama || kod}).`);
  });
  pencere.webContents.on('before-input-event', (_o, girdi) => {
    if (girdi.type === 'keyDown' && girdi.key === 'F12' && !app.isPackaged) pencere.webContents.toggleDevTools();
  });

  // Öğrenci pencereyi kapatınca analiz arka planda sürer; uygulama tepsiden kapatılır.
  pencere.on('close', (olay) => {
    if (cikiliyor || ayarlar.rol !== 'ogrenci' || !ayarlar.sunucu) return;
    olay.preventDefault();
    pencere.hide();
    if (!tepsiBilgisiGosterildi && Notification.isSupported()) {
      tepsiBilgisiGosterildi = true;
      const yer = MAC ? 'menü çubuğundaki' : 'sistem tepsisindeki';
      new Notification({ title: 'Sentio çalışmaya devam ediyor', body: `Ders sürerken arka planda kalır. Kapatmak için ${yer} simgeyi kullanın.`, icon: simgeYolu('simge.png') }).show();
    }
  });

  if (ayarlar.sunucu) pencere.loadURL(hedefAdres());
  else baglantiSayfasiniAc();
}

/** macOS'ta uygulama menüsü olmadan kopyala/yapıştır kısayolları da çalışmaz; diğer sistemlerde menü yoktur. */
function macMenusu() {
  return Menu.buildFromTemplate([
    {
      label: 'Sentio',
      submenu: [
        { role: 'about', label: 'Sentio hakkında' },
        { type: 'separator' },
        { role: 'hide', label: 'Sentio’yu gizle' },
        { role: 'hideOthers', label: 'Diğerlerini gizle' },
        { role: 'unhide', label: 'Tümünü göster' },
        { type: 'separator' },
        { role: 'quit', label: 'Sentio’dan çık' },
      ],
    },
    {
      label: 'Düzen',
      submenu: [
        { role: 'undo', label: 'Geri al' },
        { role: 'redo', label: 'Yinele' },
        { type: 'separator' },
        { role: 'cut', label: 'Kes' },
        { role: 'copy', label: 'Kopyala' },
        { role: 'paste', label: 'Yapıştır' },
        { role: 'selectAll', label: 'Tümünü seç' },
      ],
    },
    {
      label: 'Pencere',
      submenu: [
        { role: 'minimize', label: 'Küçült' },
        { role: 'close', label: 'Kapat' },
      ],
    },
  ]);
}

function tepsiOlustur() {
  // macOS menü çubuğu tek renkli şablon simge ister; @2x sürümü kendiliğinden seçilir.
  tepsi = new Tray(nativeImage.createFromPath(simgeYolu(MAC ? 'tepsiTemplate.png' : 'tepsi.png')));
  tepsi.setToolTip('Sentio');
  const menu = () =>
    Menu.buildFromTemplate([
      { label: 'Sentio’yu göster', click: goster },
      { label: 'Sunucuyu değiştir', click: () => (goster(), baglantiSayfasiniAc()) },
      { type: 'separator' },
      { label: 'Çıkış', click: () => ((cikiliyor = true), app.quit()) },
    ]);
  tepsi.setContextMenu(menu());
  tepsi.on('click', goster);
}

function goster() {
  if (!pencere) return;
  if (pencere.isMinimized()) pencere.restore();
  pencere.show();
  pencere.focus();
}

function izinleriAyarla() {
  const izinli = new Set(['media', 'display-capture', 'notifications', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((wc, izin, karar, ayrinti) => {
    const koken = ayrinti?.requestingUrl || wc.getURL();
    if (!sunucuKokenindenMi(koken) || !izinli.has(izin)) return karar(false);
    // Mikrofon hiçbir zaman istenmez; yalnızca görüntü.
    if (izin === 'media' && ayrinti?.mediaTypes?.includes('audio')) return karar(false);
    // macOS kamerayı ayrıca uygulama düzeyinde sorar; reddedilirse sayfa "izin verilmedi" hatası alır.
    if (izin === 'media' && MAC) return systemPreferences.askForMediaAccess('camera').then(karar, () => karar(false));
    karar(true);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, izin, koken) => sunucuKokenindenMi(koken) && izinli.has(izin));

  // Galeri analizi için ekran ya da pencere seçimi (tarayıcıdaki "paylaş" penceresinin karşılığı).
  session.defaultSession.setDisplayMediaRequestHandler((istek, yanit) => {
    if (!sunucuKokenindenMi(istek.securityOrigin || istek.frame?.url || '')) return yanit({});
    bekleyenEkranIstegi?.({});
    bekleyenEkranIstegi = yanit;
    const secici = new BrowserWindow({
      parent: pencere,
      modal: true,
      width: 860,
      height: 600,
      backgroundColor: '#211B44',
      title: 'Paylaşılacak pencereyi seçin',
      autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'onyukleme.js'), contextIsolation: true, sandbox: true },
    });
    secici.loadFile(path.join(__dirname, 'secici.html'));
    secici.on('closed', () => {
      bekleyenEkranIstegi?.({});
      bekleyenEkranIstegi = null;
    });
  });
}

/** Ayar değiştiren istekler yalnızca uygulamayla gelen yerel sayfalardan kabul edilir. */
const yereldenMi = (olay) => (olay.senderFrame?.url ?? '').startsWith('file:');

function ipcKaydet() {
  // Yerel sayfalar (bağlantı ekranı, seçici)
  ipcMain.handle('ayarlar:oku', (olay) => yereldenMi(olay) && ({ ...ayarlar, bulunan: [...bulunanSunucular.values()], surum: app.getVersion() }));

  ipcMain.handle('sunucu:dene', async (olay, girdi) => {
    if (!yereldenMi(olay)) return { tamam: false };
    const koken = adresNormallestir(girdi);
    if (!koken) return { tamam: false, hata: 'Adres anlaşılamadı. Ör. 192.168.1.20:5757' };
    try {
      const denetleyici = new AbortController();
      const zaman = setTimeout(() => denetleyici.abort(), 5000);
      const yanit = await net.fetch(`${koken}/saglik`, { signal: denetleyici.signal });
      clearTimeout(zaman);
      const govde = await yanit.json();
      if (!sentioSunucusuMu(govde?.ad)) return { tamam: false, hata: 'Bu adreste bir Sentio sunucusu yok.' };
      return { tamam: true, koken, surum: govde.surum };
    } catch {
      return { tamam: false, hata: 'Sunucuya ulaşılamadı. Adresi ve aynı ağda olduğunuzu kontrol edin.' };
    }
  });

  ipcMain.handle('sunucu:baglan', (olay, { koken, rol }) => {
    if (!yereldenMi(olay) || !adresNormallestir(koken)) return;
    koken = adresNormallestir(koken);
    const oncekiKoken = ayarlar.sunucu;
    ayarlar = {
      ...ayarlar,
      sunucu: koken,
      rol: rol === 'ogretmen' ? 'ogretmen' : 'ogrenci',
      sonSunucular: [koken, ...(ayarlar.sonSunucular || []).filter((s) => s !== koken)].slice(0, 5),
    };
    ayarlariYaz(ayarlar);
    // Güvenli köken anahtarı yalnızca başlangıçta okunur; http sunucu değiştiyse yeniden başlat.
    if (koken.startsWith('http://') && koken !== oncekiKoken) {
      cikiliyor = true;
      app.relaunch();
      app.exit(0);
      return;
    }
    pencere.loadURL(hedefAdres());
  });

  ipcMain.handle('secici:kaynaklar', async (olay) => {
    if (!yereldenMi(olay)) return { kaynaklar: [] };
    // macOS'ta ekran kaydı izni yokken pencereler içeriksiz listelenir; ilk istekte sistem izni sorar.
    const izinGerekli = MAC && systemPreferences.getMediaAccessStatus('screen') !== 'granted';
    const kaynaklar = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 320, height: 200 }, fetchWindowIcons: true });
    return {
      izinGerekli,
      kaynaklar: kaynaklar
        .filter((k) => !k.name.startsWith('Sentio'))
        .map((k) => ({ id: k.id, ad: k.name, ekran: k.id.startsWith('screen:'), resim: k.thumbnail.toDataURL(), simge: k.appIcon?.toDataURL() ?? null })),
    };
  });

  ipcMain.handle('secici:sec', async (olay, id) => {
    if (!yereldenMi(olay)) return;
    const yanit = bekleyenEkranIstegi;
    bekleyenEkranIstegi = null;
    BrowserWindow.fromWebContents(olay.sender)?.close();
    if (!yanit) return;
    if (!id) return yanit({});
    const kaynaklar = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    const kaynak = kaynaklar.find((k) => k.id === id);
    yanit(kaynak ? { video: kaynak } : {});
  });

  // Sunucudan yüklenen sayfanın köprüsü
  ipcMain.on('masaustu:durtme', (olay, { baslik, metin }) => {
    if (!pencere || olay.sender !== pencere.webContents) return;
    const gizliydi = !pencere.isVisible() || pencere.isMinimized();
    goster();
    pencere.setAlwaysOnTop(true, 'floating');
    pencere.flashFrame(true);
    if (gizliydi && Notification.isSupported()) {
      new Notification({ title: String(baslik).slice(0, 120), body: String(metin).slice(0, 300), icon: simgeYolu('simge.png') }).show();
    }
    // Eski sistemdeki gibi: bildirim gösterildikten sonra pencere önceki yerine döner.
    setTimeout(() => {
      if (!pencere) return;
      pencere.setAlwaysOnTop(false);
      pencere.flashFrame(false);
      if (gizliydi && !pencere.isFocused()) pencere.minimize();
    }, 15_000);
  });

  ipcMain.on('masaustu:durum', (olay, { metin }) => {
    if (olay.sender === pencere?.webContents) tepsi?.setToolTip(`Sentio · ${String(metin).slice(0, 100)}`);
  });

  ipcMain.on('masaustu:sunucu-degistir', (olay) => {
    if (olay.sender === pencere?.webContents) baglantiSayfasiniAc();
  });
}

/** Sunucuların UDP duyurularını dinler (AgDuyurucu); bağlantı ekranında "Bu ağda bulunanlar" olarak listelenir. */
function sunuculariDinle() {
  const soket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  soket.on('message', (ileti) => {
    try {
      const d = JSON.parse(ileti.toString('utf8'));
      if (!sentioSunucusuMu(d?.ad) || !Array.isArray(d.adresler)) return;
      // Bir sunucu birden çok ağ bağdaştırıcısından duyurulabilir; makine başına tek kayıt tutulur.
      const kokenler = d.adresler.slice(0, 6).map(adresNormallestir).filter(Boolean);
      if (kokenler.length === 0) return;
      const makine = String(d.makine || '').slice(0, 60);
      bulunanSunucular.set(makine || kokenler[0], { koken: kokenler[0], digerleri: kokenler.slice(1), makine, surum: String(d.surum || ''), zaman: Date.now() });
    } catch {
      /* Sentio duyurusu değil */
    }
  });
  soket.on('error', () => soket.close());
  soket.bind(DUYURU_PORTU);
  setInterval(() => {
    for (const [k, v] of bulunanSunucular) if (Date.now() - v.zaman > 15_000) bulunanSunucular.delete(k);
  }, 5000).unref();
}

async function guncellemeleriDenetle() {
  // Windows kurulum sürümü ve Linux AppImage GitHub sürümlerinden kendini günceller. Taşınabilir sürüm
  // güncelleyemez; macOS'ta kendini güncelleme Apple imzası ister, yeni sürüm indirme sayfasından alınır.
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR || MAC) return;
  if (process.platform === 'linux' && !process.env.APPIMAGE) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    await autoUpdater.checkForUpdatesAndNotify({ title: 'Sentio güncellendi', body: 'Yeni sürüm uygulama kapanınca kurulacak.' });
  } catch {
    /* çevrimdışı okul ağı: güncelleme denetimi atlanır */
  }
}

app.on('second-instance', goster);
// macOS: pencere gizliyken Dock simgesine tıklamak onu geri getirir.
app.on('activate', goster);
app.on('before-quit', () => (cikiliyor = true));
app.on('window-all-closed', () => app.quit());

app.whenReady().then(() => {
  // Uygulama kimliği eski addan kalır: değişseydi kurulu Sezgi 1.x uygulamaları yerinde güncellenemezdi.
  app.setAppUserModelId('com.sonerkeser.sezgi');
  Menu.setApplicationMenu(MAC ? macMenusu() : null);
  izinleriAyarla();
  ipcKaydet();
  pencereOlustur();
  tepsiOlustur();
  sunuculariDinle();
  guncellemeleriDenetle();
});
