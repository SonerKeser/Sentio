# Eski sistemin analizi: EmotionDedect

Sentio, daha önce akademik bir proje için geliştirilmeye çalışılan **EmotionDedect** adlı sistemin yeniden ele alınmış halidir. Bu belge eski sistemin ne yapmaya çalıştığını, nasıl çalıştığını, nerede tıkandığını ve Sentio'da her sorunun nasıl çözüldüğünü özetler.

## Amaç

Çevrim içi derste öğretmen, ekranındaki küçük kamera karelerinden öğrencilerin derse nasıl tepki verdiğini izleyemez. Eski sistemin hedefi:

1. Ders sırasında öğrencilerin yüz ifadesini düzenli aralıklarla ölçmek,
2. Ölçümleri öğrenci × zaman tablosu halinde kaydetmek (Excel),
3. Bir öğrencinin aynı ifadesi art arda belirli sayıda tekrarlanırsa o öğrenciye, ifadesine uygun hareketli bir görselle geri bildirim göstermekti.

## Bileşenler

| Bileşen | Teknoloji | Görev |
| --- | --- | --- |
| `EmotionDedectTeacherApp` | .NET Framework 4.7.2 konsol + Python betiği (`main.py`) | Python'u ve 8 kütüphaneyi denetleyip `pip` ile kurar, ders ayarlarını konsoldan sorar, betiği başlatır. Betik belirli aralıklarla **öğretmenin tüm ekranının** görüntüsünü alır, yüzleri bulur, `faces/` klasöründeki fotoğraflarla **yüz tanıma** yaparak kişiyi belirler, DeepFace ile ifadeyi sınıflar, sonucu Excel'e yazar, tekrar eden ifadeyi WebSocket'e gönderir. |
| `EmotionDedectWebSocketServer` | .NET Framework 4.7.2 konsol, websocket-sharp | `wss://` üzerinden öğretmen ile öğrencileri eşleştirip mesajları iletir. |
| `EmotionDedectStudentApp` | WinForms, Telerik UI (ticari), websocket-sharp | Sunucuya bağlanır, simge durumunda bekler; mesaj gelince öne çıkıp ilgili duygunun GIF'ini 5 saniye gösterir ve yeniden simge durumuna küçülür. |

## Akış

```
Öğretmen ekranı ──(ekran görüntüsü, 60 sn'de bir)──> Python: yüz bul → yüz tanı → DeepFace ifade
                                                        │
                                                        ├─> result.xlsx (öğrenci × zaman)
                                                        └─> "ad|ifade N defa tekrarlandi" ──> WebSocket sunucusu ──> Öğrenci uygulaması (GIF)
```

## Tespit edilen sorunlar

### Çalışmayı engelleyen hatalar

- **Protokol uyuşmazlığı.** Öğretmen betiği kendini `Identify|Teacher` diye tanıtıyor, sunucu ise `Identity` kelimesini arıyor; öğretmen hiçbir zaman kaydolmuyor. Betiğin gönderdiği `ad|mesaj` biçimi de sunucunun beklediği `Send|hedef|mesaj` biçimine uymuyor. Sonuç olarak hiçbir geri bildirim öğrenciye ulaşamıyor.
- **Öğrenci adı alınmıyor.** WinForms uygulaması kullanıcı adını metin kutusundan değil `Console.ReadLine()` ile okuyor; masaüstü uygulamasında konsol olmadığından ad boş gidiyor.
- **Yanlış yüzün ifadesi.** `DeepFace.analyze` her yüz için yüz kırpıntısına değil bütün ekran görüntüsüne uygulanıyor; tanınan her öğrenciye ekrandaki ilk yüzün ifadesi yazılıyor.
- **Kırılgan yükleme.** Referans fotoğrafta yüz bulunamazsa `face_encodings(...)[0]` çöküyor. Ekran görüntüsü %25'e küçültüldüğü için galeri görünümündeki küçük yüzler kayboluyor.
- **Eksik paket.** Öğrenci uygulamasının dağıtım arşivinde 10 GIF'ten yalnızca 3'ü var; diğer duygular için uygulama hata veriyor.
- **Veri kaybı.** Excel dosyası yalnızca ders sonunda kaydediliyor; betik yarıda çökerse bütün ölçümler kayboluyor.

