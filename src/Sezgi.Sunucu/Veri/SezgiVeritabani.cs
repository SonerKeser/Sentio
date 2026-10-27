using Microsoft.EntityFrameworkCore;

namespace Sezgi.Sunucu.Veri;

public sealed class SezgiVeritabani(DbContextOptions<SezgiVeritabani> secenekler) : DbContext(secenekler)
{
    public DbSet<Ogretmen> Ogretmenler => Set<Ogretmen>();
    public DbSet<Oturum> Oturumlar => Set<Oturum>();
    public DbSet<Katilimci> Katilimcilar => Set<Katilimci>();
    public DbSet<Okuma> Okumalar => Set<Okuma>();
    public DbSet<Uyari> Uyarilar => Set<Uyari>();

    protected override void ConfigureConventions(ModelConfigurationBuilder yapilandirma)
    {
        // SQLite tarih türünü bilmez; okunan değerler UTC olarak işaretlenir ki JSON'da "Z" ile gitsin.
        yapilandirma.Properties<DateTime>().HaveConversion<UtcDonusturucu>();
        yapilandirma.Properties<DateTime?>().HaveConversion<UtcDonusturucu>();
    }

    private sealed class UtcDonusturucu() : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
        d => d.Kind == DateTimeKind.Local ? d.ToUniversalTime() : d,
        d => DateTime.SpecifyKind(d, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Ogretmen>(e =>
        {
            e.HasIndex(x => x.KullaniciAdi).IsUnique();
            e.Property(x => x.KullaniciAdi).HasMaxLength(64).UseCollation("NOCASE");
            e.Property(x => x.AdSoyad).HasMaxLength(128);
        });

        model.Entity<Oturum>(e =>
        {
            e.Property(x => x.Baslik).HasMaxLength(160);
            e.Property(x => x.SinifAdi).HasMaxLength(80);
            e.Property(x => x.KatilimKodu).HasMaxLength(12);
            e.HasIndex(x => new { x.KatilimKodu, x.Durum });
            e.HasIndex(x => new { x.OgretmenId, x.OlusturmaZamani });
            e.HasOne(x => x.Ogretmen).WithMany().HasForeignKey(x => x.OgretmenId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Katilimcilar).WithOne().HasForeignKey(x => x.OturumId).OnDelete(DeleteBehavior.Cascade);
            e.OwnsOne(x => x.Ayarlar);
        });

        model.Entity<Katilimci>(e =>
        {
            e.Property(x => x.Ad).HasMaxLength(80);
            e.Property(x => x.JetonOzeti).HasMaxLength(64);
            e.Property(x => x.DisKimlik).HasMaxLength(64);
            e.HasIndex(x => x.JetonOzeti);
        });

        model.Entity<Okuma>(e =>
        {
            e.HasIndex(x => new { x.OturumId, x.ZamanMs });
            e.HasIndex(x => new { x.KatilimciId, x.ZamanMs });
            e.HasOne<Oturum>().WithMany().HasForeignKey(x => x.OturumId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<Uyari>(e =>
        {
            e.Property(x => x.Mesaj).HasMaxLength(500);
            e.HasIndex(x => new { x.OturumId, x.Zaman });
            e.HasOne<Oturum>().WithMany().HasForeignKey(x => x.OturumId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
