<p align="center">
  <img src="web/public/favicon.svg" width="72" alt="" />
</p>

<h1 align="center">Sezgi</h1>

<p align="center">
  <strong>Ekranın öbür ucundaki sınıfı hissedin.</strong><br />
  Çevrim içi derslerde öğrencilerin yüz ifadesini ve dikkatini kendi cihazlarında çözümleyen,<br />
  öğretmene yalnızca sınıfın nabzını gönderen açık kaynaklı sınıf analitiği.
</p>

<p align="center">
  <a href="https://sonerkeser.github.io/Sezgi/">Tanıtım ve indirme sayfası</a> ·
  <a href="https://github.com/SonerKeser/Sezgi/releases/latest">Son sürüm</a> ·
  <a href="docs/KURULUM.md">Kurulum</a> ·
  <a href="docs/MIMARI.md">Mimari</a> ·
  <a href="docs/GIZLILIK.md">Gizlilik ve etik</a>
</p>

<p align="center">
  <a href="https://github.com/SonerKeser/Sezgi/actions/workflows/ci.yml"><img src="https://github.com/SonerKeser/Sezgi/actions/workflows/ci.yml/badge.svg" alt="Sürekli tümleştirme" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-FFC94A" alt="MIT lisansı" /></a>
  <img src="https://img.shields.io/badge/.NET-10-A784FF" alt=".NET 10" />
  <img src="https://img.shields.io/badge/React-19-5AA9FF" alt="React 19" />
</p>

![Sezgi tanıtım sayfası](docs/gorseller/tanitim.jpg)

## Nedir?

Video konferansla verilen derste öğretmen, küçük kamera karelerinden kimin zorlandığını, kimin koptuğunu göremez. Sezgi bu boşluğu doldurur:

- Öğrenci derse **altı karakterlik bir kodla** tarayıcıdan ya da Sezgi Masaüstü uygulamasından katılır ve açık rıza verir.
- Kamerası **kendi cihazında** çözümlenir: yüz bulma, 468 noktalı yüz ağı, iris ve yedi sınıflı ifade modeli tarayıcıda, ekran kartında çalışır. **Görüntü hiçbir yere gönderilmez.**
- Öğretmenin paneline saniyede bir yalnızca sayılar akar. Sezgi kısa dalgalanmaları süzer; bir öğrencinin ifadesi belirlenen süre boyunca olumsuz kalırsa, dikkati dağılırsa, yorgun görünürse ya da sınıfın büyük kısmı zorlanıyorsa **uyarı** düşer ve öğrenciye nazik bir **destek bildirimi** gider.
- Ders bitince **ısı haritası**, öne çıkan anlar ve öğrenci özetleriyle bir **rapor** hazırdır; Excel ve CSV olarak indirilir.

Bu proje, eski bir akademik denemenin ([EmotionDedect](docs/ESKI-SISTEM-ANALIZI.md)) fikrini sıfırdan, çalışan ve gizliliği önceleyen bir sisteme dönüştürür.

## Ekran görüntüleri

| Canlı öğretmen paneli | Öğrenci ekranı |
| --- | --- |
| ![Canlı panel](docs/gorseller/panel.jpg) | ![Öğrenci ekranı](docs/gorseller/ogrenci-ders.jpg) |
| **Ders raporu** | **Destek bildirimi** |
| ![Rapor](docs/gorseller/rapor.jpg) | ![Destek bildirimi](docs/gorseller/ogrenci-bildirim.jpg) |
| **Öğrenci × zaman ısı haritası** | **Açık rıza** |
| ![Isı haritası](docs/gorseller/rapor-isi-haritasi.jpg) | ![Açık rıza ekranı](docs/gorseller/ogrenci-riza.jpg) |

## Öne çıkanlar

- **Gizlilik tasarımın merkezinde:** görüntü cihazdan çıkmaz, yüz tanıma yapılmaz, açık rıza ekranı, öğrencinin istediği an duraklatabilmesi, anonim mod, otomatik veri silme.
- **Zamana dayalı kural motoru:** üstel yumuşatma, kopma toleransı, kalıcılık eşiği ve bekleme süresi; öğrenci ve sınıf geneli kurallar. Ayarlar ders sürerken değiştirilebilir.
- **Galeri analizi:** öğrenciler hiçbir şey kuramıyorsa Zoom, Meet ya da Teams penceresini paylaşın; galerideki yüzler döşemeli taramayla bulunur, galeri düzeni değişse de izlenir.
- **Sanal sınıf:** öğrenci olmadan paneli denemek ve tanıtmak için mizaç sahibi sanal öğrenciler; ölçümleri gerçek öğrencilerle aynı hattan geçer.
- **Kendi kendine yeten sunucu:** tek dosya, kurulum yok, internet gerekmez; modeller ve arayüz içinde. Yerel ağda kendini duyurur, masaüstü uygulaması onu kendiliğinden bulur.
- **Canlı ve hareketli arayüz:** her öğrencinin ifadesini yansıtan animasyonlu maskot, duygu tayfıyla renklenen grafikler, karekodlu davet.

