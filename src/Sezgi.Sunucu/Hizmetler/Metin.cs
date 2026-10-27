using System.Text;

namespace Sezgi.Sunucu.Hizmetler;

public static class Metin
{
    /// <summary>Görünen adları temizler: kontrol karakterlerini atar, boşlukları sadeleştirir, uzunluğu sınırlar.</summary>
    public static string Ad(string? deger, int enFazla = 60)
    {
        if (string.IsNullOrWhiteSpace(deger)) return "";
        var sb = new StringBuilder(deger.Length);
        var oncekiBosluk = false;
        foreach (var c in deger.Trim())
        {
            if (char.IsControl(c)) continue;
            if (char.IsWhiteSpace(c))
            {
                if (!oncekiBosluk) sb.Append(' ');
                oncekiBosluk = true;
                continue;
            }
            oncekiBosluk = false;
            sb.Append(c);
        }
        var sonuc = sb.ToString().Trim();
        return sonuc.Length > enFazla ? sonuc[..enFazla].TrimEnd() : sonuc;
    }
}
