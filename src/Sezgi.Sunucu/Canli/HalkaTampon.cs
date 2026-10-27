namespace Sezgi.Sunucu.Canli;

/// <summary>Sabit kapasiteli, en eski kaydın üzerine yazan tampon. İş parçacığı güvenli değildir.</summary>
public sealed class HalkaTampon<T>(int kapasite)
{
    private readonly T[] _ogeler = new T[kapasite];
    private int _bas;

    public int Sayi { get; private set; }
    public int Kapasite => _ogeler.Length;

    public void Ekle(T oge)
    {
        _ogeler[(_bas + Sayi) % _ogeler.Length] = oge;
        if (Sayi < _ogeler.Length) Sayi++;
        else _bas = (_bas + 1) % _ogeler.Length;
    }

    /// <summary>Eskiden yeniye sıralı öğeler.</summary>
    public IEnumerable<T> Sirali()
    {
        for (var i = 0; i < Sayi; i++) yield return _ogeler[(_bas + i) % _ogeler.Length];
    }

    /// <summary>En yeni <paramref name="adet"/> öğe, eskiden yeniye.</summary>
    public IEnumerable<T> Son(int adet)
    {
        var baslangic = Math.Max(0, Sayi - adet);
        for (var i = baslangic; i < Sayi; i++) yield return _ogeler[(_bas + i) % _ogeler.Length];
    }

    public void Temizle()
    {
        _bas = 0;
        Sayi = 0;
    }
}