## Hızlı başlangıç

1. **Sunucuyu indirin:** [Windows](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-win-x64.zip) · [Linux x64](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-linux-x64.tar.gz) · [Linux ARM64](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-linux-arm64.tar.gz) · [Docker](docs/KURULUM.md#docker)
2. `Sezgi.Sunucu` dosyasını çalıştırın; `http://localhost:5757/panel` açılır. İlk yönetici hesabını oluşturun.
3. **Yeni ders başlatın.** Öğrencilerle kodu ya da karekodu paylaşın.
4. Öğrenciler `http://sunucu-adresi:5757/katil` sayfasından ya da [Sezgi Masaüstü](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-Kurulum.exe) ile katılır.

Öğrenciniz yok mu? Dersi açın ve **Sanal sınıf** düğmesiyle 8–32 sanal öğrenci ekleyin.

> Tarayıcılar kamerayı yalnızca https ya da localhost üzerinde açar. Yerel ağda https yoksa Sezgi Masaüstü bu kısıtı yalnızca sizin sunucunuz için kaldırır. Ayrıntılar: [Kurulum › https](docs/KURULUM.md#3-https).

## Bileşenler

| Bileşen | Teknoloji | İndir |
| --- | --- | --- |
| **Sunucu** | .NET 10, ASP.NET Core minimal API, SignalR, EF Core + SQLite, ClosedXML | [Windows x64](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-win-x64.zip), [Linux x64](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-linux-x64.tar.gz), [Linux ARM64](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Sunucu-linux-arm64.tar.gz) |
| **Web istemcisi** (öğretmen paneli, öğrenci, tanıtım) | React 19, Vite 7, Tailwind CSS 4, Motion, Recharts, Human (TensorFlow.js) | Sunucuyla birlikte gelir |
| **Masaüstü** (öğrenci ve öğretmen) | Electron 45 | [Kurulum](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-Kurulum.exe), [taşınabilir](https://github.com/SonerKeser/Sezgi/releases/latest/download/Sezgi-Masaustu-Tasinabilir.exe) |

## Nasıl çalışır?

Öğrencinin bir saniyede gönderdiği her şey:

```json
{ "d": [0.62, 0.21, 0.08, 0.04, 0.01, 0.03, 0.01], "dikkat": 0.86, "goz": 0.93, "yuz": true }
```

`d`: nötr, mutlu, şaşkın, üzgün, öfkeli, kaygılı, hoşnutsuz olasılıkları. Sunucu bu ölçümleri yumuşatır, kurallardan geçirir, saklar ve öğretmene saniyelik anlık görüntü olarak yayınlar. Ayrıntılı akış, kurallar, protokol ve veri modeli için: [docs/MIMARI.md](docs/MIMARI.md).

## Proje yapısı

```
src/Sezgi.Sunucu/          .NET 10 sunucu (API, SignalR, kural motoru, raporlar)
tests/Sezgi.Sunucu.Testleri xUnit: kural motoru, rapor, uçtan uca SignalR akışı
web/                       React arayüzü; derlemesi sunucunun wwwroot klasörüne çıkar
masaustu/                  Electron masaüstü istemcisi
betikler/                  Sürüm paketleme
docs/                      Kurulum, mimari, gizlilik, eski sistem analizi
```

## Geliştirme

```bash
dotnet run --project src/Sezgi.Sunucu        # http://localhost:5757
cd web && npm install && npm run dev          # http://localhost:5173 (API'yi 5757'ye yönlendirir)
dotnet test && (cd web && npm test)           # sunucu ve analiz testleri
cd masaustu && npm install && npm run basla   # masaüstü istemcisi
pwsh betikler/paketle.ps1                     # sürüm paketleri
```

## Sorumlu kullanım

Yüz ifadesi iç duygunun kesin göstergesi değildir; Sezgi bir notlandırma ya da değerlendirme aracı değildir. Kullanmadan önce öğrencileri (reşit değillerse velilerini) bilgilendirip açık rıza alın. AB Yapay Zekâ Yasası, eğitim kurumlarında duygu çıkarımı yapan sistemleri tıbbi ve güvenlik amaçları dışında yasaklar. Ayrıntılar ve örnek aydınlatma metni: [docs/GIZLILIK.md](docs/GIZLILIK.md).

## Lisans

[MIT](LICENSE) © 2026 Soner Keser. Yüz analizi [Human](https://github.com/vladmandic/human) kütüphanesiyle (MIT) yapılır; kullanılan modellerin lisansları için Human deposuna bakın.
