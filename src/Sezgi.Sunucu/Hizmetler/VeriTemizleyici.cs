using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Hizmetler;

/// <summary>Saklama süresi dolan biten oturumları ve ölçümlerini günde bir kez siler (KVKK: amaçla sınırlı saklama).</summary>
public sealed class VeriTemizleyici(
    IDbContextFactory<SezgiVeritabani> fabrika,
    IOptions<SezgiAyarlari> ayarlar,
    ILogger<VeriTemizleyici> gunluk) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken iptal)
    {
        if (ayarlar.Value.VeriSaklamaGun <= 0) return;
        await Task.Delay(TimeSpan.FromMinutes(1), iptal);
        using var zamanlayici = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                var sinir = DateTime.UtcNow.AddDays(-ayarlar.Value.VeriSaklamaGun);
                await using var db = await fabrika.CreateDbContextAsync(iptal);
                var silinen = await db.Oturumlar
                    .Where(o => o.Durum == OturumDurumu.Bitti && o.BitisZamani < sinir)
                    .ExecuteDeleteAsync(iptal);
                if (silinen > 0) gunluk.LogInformation("Saklama süresi dolan {Adet} oturum silindi.", silinen);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                gunluk.LogError(ex, "Eski veriler temizlenemedi.");
            }
        } while (await zamanlayici.WaitForNextTickAsync(iptal));
    }
}
