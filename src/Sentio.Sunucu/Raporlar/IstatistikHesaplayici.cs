using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Sentio.Sunucu.Hizmetler;
using Sentio.Sunucu.Veri;

namespace Sentio.Sunucu.Raporlar;

/// <summary>
/// Biten bir dersin özetini (sınıf ve öğrenci düzeyinde) hesaplayıp saklar. Dönem analitiği bu özetlerden
/// beslenir; böylece onlarca dersin ham ölçümleri her seferinde taranmaz.
/// </summary>
public sealed class IstatistikHesaplayici(SentioVeritabani db)
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public async Task KaydetAsync(Guid oturumId, CancellationToken iptal)
    {
        var sonuc = await new RaporOlusturucu(db).OlusturAsync(oturumId, null, iptal);
        if (sonuc is null) return;
        var (oturumIst, katilimciIst) = Donustur(sonuc.Value.Rapor);

        await db.KatilimciIstatistikleri.Where(k => k.OturumId == oturumId).ExecuteDeleteAsync(iptal);
        await db.OturumIstatistikleri.Where(o => o.OturumId == oturumId).ExecuteDeleteAsync(iptal);
        db.OturumIstatistikleri.Add(oturumIst);
        db.KatilimciIstatistikleri.AddRange(katilimciIst);
        await db.SaveChangesAsync(iptal);
    }

    public static (OturumIstatistigi Oturum, List<KatilimciIstatistigi> Katilimcilar) Donustur(Rapor rapor)
    {
        var e = rapor.Etkilesim;
        var dilimler = rapor.Zaman.Dilimler.Where(d => d.Aktif > 0).ToList();
        var oturum = new OturumIstatistigi
        {
            OturumId = rapor.Oturum.Id,
            KatilimciSayisi = rapor.Sinif.KatilimciSayisi,
            OkumaSayisi = rapor.Sinif.OkumaSayisi,
            SureSn = rapor.Oturum.SureSn,
            Dikkat = rapor.Sinif.Dikkat,
            Katilim = rapor.Sinif.Katilim,
            Valans = rapor.Sinif.Valans,
            OlumsuzOran = dilimler.Count > 0 ? MathF.Round(dilimler.Average(d => d.OlumsuzOran), 3) : 0f,
            YuzOrani = rapor.Sinif.YuzOrani,
            Dagilim = [.. rapor.Sinif.Dagilim],
            AnlamaOrani = e.AnlamaOrani,
            YoklamaSayisi = e.Yoklamalar.Count,
            UyariSayisi = rapor.Sinif.UyariSayisi,
            AnlamadimSayisi = e.Anlamadim,
            SoruSayisi = e.Soru,
        };

        var katilimcilar = rapor.Katilimcilar
            .Where(k => k.Ad != OturumYoneticisi.SilinmisAd)
            .Select(k => new KatilimciIstatistigi
            {
                KatilimciId = k.Id,
                OturumId = rapor.Oturum.Id,
                Ad = k.Ad,
                AdAnahtari = rapor.Oturum.Anonim ? null : AdAnahtari(k.Ad),
                Kaynak = k.Kaynak,
                Dikkat = k.Dikkat,
                Katilim = k.Katilim,
                Valans = k.Valans,
                YuzOrani = k.YuzOrani,
                Baskin = k.Baskin,
                OkumaSayisi = k.OkumaSayisi,
                UyariSayisi = k.UyariSayisi,
                AnlamadimSayisi = k.AnlamadimSayisi,
            })
            .ToList();
        return (oturum, katilimcilar);
    }

    /// <summary>"  ayşe   YILMAZ " ile "Ayşe Yılmaz" aynı öğrenci sayılır (Türkçe büyük/küçük harf kurallarıyla).</summary>
    public static string AdAnahtari(string ad) => Metin.Ad(ad, 80).ToLower(Tr);
}
