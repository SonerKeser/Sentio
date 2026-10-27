using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Sezgi.Sunucu.Alan;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Hizmetler;

/// <summary>
/// Gerçek bir sınıf olmadan paneli denemek için sanal öğrenciler üretir. Her sanal öğrencinin bir mizacı vardır;
/// zaman zaman olumsuz, dağınık, uykulu ya da kameradan uzak dönemlere girer. Arada bir sınıfın yarısını etkileyen
/// "zor konu" anları yaşanır. Ölçümler gerçek öğrencilerle aynı hattan geçer, yani kurallar ve raporlar da çalışır.
/// </summary>
public sealed class SimulasyonYoneticisi(
    CanliOturumDeposu depo,
    IServiceProvider servisler,
    IDbContextFactory<SezgiVeritabani> fabrika,
    ILogger<SimulasyonYoneticisi> gunluk)
{
    public const int EnFazlaKisi = 40;

    private static readonly string[] Adlar =
    [
        "Ada Yıldız", "Mert Aydın", "Elif Kaya", "Can Demir", "Zeynep Şahin", "Emir Çelik", "Defne Arslan",
        "Kerem Koç", "Ece Kurt", "Arda Öztürk", "Nehir Aksoy", "Yiğit Polat", "Asya Erdem", "Deniz Tekin",
        "Mira Güneş", "Baran Yalçın", "Lina Özdemir", "Efe Kılıç", "Duru Acar", "Kuzey Bulut", "Selin Avcı",
        "Aras Çetin", "İpek Doğan", "Rüzgar Taş", "Eylül Karaca", "Kaan Sezer", "Beren Uçar", "Umut Ateş",
        "Lal Ekinci", "Toprak Önal",
    ];

    private static readonly string[] Sorular =
    [
        "Bu formülü bir daha yazabilir misiniz?",
        "İkinci adımı anlamadım, tekrar eder misiniz?",
        "Bir örnek daha çözebilir miyiz?",
        "Bu konu sınavda çıkacak mı?",
        "Grafikteki eksenler neyi gösteriyor?",
        "Neden bu yöntemi seçtik?",
    ];

    private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _calisanlar = new();

    public bool Calisiyor(Guid oturumId) => _calisanlar.ContainsKey(oturumId);

    public async Task<int> BaslatAsync(Guid oturumId, int kisiSayisi)
    {
        var oturum = depo.Bul(oturumId) ?? throw new InvalidOperationException("Oturum canlı değil.");
        if (Calisiyor(oturumId)) return 0;
        kisiSayisi = Math.Clamp(kisiSayisi, 1, EnFazlaKisi);

        var rastgele = new Random();
        var adlar = Adlar.OrderBy(_ => rastgele.Next()).ToList();
        var kayitlar = Enumerable.Range(0, kisiSayisi).Select(i => new Katilimci
        {
            OturumId = oturumId,
            Ad = i < adlar.Count ? adlar[i] : $"{adlar[i % adlar.Count]} {i / adlar.Count + 1}",
            SiraNo = oturum.SonrakiSiraNo(),
            Kaynak = KatilimciKaynagi.Simulasyon,
        }).ToList();

        await using (var db = await fabrika.CreateDbContextAsync())
        {
            db.Katilimcilar.AddRange(kayitlar);
            await db.SaveChangesAsync();
        }

        var ogrenciler = kayitlar.Select(k => new SanalOgrenci(depo.KatilimciEkle(oturum, k), new Random(rastgele.Next()))).ToList();
        var kaynak = new CancellationTokenSource();
        if (!_calisanlar.TryAdd(oturumId, kaynak))
        {
            kaynak.Dispose();
            return 0;
        }
        _ = Task.Run(() => CalistirAsync(oturum, ogrenciler, kaynak.Token));
        return kisiSayisi;
    }

    public async Task DurdurAsync(Guid oturumId)
    {
        if (!_calisanlar.TryRemove(oturumId, out var kaynak)) return;
        await kaynak.CancelAsync();
        kaynak.Dispose();

        if (depo.Bul(oturumId) is { } oturum)
        {
            foreach (var k in oturum.Katilimcilar.Values.Where(k => k.Kaynak == KatilimciKaynagi.Simulasyon))
            {
                lock (k.Kilit) k.Ayrildi = true;
            }
        }
        await using var db = await fabrika.CreateDbContextAsync();
        await db.Katilimcilar
            .Where(k => k.OturumId == oturumId && k.Kaynak == KatilimciKaynagi.Simulasyon && k.AyrilmaZamani == null)
            .ExecuteUpdateAsync(s => s.SetProperty(k => k.AyrilmaZamani, DateTime.UtcNow));
    }

    private async Task CalistirAsync(CanliOturum oturum, List<SanalOgrenci> ogrenciler, CancellationToken iptal)
    {
        var isleyici = servisler.GetRequiredService<OlcumIsleyici>();
        var etkilesim = servisler.GetRequiredService<EtkilesimYoneticisi>();
        var rastgele = new Random();
        var zorKonuBitis = 0L;
        var sonrakiZorKonu = isleyici.SimdiMs + rastgele.Next(60_000, 120_000);
        Guid? sonYoklama = null;
        var yanitZamanlari = new Dictionary<SanalOgrenci, long>();

        try
        {
            using var zamanlayici = new PeriodicTimer(TimeSpan.FromSeconds(1));
            while (await zamanlayici.WaitForNextTickAsync(iptal))
            {
                var simdi = isleyici.SimdiMs;
                if (oturum.MoladaMi) continue;

                // Yeni yoklama: her sanal öğrenci birkaç saniye içinde, %85 olasılıkla yanıtlar.
                var yoklama = oturum.AktifYoklama;
                if (yoklama?.Id != sonYoklama)
                {
                    sonYoklama = yoklama?.Id;
                    yanitZamanlari.Clear();
                    if (yoklama is not null)
                    {
                        foreach (var o in ogrenciler.Where(o => !o.Yok && rastgele.NextDouble() < 0.85))
                        {
                            yanitZamanlari[o] = simdi + rastgele.Next(2_000, 14_000);
                        }
                    }
                }
                if (yoklama is not null)
                {
                    foreach (var (o, zaman) in yanitZamanlari.Where(x => x.Value <= simdi).ToList())
                    {
                        yanitZamanlari.Remove(o);
                        await etkilesim.YoklamaYanitlaAsync(oturum, o.Katilimci, yoklama.Id, o.Yanitla(yoklama));
                    }
                }

                if (simdi >= sonrakiZorKonu)
                {
                    zorKonuBitis = simdi + rastgele.Next(22_000, 35_000);
                    sonrakiZorKonu = simdi + rastgele.Next(150_000, 240_000);
                    foreach (var o in ogrenciler.Where(_ => rastgele.NextDouble() < 0.55)) o.ZorKonuyaGir(zorKonuBitis);
                }

                var zorKonu = simdi < zorKonuBitis;
                foreach (var ogrenci in ogrenciler)
                {
                    await isleyici.IsleAsync(oturum, ogrenci.Katilimci, ogrenci.Uret(simdi));

                    // Zorlanan öğrenci zaman zaman kendisi de söyler.
                    if (ogrenci.Zorlaniyor && rastgele.NextDouble() < (zorKonu ? 0.05 : 0.015))
                    {
                        await etkilesim.SinyalGonderAsync(oturum, ogrenci.Katilimci, SinyalTuru.Anlamadim, null);
                    }
                    else if (zorKonu && rastgele.NextDouble() < 0.006)
                    {
                        await etkilesim.SinyalGonderAsync(oturum, ogrenci.Katilimci, SinyalTuru.Yavasla, null);
                    }
                }
                if (rastgele.NextDouble() < 0.006)
                {
                    var soran = ogrenciler[rastgele.Next(ogrenciler.Count)];
                    if (!soran.Yok) await etkilesim.SinyalGonderAsync(oturum, soran.Katilimci, SinyalTuru.Soru, Sorular[rastgele.Next(Sorular.Length)]);
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            gunluk.LogError(ex, "Simülasyon durdu: {Oturum}", oturum.Id);
            _calisanlar.TryRemove(oturum.Id, out _);
        }
    }

    private enum Hal { Olagan, Neseli, Olumsuz, Daginik, Uykulu, Yok }

    private sealed class SanalOgrenci(CanliKatilimci katilimci, Random r)
    {
        private readonly float[] _taban = Mizac(r);
        private readonly float _dikkatTaban = 0.62f + (float)r.NextDouble() * 0.3f;
        private Hal _hal = Hal.Olagan;
        private long _halBitis;
        private Duygu _olumsuz = Duygu.Uzgun;

        public CanliKatilimci Katilimci { get; } = katilimci;

        public bool Zorlaniyor => _hal == Hal.Olumsuz;

        public bool Yok => _hal == Hal.Yok;

        /// <summary>Yoklama yanıtı öğrencinin o anki haline göre seçilir; zorlanan öğrenci "Anlamadım"a yakındır.</summary>
        public int Yanitla(CanliYoklama yoklama)
        {
            double[] agirliklar = yoklama.Tur switch
            {
                YoklamaTuru.Anlama => Zorlaniyor ? [0.15, 0.4, 0.45] : [0.7, 0.25, 0.05],
                YoklamaTuru.EvetHayir => Zorlaniyor ? [0.4, 0.6] : [0.75, 0.25],
                YoklamaTuru.Puan => Zorlaniyor ? [0.1, 0.25, 0.35, 0.2, 0.1] : [0.02, 0.05, 0.2, 0.4, 0.33],
                _ => [.. Enumerable.Range(0, yoklama.Secenekler.Length).Select(i => i == 0 ? (Zorlaniyor ? 0.35 : 0.6) : 0.4 / Math.Max(1, yoklama.Secenekler.Length - 1))],
            };
            var zar = r.NextDouble() * agirliklar.Sum();
            for (var i = 0; i < agirliklar.Length; i++)
            {
                if ((zar -= agirliklar[i]) <= 0) return Math.Min(i, yoklama.Secenekler.Length - 1);
            }
            return 0;
        }

        public void ZorKonuyaGir(long bitis)
        {
            _hal = Hal.Olumsuz;
            _olumsuz = r.NextDouble() < 0.6 ? Duygu.Korku : Duygu.Uzgun;
            _halBitis = bitis;
        }

        public OkumaGirdisi Uret(long simdi)
        {
            if (simdi >= _halBitis) YeniHal(simdi);

            var d = new float[Duygular.Sayi];
            for (var i = 0; i < d.Length; i++) d[i] = _taban[i] * (0.6f + (float)r.NextDouble() * 0.8f);

            switch (_hal)
            {
                case Hal.Neseli:
                    d[(int)Duygu.Mutlu] += 0.9f + (float)r.NextDouble() * 0.6f;
                    if (r.NextDouble() < 0.15) d[(int)Duygu.Saskin] += 0.8f;
                    break;
                case Hal.Olumsuz:
                    d[(int)_olumsuz] += 1.1f + (float)r.NextDouble() * 0.8f;
                    break;
            }

            var dikkat = _hal switch
            {
                Hal.Daginik => 0.08f + (float)r.NextDouble() * 0.2f,
                Hal.Uykulu => 0.35f + (float)r.NextDouble() * 0.2f,
                Hal.Neseli => Math.Min(1f, _dikkatTaban + 0.1f),
                _ => _dikkatTaban,
            } + ((float)r.NextDouble() - 0.5f) * 0.12f;

            var goz = _hal == Hal.Uykulu
                ? 0.05f + (float)r.NextDouble() * 0.2f
                : r.NextDouble() < 0.06 ? 0.1f : 0.78f + (float)r.NextDouble() * 0.2f;

            return new OkumaGirdisi(d, Math.Clamp(dikkat, 0f, 1f), goz, _hal != Hal.Yok);
        }

        private void YeniHal(long simdi)
        {
            var zar = r.NextDouble();
            (_hal, var sure) = zar switch
            {
                < 0.66 => (Hal.Olagan, r.Next(25_000, 70_000)),
                < 0.80 => (Hal.Neseli, r.Next(10_000, 25_000)),
                < 0.88 => (Hal.Olumsuz, r.Next(26_000, 50_000)),
                < 0.94 => (Hal.Daginik, r.Next(35_000, 50_000)),
                < 0.97 => (Hal.Uykulu, r.Next(15_000, 25_000)),
                _ => (Hal.Yok, r.Next(50_000, 70_000)),
            };
            if (_hal == Hal.Olumsuz) _olumsuz = Duygular.Olumsuzlar[r.Next(Duygular.Olumsuzlar.Length)];
            _halBitis = simdi + sure;
        }

        private static float[] Mizac(Random r)
        {
            // Çoğunlukla nötr; bazıları daha güler yüzlü, bazıları daha kaygılı.
            var neseli = (float)r.NextDouble();
            return
            [
                0.55f + (float)r.NextDouble() * 0.25f,
                0.06f + neseli * 0.22f,
                0.03f + (float)r.NextDouble() * 0.04f,
                0.04f + (1 - neseli) * 0.06f,
                0.02f,
                0.03f + (1 - neseli) * 0.05f,
                0.015f,
            ];
        }
    }
}