### Güvenlik

- Sunucu adresi, kullanıcı adı ve parola üç ayrı uygulamada **kaynak koda gömülü** (Basic kimlik doğrulama, herkes için tek ortak parola).
- TLS sertifikası **özel anahtarıyla birlikte** depoda; sertifika parolası da kodda.
- TLS 1.0 ve 1.1 açık; çapraz iş parçacığı denetimi kapatılmış (`CheckForIllegalCrossThreadCalls = false`); paylaşılan sözlük kilitsiz.
- Öğretmen uygulaması çalışma anında `pip install` ile internetten paket kuruyor.

### Gizlilik ve etik

- Öğrencilerin yüz fotoğrafları bir klasörde tutuluyor ve **biyometrik yüz tanıma** yapılıyor (KVKK'da özel nitelikli kişisel veri).
- İşlenen her ekran görüntüsü, yüzlerin üzerine ad ve ifade yazılarak diske kaydediliyor.
- Öğrenciden rıza alınmıyor, öğrenci analizi durduramıyor, saklama süresi yok.

### Kullanılabilirlik ve bakım

- Öğretmen arayüzü bir konsol penceresi; canlı görünüm, geçmiş ya da rapor yok.
- Ağır bağımlılıklar: TensorFlow, dlib (Windows'ta derleme araçları ister), DeepFace; 25 MB'lık ticari Telerik kütüphanesi.
- Tekrar algılama, Excel hücrelerinin üzerinde satır satır gezinerek yapılıyor; gürültüye karşı yumuşatma yok, tek bir yanlış kare sayacı sıfırlıyor.
- GIF'ler üçüncü taraf çıkartmalar (lisans durumu belirsiz).

## Sentio'daki karşılıkları

| Eski sistem | Sentio |
| --- | --- |
| Öğretmenin ekran görüntüsü + yüz tanıma | **Öğrenci cihazında analiz**: öğrenci kodla katılır, kimlik oturumdan gelir; yüz tanımaya gerek kalmaz. Ekran yöntemi isteğe bağlı **galeri analizi** olarak korunur, ama sunucuya görüntü gitmez ve yüz tanımlayıcıları yalnızca tarayıcı belleğinde tutulur. |
| Python + TensorFlow + dlib kurulumu | Tarayıcıda/Electron'da WebGL ile çalışan Human (TensorFlow.js) modelleri; modeller sunucuyla birlikte gelir, kurulum ve internet gerekmez. |
| Tüm ekrandan tek ifade | Yüz başına ifade olasılıkları (7 sınıf), baş yönü ve bakıştan dikkat, göz açıklığından yorgunluk. |
| "Art arda N kez" sayacı | Zamana dayalı kural motoru: üstel yumuşatma, kısa kopma toleransı, kalıcılık eşiği, bekleme süresi; sınıf geneli kurallar. |
| Excel (ders sonunda) | SQLite'a sürekli toplu yazım; canlı panel, rapor sayfası, renklendirilmiş Excel ve CSV. |
| Ortak parola, kodda sırlar | Öğretmen hesapları (parola özeti), çerez oturumu, öğrenci başına 256 bit katılım jetonu (yalnızca özeti saklanır), hız sınırlama, depoda hiçbir sır yok. |
| Konsol öğretmen uygulaması | Canlı öğretmen paneli, rapor, ayarlar, karekodlu davet. |
| WinForms + GIF | Web öğrenci istemcisi + Electron masaüstü uygulaması; özgün, ifadesini değiştiren animasyonlu maskot; destekleyici mesajlar. |
| Rıza, saklama yok | Açık rıza ekranı, öğrencinin duraklatabilmesi, anonim mod, otomatik silme (varsayılan 180 gün). |
| Çalışmayan protokol | Tipli SignalR merkezleri, uçtan uca testlerle doğrulanmış akış. |
