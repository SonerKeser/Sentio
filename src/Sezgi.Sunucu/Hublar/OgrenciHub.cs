using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Sezgi.Sunucu.Canli;
using Sezgi.Sunucu.Guvenlik;
using Sezgi.Sunucu.Hizmetler;
using Sezgi.Sunucu.Veri;

namespace Sezgi.Sunucu.Hublar;

[Authorize(Policy = Yetki.Katilimci)]
public sealed class OgrenciHub(CanliOturumDeposu depo, OlcumIsleyici isleyici, OturumYoneticisi yonetici, EtkilesimYoneticisi etkilesim) : Hub
{
    public static string OturumGrubu(Guid oturumId) => $"s:{oturumId:N}";

    public static string KatilimciGrubu(Guid katilimciId) => $"k:{katilimciId:N}";

    public override async Task OnConnectedAsync()
    {
        var (oturum, katilimci) = Kimlik();
        await Groups.AddToGroupAsync(Context.ConnectionId, OturumGrubu(oturum.Id));
        await Groups.AddToGroupAsync(Context.ConnectionId, KatilimciGrubu(katilimci.Id));
        lock (katilimci.Kilit) katilimci.BaglantiSayisi++;
        await Clients.Caller.SendAsync("Durum", etkilesim.OgrenciDurumu(oturum, katilimci));
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

    /// <summary>Öğrenci dersten ayrılır; isterse bu dersteki bütün ölçümleri ve beyanları silinir (silme hakkı).</summary>
    public Task Ayril(bool verileriSil)
    {
        var (oturum, katilimci) = Kimlik();
        return yonetici.KatilimciAyrildiAsync(oturum, katilimci, verileriSil);
    }

    public async Task<bool> Sinyal(SinyalTuru tur, string? metin)
    {
        var (oturum, katilimci) = Kimlik();
        return await etkilesim.SinyalGonderAsync(oturum, katilimci, tur, metin);
    }

    public Task SinyalGeriAl(SinyalTuru tur)
    {
        var (oturum, katilimci) = Kimlik();
        return etkilesim.SinyalGeriAlAsync(oturum, katilimci.Id, tur);
    }

    public async Task<bool> YoklamaYanitla(Guid yoklamaId, int secim)
    {
        var (oturum, katilimci) = Kimlik();
        return await etkilesim.YoklamaYanitlaAsync(oturum, katilimci, yoklamaId, secim);
    }

    private (CanliOturum Oturum, CanliKatilimci Katilimci) Kimlik() =>
        Bul() ?? throw new HubException("Oturum sona ermiş ya da katılım geçersiz.");

    private (CanliOturum Oturum, CanliKatilimci Katilimci)? Bul()
    {
        var ozet = Context.User?.FindFirst(Yetki.JetonOzetiTalebi)?.Value;
        return ozet is null ? null : depo.JetonaGoreBul(ozet);
    }
}
