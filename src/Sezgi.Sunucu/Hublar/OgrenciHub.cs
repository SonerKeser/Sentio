using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Guvenlik;
using Sezgi.Sunucu.Hizmetler;

namespace Sezgi.Sunucu.Hublar;

[Authorize(Policy = Yetki.Katilimci)]
public sealed class OgrenciHub(CanliOturumDeposu depo, OlcumIsleyici isleyici, OturumYoneticisi yonetici) : Hub
{
    public static string OturumGrubu(Guid oturumId) => $"s:{oturumId:N}";

    public static string KatilimciGrubu(Guid katilimciId) => $"k:{katilimciId:N}";

    public override async Task OnConnectedAsync()
    {
        var (oturum, katilimci) = Kimlik();
        await Groups.AddToGroupAsync(Context.ConnectionId, OturumGrubu(oturum.Id));
        await Groups.AddToGroupAsync(Context.ConnectionId, KatilimciGrubu(katilimci.Id));
        lock (katilimci.Kilit) katilimci.BaglantiSayisi++;
        await Clients.Caller.SendAsync("Ayarlar", OturumYoneticisi.OgrenciAyarlari(oturum.Ayarlar));
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (Bul() is { } k)
        {
            lock (k.Katilimci.Kilit) k.Katilimci.BaglantiSayisi = Math.Max(0, k.Katilimci.BaglantiSayisi - 1);
        }
        return base.OnDisconnectedAsync(exception);
    }

    public Task Okuma(OkumaGirdisi girdi)
    {
        var (oturum, katilimci) = Kimlik();
        return isleyici.IsleAsync(oturum, katilimci, girdi);
    }

    /// <summary>Öğrenci analizi istediği an duraklatabilir; duraklatılmışken hiçbir ölçüm işlenmez.</summary>
    public void Duraklat(bool duraklat)
    {
        var (_, katilimci) = Kimlik();
        lock (katilimci.Kilit)
        {
            katilimci.Duraklatildi = duraklat;
            katilimci.Kural.Sifirla();
        }
    }

    public Task Ayril()
    {
        var (oturum, katilimci) = Kimlik();
        return yonetici.KatilimciAyrildiAsync(oturum, katilimci);
    }

    private (CanliOturum Oturum, CanliKatilimci Katilimci) Kimlik() =>
        Bul() ?? throw new HubException("Oturum sona ermiş ya da katılım geçersiz.");

    private (CanliOturum Oturum, CanliKatilimci Katilimci)? Bul()
    {
        var ozet = Context.User?.FindFirst(Yetki.JetonOzetiTalebi)?.Value;
        return ozet is null ? null : depo.JetonaGoreBul(ozet);
    }
}
