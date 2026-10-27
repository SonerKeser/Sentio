using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.Extensions.Options;
using Sezgi.Sunucu.Api;

namespace Sezgi.Sunucu.Hizmetler;

/// <summary>
/// Sunucuyu yerel ağa UDP yayınıyla duyurur; Sezgi masaüstü uygulaması bu duyuruları dinleyip bulunan
/// sunucuları listeler. Öğrencilerin IP adresi yazmasına gerek kalmaz. Duyuruda yalnızca ad, sürüm ve adres vardır.
/// </summary>
public sealed class AgDuyurucu(IServer sunucu, IOptions<SezgiAyarlari> ayarlar, ILogger<AgDuyurucu> gunluk) : BackgroundService
{
    public const int Port = 5758;

    protected override async Task ExecuteAsync(CancellationToken iptal)
    {
        if (!ayarlar.Value.AgDuyurusu) return;
        await Task.Delay(TimeSpan.FromSeconds(2), iptal);

        using var soket = new UdpClient { EnableBroadcast = true };
        using var zamanlayici = new PeriodicTimer(TimeSpan.FromSeconds(3));
        var hataYazildi = false;
        do
        {
            try
            {
                var adresler = string.IsNullOrWhiteSpace(ayarlar.Value.GenelAdres)
                    ? SistemUclari.YerelAdresler(sunucu)
                    : [ayarlar.Value.GenelAdres.TrimEnd('/')];
                if (adresler.Count == 0) continue;
                var ileti = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { ad = "Sezgi", surum = Surum.Metin, adresler, makine = Environment.MachineName }));
                foreach (var hedef in YayinAdresleri())
                {
                    await soket.SendAsync(ileti, new IPEndPoint(hedef, Port), iptal);
                }
            }
            catch (Exception ex) when (ex is SocketException or NetworkInformationException)
            {
                if (!hataYazildi) gunluk.LogDebug(ex, "Ağ duyurusu gönderilemedi.");
                hataYazildi = true;
            }
        } while (await zamanlayici.WaitForNextTickAsync(iptal));
    }

    /// <summary>Her etkin IPv4 arayüzünün yayın adresi (ör. 192.168.1.255).</summary>
    private static IEnumerable<IPAddress> YayinAdresleri()
    {
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.OperationalStatus != OperationalStatus.Up || ni.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel) continue;
            foreach (var u in ni.GetIPProperties().UnicastAddresses)
            {
                if (u.Address.AddressFamily != AddressFamily.InterNetwork || u.IPv4Mask is null) continue;
                var ip = u.Address.GetAddressBytes();
                var maske = u.IPv4Mask.GetAddressBytes();
                var yayin = new byte[4];
                for (var i = 0; i < 4; i++) yayin[i] = (byte)(ip[i] | ~maske[i]);
                yield return new IPAddress(yayin);
            }
        }
    }
}
