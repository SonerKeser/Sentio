# Kurulum

## 1. Sunucu

### Windows

1. [Sezgi-Sunucu-win-x64.zip](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-win-x64.zip) dosyasını bir klasöre açın.
2. `Sezgi.Sunucu.exe` dosyasını çalıştırın. Windows Güvenlik Duvarı sorarsa **özel ağlarda** izin verin.
3. Tarayıcıda `http://localhost:5757/panel` açılır; ilk yönetici hesabını oluşturun.

Windows hizmeti olarak çalıştırmak için (yönetici PowerShell):

```powershell
New-Service -Name Sezgi -BinaryPathName "C:\Sezgi\Sezgi.Sunucu.exe" -DisplayName "Sezgi" -StartupType Automatic
Start-Service Sezgi
```

### Linux

```bash
tar -xzf Sezgi-Sunucu-linux-x64.tar.gz
sudo mv Sezgi-Sunucu-linux-x64 /opt/sezgi
sudo useradd --system --home /opt/sezgi sezgi && sudo chown -R sezgi /opt/sezgi
sudo cp /opt/sezgi/sezgi.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sezgi
```

Raspberry Pi 4/5 için `linux-arm64` paketini kullanın.

### Docker

```bash
git clone https://github.com/SonerKeser/Sezgi.git
cd Sezgi
docker compose up -d
```

Veriler `sezgi-veri` hacminde kalır.

## 2. Ağ ve güvenlik duvarı

| Port | Protokol | Amaç |
| --- | --- | --- |
| 5757 | TCP | Web arayüzü, API, canlı bağlantı |
| 5758 | UDP | Yerel ağ duyurusu (masaüstü uygulaması sunucuyu kendiliğinden bulur). İsteğe bağlı. |

## 3. https

Tarayıcılar kamerayı yalnızca **https** ya da `localhost` üzerinde açar. Seçenekler:

- **Sezgi Masaüstü:** Yerel ağda https olmadan çalışır; okul içi kullanım için en kolay yol.
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
| `Sezgi:VeriKlasoru` | `veri` | SQLite veritabanı ve anahtarlar |
| `Sezgi:VeriSaklamaGun` | `180` | Biten derslerin silinme süresi; `0` kapatır |
| `Sezgi:GenelAdres` | — | Öğrencilere gösterilecek adres (ör. `https://sezgi.okul.edu.tr`) |
| `Sezgi:IndirmeKlasoru` | `indirmeler` | Buraya konan dosyalar ana sayfada "Bu sunucudan indir" olarak listelenir |
| `Sezgi:AgDuyurusu` | `true` | UDP 5758 yerel ağ duyurusu |
| `Sezgi:AcilistaTarayiciAc` | `true` | Windows'ta konsoldan açılınca paneli tarayıcıda açar |

Her ayar ortam değişkeniyle de verilebilir: `Sezgi__VeriSaklamaGun=90`.

## 5. İstemciler

- **Öğrenci (tarayıcı):** `http(s)://sunucu:5757/katil` ya da öğretmenin karekodu.
- **Sezgi Masaüstü:** İlk açılışta ağdaki sunucular listelenir; rol (öğrenci/öğretmen) seçilir. Uygulamalar imzasızdır.
  - **Windows:** [kurulum](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-Kurulum.exe) (kendini günceller) ya da [taşınabilir](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-Tasinabilir.exe). SmartScreen uyarısında "Ek bilgi → Yine de çalıştır" deyin.
  - **macOS 12 ve sonrası:** [Apple Silicon](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-mac-arm64.dmg) ya da [Intel](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-mac-x64.dmg). Sezgi'yi Uygulamalar klasörüne sürükleyin. İlk açılışta macOS uygulamayı engellerse **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç** deyin. Kamera iznini ilk derste uygulama sorar. Öğretmen galeri analizi için **Ekran ve Sistem Sesi Kaydı** izni verip Sezgi'yi yeniden açmalıdır. Yeni sürümler indirme sayfasından elle kurulur.
  - **Linux x64:** [AppImage](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-linux-x64.AppImage). `chmod +x Sezgi-Masaustu-linux-x64.AppImage` ile çalıştırılabilir yapıp açın; ek paket gerekmez ve kendini günceller. Sistem tepsisi simgesi için GNOME'da AppIndicator desteği gerekir (Ubuntu'da hazır gelir).
- **Çevrimdışı dağıtım:** Kurulum dosyalarını sunucunun `indirmeler` klasörüne koyun; öğrenciler sunucunun ana sayfasından indirir.

## 6. Yedekleme ve güncelleme

Yönetici hesabıyla **Ayarlar → Sunucu → Yedek indir** düğmesi, sunucu çalışırken tutarlı bir SQLite kopyası indirir (`/api/yonetim/yedek`). Geri yüklemek için sunucuyu durdurup `veri/sezgi.db` dosyasını yedekle değiştirin. Alternatif olarak sunucuyu durdurup `veri` klasörünü kopyalamak da yeterlidir. Yeni sürümde paket içeriğini aynı klasöre açın (`veri` ve `appsettings.json` korunur); veritabanı göçleri açılışta kendiliğinden uygulanır.

## 7. Geliştirme

```bash
# Sunucu (http://localhost:5757)
dotnet run --project src/Sezgi.Sunucu

# Web arayüzü, sıcak yeniden yükleme (http://localhost:5173, API isteklerini 5757'ye yönlendirir)
cd web && npm install && npm run dev

# Testler
dotnet test && (cd web && npm test)

# Masaüstü
cd masaustu && npm install && npm run basla

# Sürüm paketleri (Windows)
pwsh betikler/paketle.ps1
```
