# Kurulum

## 1. Sunucu

### Windows

1. [Sentio-Sunucu-win-x64.zip](https://github.com/SonerKeser/Sentio/releases/latest/download/Sentio-Sunucu-win-x64.zip) dosyasını bir klasöre açın.
2. `Sentio.Sunucu.exe` dosyasını çalıştırın. Windows Güvenlik Duvarı sorarsa **özel ağlarda** izin verin.
3. Tarayıcıda `http://localhost:5757/panel` açılır; ilk yönetici hesabını oluşturun.

Windows hizmeti olarak çalıştırmak için (yönetici PowerShell):

```powershell
New-Service -Name Sentio -BinaryPathName "C:\Sentio\Sentio.Sunucu.exe" -DisplayName "Sentio" -StartupType Automatic
Start-Service Sentio
```

### Linux

```bash
tar -xzf Sentio-Sunucu-linux-x64.tar.gz
sudo mv Sentio-Sunucu-linux-x64 /opt/sentio
sudo useradd --system --home /opt/sentio sentio && sudo chown -R sentio /opt/sentio
sudo cp /opt/sentio/sentio.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sentio
```

Raspberry Pi 4/5 için `linux-arm64` paketini kullanın.

### Docker

```bash
git clone https://github.com/SonerKeser/Sentio.git
cd Sentio
docker compose up -d
```

Veriler `sentio-veri` hacminde kalır.

## 2. Ağ ve güvenlik duvarı

| Port | Protokol | Amaç |
| --- | --- | --- |
| 5757 | TCP | Web arayüzü, API, canlı bağlantı |
| 5758 | UDP | Yerel ağ duyurusu (masaüstü uygulaması sunucuyu kendiliğinden bulur). İsteğe bağlı. |

## 3. https

Tarayıcılar kamerayı yalnızca **https** ya da `localhost` üzerinde açar. Seçenekler:

- **Sentio Masaüstü:** Yerel ağda https olmadan çalışır; okul içi kullanım için en kolay yol.
- **Kestrel sertifikası:** `appsettings.json` içine ekleyin:

  ```json
  "Urls": "http://*:5757;https://*:5759",
  "Kestrel": {
    "Certificates": {
      "Default": { "Path": "sertifika.pfx", "Password": "..." }
    }
  }
  ```

  `GenelAdres` ayarına https adresini yazın ki davet karekodu doğru adresi göstersin.
- **Ters vekil:** Caddy ya da nginx ile https sonlandırın; WebSocket yükseltmesine izin verin. `GenelAdres` ayarına dış adresi yazın ki karekod doğru adresi göstersin.

## 4. Ayarlar (`appsettings.json`)

| Anahtar | Varsayılan | Açıklama |
| --- | --- | --- |
| `Urls` | `http://*:5757` | Dinlenen adresler |
| `Sentio:VeriKlasoru` | `veri` | SQLite veritabanı ve anahtarlar |
| `Sentio:VeriSaklamaGun` | `180` | Biten derslerin silinme süresi; `0` kapatır |
| `Sentio:GenelAdres` | — | Öğrencilere gösterilecek adres (ör. `https://sentio.okul.edu.tr`) |
| `Sentio:IndirmeKlasoru` | `indirmeler` | Buraya konan dosyalar ana sayfada "Bu sunucudan indir" olarak listelenir |
| `Sentio:AgDuyurusu` | `true` | UDP 5758 yerel ağ duyurusu |
| `Sentio:AcilistaTarayiciAc` | `true` | Windows'ta konsoldan açılınca paneli tarayıcıda açar |

Her ayar ortam değişkeniyle de verilebilir: `Sentio__VeriSaklamaGun=90`.

## 5. İstemciler

- **Öğrenci (tarayıcı):** `http(s)://sunucu:5757/katil` ya da öğretmenin karekodu.
- **Sentio Masaüstü:** İlk açılışta ağdaki sunucular listelenir; rol (öğrenci/öğretmen) seçilir. Uygulamalar imzasızdır.
  - **Windows:** [kurulum](https://github.com/SonerKeser/Sentio/releases/latest/download/Sentio-Masaustu-Kurulum.exe) (kendini günceller) ya da [taşınabilir](https://github.com/SonerKeser/Sentio/releases/latest/download/Sentio-Masaustu-Tasinabilir.exe). SmartScreen uyarısında "Ek bilgi → Yine de çalıştır" deyin.
  - **macOS 13 ve sonrası:** [Apple Silicon](https://github.com/SonerKeser/Sentio/releases/latest/download/Sentio-Masaustu-mac-arm64.dmg) ya da [Intel](https://github.com/SonerKeser/Sentio/releases/latest/download/Sentio-Masaustu-mac-x64.dmg). Sentio'yu Uygulamalar klasörüne sürükleyin. İlk açılışta macOS uygulamayı engellerse **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç** deyin. Kamera iznini ilk derste uygulama sorar. Öğretmen galeri analizi için **Ekran ve Sistem Sesi Kaydı** izni verip Sentio'yu yeniden açmalıdır. Yeni sürümler indirme sayfasından elle kurulur.
  - **Linux x64:** [AppImage](https://github.com/SonerKeser/Sentio/releases/latest/download/Sentio-Masaustu-linux-x64.AppImage). `chmod +x Sentio-Masaustu-linux-x64.AppImage` ile çalıştırılabilir yapıp açın; ek paket gerekmez ve kendini günceller. Sistem tepsisi simgesi için GNOME'da AppIndicator desteği gerekir (Ubuntu'da hazır gelir).
- **Çevrimdışı dağıtım:** Kurulum dosyalarını sunucunun `indirmeler` klasörüne koyun; öğrenciler sunucunun ana sayfasından indirir.

## 6. Yedekleme ve güncelleme

Yönetici hesabıyla **Ayarlar → Sunucu → Yedek indir** düğmesi, sunucu çalışırken tutarlı bir SQLite kopyası indirir (`/api/yonetim/yedek`). Geri yüklemek için sunucuyu durdurup `veri/sentio.db` dosyasını yedekle değiştirin. Alternatif olarak sunucuyu durdurup `veri` klasörünü kopyalamak da yeterlidir. Yeni sürümde paket içeriğini aynı klasöre açın (`veri` ve `appsettings.json` korunur); veritabanı göçleri açılışta kendiliğinden uygulanır.

### Sezgi 1.x'ten yükseltme

Sentio, 1.2 sürümüne kadar Sezgi adını taşıyordu. Yükseltmede veriler korunur:

- **Veritabanı:** yeni sunucu ilk açılışta veri klasöründeki `sezgi.db` dosyasını `sentio.db` olarak yeniden adlandırır.
- **Ayarlar:** `appsettings.json` içindeki `Sezgi` bölümü ve `Sezgi__...` ortam değişkenleri okunmaya devam eder. Yeni ayarlarda `Sentio` adını kullanın.
- **Program adı:** `Sezgi.Sunucu` artık `Sentio.Sunucu`. Hizmet olarak çalıştırıyorsanız hizmetin gösterdiği yolu güncelleyin:
  - Windows (yönetici PowerShell): `sc.exe config Sezgi binPath= "C:\Sezgi\Sentio.Sunucu.exe"`, ardından `Restart-Service Sezgi`.
  - Linux: `/etc/systemd/system/sezgi.service` dosyasındaki `ExecStart` satırını `/opt/sezgi/Sentio.Sunucu` yapın, ardından `sudo systemctl daemon-reload && sudo systemctl restart sezgi`.
- **Docker:** hacmin adı `sentio-veri` oldu. Eski verileri yeni hacme kopyalayın (hacim adlarını `docker volume ls` ile doğrulayın):

  ```bash
  docker compose down && git pull
  docker volume create sezgi_sentio-veri
  docker run --rm -v sezgi_sezgi-veri:/eski -v sezgi_sentio-veri:/yeni alpine cp -a /eski/. /yeni/
  docker compose up -d --build
  ```

- **Masaüstü:** Sentio'yu kurun; seçtiğiniz sunucu korunur. Windows'ta Uygulamalar listesinde eski Sezgi girdisi kalırsa kaldırın.

## 7. Geliştirme

```bash
# Sunucu (http://localhost:5757)
dotnet run --project src/Sentio.Sunucu

# Web arayüzü, sıcak yeniden yükleme (http://localhost:5173, API isteklerini 5757'ye yönlendirir)
cd web && npm install && npm run dev

# Testler
dotnet test && (cd web && npm test)

# Masaüstü
cd masaustu && npm install && npm run basla

# Sürüm paketleri (Windows)
pwsh betikler/paketle.ps1
```
