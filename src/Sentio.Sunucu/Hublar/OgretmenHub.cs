using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Canli;
using Sentio.Sunucu.Guvenlik;
using Sentio.Sunucu.Hizmetler;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Hublar;

[Authorize(Policy = Yetki.Ogretmen)]
public sealed class OgretmenHub(
    CanliOturumDeposu depo,
    OlcumIsleyici isleyici,
    OturumYoneticisi yonetici,
    EtkilesimYoneticisi etkilesim,
    IDbContextFactory<SentioVeritabani> fabrika) : Hub
{
    private const string IzlenenlerAnahtari = "izlenen";
    private const int EnFazlaGaleriYuzu = 60;

    public static string Grup(Guid oturumId) => $"o:{oturumId:N}";

    public async Task<IzlemeBaslangici> Izle(Guid oturumId)
    {
        var oturum = YetkiliOturum(oturumId);
        if (Izlenenler().Add(oturumId))
        {
            Interlocked.Increment(ref oturum.Izleyici);
            await Groups.AddToGroupAsync(Context.ConnectionId, Grup(oturumId));
        }
        var anlik = CanliYayinci.Olustur(oturum, isleyici.SimdiMs, etkilesim);
        return new IzlemeBaslangici(yonetici.Detay(oturum), anlik, oturum.SonUyarilar());
    }

    public async Task Birak(Guid oturumId)
    {
        if (!Izlenenler().Remove(oturumId)) return;
        if (depo.Bul(oturumId) is { } oturum) Interlocked.Decrement(ref oturum.Izleyici);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, Grup(oturumId));
    }

    public async Task MesajGonder(Guid oturumId, Guid? katilimciId, string metin)
    {
        var oturum = YetkiliOturum(oturumId);
        metin = (metin ?? "").Trim();
        if (metin.Length is 0 or > 280) throw new HubException("Mesaj 1-280 karakter olmalı.");

        CanliKatilimci? katilimci = null;
        if (katilimciId is { } kid && !oturum.Katilimcilar.TryGetValue(kid, out katilimci))
        {
            throw new HubException("Katılımcı bulunamadı.");
        }
        if (katilimci is { Kaynak: not KatilimciKaynagi.Kamera })
        {
            throw new HubException("Bu katılımcıya mesaj gönderilemez; Sentio istemcisiyle bağlı değil.");
        }
        await isleyici.OgretmenMesajiAsync(oturum, katilimci, metin);
    }

    // Etkileşim: yoklama, söz istekleri, bölümler ve mola

    public async Task<YoklamaDurumu> YoklamaBaslat(Guid oturumId, YoklamaIstegi istek)
    {
        var oturum = YetkiliOturum(oturumId);
        if (oturum.MoladaMi) throw new HubException("Molada yoklama başlatılamaz.");
        return await etkilesim.YoklamaBaslatAsync(oturum, istek.Tur, istek.Soru, istek.Secenekler)
               ?? throw new HubException("Yoklama sorusu ya da seçenekleri geçersiz.");
    }

    public Task YoklamaKapat(Guid oturumId) => etkilesim.YoklamaKapatAsync(YetkiliOturum(oturumId));

    public Task SinyalYanitla(Guid oturumId, long sinyalId) => etkilesim.SinyalYanitlaAsync(YetkiliOturum(oturumId), sinyalId);

    public Task SinyalleriTemizle(Guid oturumId, SinyalTuru tur) => etkilesim.SinyalleriTemizleAsync(YetkiliOturum(oturumId), tur);

    public async Task<BolumDurumu> BolumBaslat(Guid oturumId, string ad) =>
        await etkilesim.BolumBaslatAsync(YetkiliOturum(oturumId), ad) ?? throw new HubException("Bölüm adı girin.");

    public Task<BolumDurumu> MolaBaslat(Guid oturumId, int dakika) => etkilesim.MolaBaslatAsync(YetkiliOturum(oturumId), dakika);

    public Task MolaBitir(Guid oturumId) => etkilesim.MolaBitirAsync(YetkiliOturum(oturumId));

    /// <summary>Öğretmen tarayıcısında yapılan galeri (ekran paylaşımı) analizinin ölçümleri.</summary>
    public async Task GaleriOkumalari(Guid oturumId, GaleriOkumasi[] okumalar)
    {
        var oturum = YetkiliOturum(oturumId);
        foreach (var o in okumalar.Take(EnFazlaGaleriYuzu))
        {
            if (string.IsNullOrWhiteSpace(o.IzKimligi) || o.IzKimligi.Length > 64) continue;
            var katilimci = await GaleriKatilimcisiAsync(oturum, o.IzKimligi, o.Ad);
            await isleyici.IsleAsync(oturum, katilimci, o.Okuma);
        }
    }

    public async Task GaleriAdDegistir(Guid oturumId, string izKimligi, string ad)
    {
        var oturum = YetkiliOturum(oturumId);
        ad = Metin.Ad(ad);
        if (ad.Length == 0 || !oturum.GaleriIzleri.TryGetValue(izKimligi, out var id)) return;
        if (!oturum.Katilimcilar.TryGetValue(id, out var katilimci)) return;
        lock (katilimci.Kilit) katilimci.Ad = ad;
        await using var db = await fabrika.CreateDbContextAsync();
        await db.Katilimcilar.Where(k => k.Id == id).ExecuteUpdateAsync(s => s.SetProperty(k => k.Ad, ad));
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var id in Izlenenler())
        {
            if (depo.Bul(id) is { } oturum) Interlocked.Decrement(ref oturum.Izleyici);
        }
        Izlenenler().Clear();
        return base.OnDisconnectedAsync(exception);
    }

    private async Task<CanliKatilimci> GaleriKatilimcisiAsync(CanliOturum oturum, string izKimligi, string ad)
    {
        if (oturum.GaleriIzleri.TryGetValue(izKimligi, out var id) && oturum.Katilimcilar.TryGetValue(id, out var mevcut))
        {
            return mevcut;
        }

        var katilimci = new Katilimci
        {
            OturumId = oturum.Id,
            Ad = Metin.Ad(ad) is { Length: > 0 } temiz ? temiz : "Galeri yüzü",
            SiraNo = oturum.SonrakiSiraNo(),
            Kaynak = KatilimciKaynagi.Galeri,
            DisKimlik = izKimligi,
        };
        await using (var db = await fabrika.CreateDbContextAsync())
        {
            db.Katilimcilar.Add(katilimci);
            await db.SaveChangesAsync();
        }
        return depo.KatilimciEkle(oturum, katilimci);
    }

    private CanliOturum YetkiliOturum(Guid oturumId)
    {
        var oturum = depo.Bul(oturumId) ?? throw new HubException("Oturum canlı değil.");
        var kullanici = Context.User!;
        if (oturum.OgretmenId != kullanici.OgretmenId() && !kullanici.YoneticiMi())
        {
            throw new HubException("Bu oturuma erişim yetkiniz yok.");
        }
        return oturum;
    }

    private HashSet<Guid> Izlenenler()
    {
        if (Context.Items.TryGetValue(IzlenenlerAnahtari, out var deger) && deger is HashSet<Guid> kume) return kume;
        var yeni = new HashSet<Guid>();
        Context.Items[IzlenenlerAnahtari] = yeni;
        return yeni;
    }
}
