using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Canli;

/// <summary>Ölçümleri kuyruğa alır ve veritabanına toplu halde yazar; istek yolunu disk gecikmesinden ayırır.</summary>
public sealed class OkumaYazici(IDbContextFactory<SezgiVeritabani> fabrika, ILogger<OkumaYazici> gunluk) : BackgroundService
{
    private const int GrupBoyutu = 2000;

    private readonly Channel<Okuma> _kuyruk = Channel.CreateBounded<Okuma>(new BoundedChannelOptions(200_000)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
    });

    public void Ekle(Okuma okuma) => _kuyruk.Writer.TryWrite(okuma);

    protected override async Task ExecuteAsync(CancellationToken iptal)
    {
        var grup = new List<Okuma>(GrupBoyutu);
        try
        {
            while (await _kuyruk.Reader.WaitToReadAsync(iptal))
            {
                // Küçük bir bekleme, saniyelik ölçümlerin tek işlemde yazılmasını sağlar.
                await Task.Delay(750, iptal);
                while (grup.Count < GrupBoyutu && _kuyruk.Reader.TryRead(out var okuma)) grup.Add(okuma);
                await YazAsync(grup, iptal);
            }
        }
        catch (OperationCanceledException)
        {
        }

        // Kapanışta kalanları boşalt.
        while (_kuyruk.Reader.TryRead(out var okuma)) grup.Add(okuma);
        await YazAsync(grup, CancellationToken.None);
    }

    private async Task YazAsync(List<Okuma> grup, CancellationToken iptal)
    {
        if (grup.Count == 0) return;
        try
        {
            await using var db = await fabrika.CreateDbContextAsync(iptal);
            db.ChangeTracker.AutoDetectChangesEnabled = false;
            db.Okumalar.AddRange(grup);
            await db.SaveChangesAsync(iptal);
        }
        catch (DbUpdateException ex)
        {
            // Oturum bu arada silindiyse yabancı anahtar hatası beklenir; ölçümler önemsizdir.
            gunluk.LogWarning(ex, "{Adet} ölçüm yazılamadı.", grup.Count);
        }
        finally
        {
            grup.Clear();
        }
    }
}
