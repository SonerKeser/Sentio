using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sezgi.Sunucu.Veri.Gocler
{
    /// <inheritdoc />
    public partial class Baslangic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Ogretmenler",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    KullaniciAdi = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false, collation: "NOCASE"),
                    AdSoyad = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    ParolaOzeti = table.Column<string>(type: "TEXT", nullable: false),
                    Yonetici = table.Column<bool>(type: "INTEGER", nullable: false),
                    OlusturmaZamani = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ogretmenler", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Oturumlar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OgretmenId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Baslik = table.Column<string>(type: "TEXT", maxLength: 160, nullable: false),
                    SinifAdi = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    KatilimKodu = table.Column<string>(type: "TEXT", maxLength: 12, nullable: false),
                    Durum = table.Column<byte>(type: "INTEGER", nullable: false),
                    OlusturmaZamani = table.Column<DateTime>(type: "TEXT", nullable: false),
                    BitisZamani = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Ayarlar_OrneklemeMs = table.Column<int>(type: "INTEGER", nullable: false),
                    Ayarlar_KalicilikSn = table.Column<int>(type: "INTEGER", nullable: false),
                    Ayarlar_BeklemeSn = table.Column<int>(type: "INTEGER", nullable: false),
                    Ayarlar_IzlenenDuygular = table.Column<string>(type: "TEXT", nullable: false),
                    Ayarlar_DikkatIzle = table.Column<bool>(type: "INTEGER", nullable: false),
                    Ayarlar_YoklukIzle = table.Column<bool>(type: "INTEGER", nullable: false),
                    Ayarlar_UyuklamaIzle = table.Column<bool>(type: "INTEGER", nullable: false),
                    Ayarlar_DurtmeAcik = table.Column<bool>(type: "INTEGER", nullable: false),
                    Ayarlar_OgrenciKendiniGorsun = table.Column<bool>(type: "INTEGER", nullable: false),
                    Ayarlar_Anonim = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Oturumlar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Oturumlar_Ogretmenler_OgretmenId",
                        column: x => x.OgretmenId,
                        principalTable: "Ogretmenler",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Katilimcilar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Ad = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    SiraNo = table.Column<int>(type: "INTEGER", nullable: false),
                    Kaynak = table.Column<byte>(type: "INTEGER", nullable: false),
                    JetonOzeti = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    DisKimlik = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    KatilmaZamani = table.Column<DateTime>(type: "TEXT", nullable: false),
                    AyrilmaZamani = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Katilimcilar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Katilimcilar_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Okumalar",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    KatilimciId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ZamanMs = table.Column<long>(type: "INTEGER", nullable: false),
                    Notr = table.Column<byte>(type: "INTEGER", nullable: false),
                    Mutlu = table.Column<byte>(type: "INTEGER", nullable: false),
                    Saskin = table.Column<byte>(type: "INTEGER", nullable: false),
                    Uzgun = table.Column<byte>(type: "INTEGER", nullable: false),
                    Ofkeli = table.Column<byte>(type: "INTEGER", nullable: false),
                    Korku = table.Column<byte>(type: "INTEGER", nullable: false),
                    Igrenme = table.Column<byte>(type: "INTEGER", nullable: false),
                    Dikkat = table.Column<byte>(type: "INTEGER", nullable: false),
                    Goz = table.Column<byte>(type: "INTEGER", nullable: false),
                    Yuz = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Okumalar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Okumalar_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Uyarilar",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    KatilimciId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Tur = table.Column<byte>(type: "INTEGER", nullable: false),
                    Duygu = table.Column<byte>(type: "INTEGER", nullable: true),
                    Mesaj = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    Oran = table.Column<float>(type: "REAL", nullable: true),
                    OgrenciyeIletildi = table.Column<bool>(type: "INTEGER", nullable: false),
                    Zaman = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Uyarilar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Uyarilar_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Katilimcilar_JetonOzeti",
                table: "Katilimcilar",
                column: "JetonOzeti");

            migrationBuilder.CreateIndex(
                name: "IX_Katilimcilar_OturumId",
                table: "Katilimcilar",
                column: "OturumId");

            migrationBuilder.CreateIndex(
                name: "IX_Ogretmenler_KullaniciAdi",
                table: "Ogretmenler",
                column: "KullaniciAdi",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Okumalar_KatilimciId_ZamanMs",
                table: "Okumalar",
                columns: new[] { "KatilimciId", "ZamanMs" });

            migrationBuilder.CreateIndex(
                name: "IX_Okumalar_OturumId_ZamanMs",
                table: "Okumalar",
                columns: new[] { "OturumId", "ZamanMs" });

            migrationBuilder.CreateIndex(
                name: "IX_Oturumlar_KatilimKodu_Durum",
                table: "Oturumlar",
                columns: new[] { "KatilimKodu", "Durum" });

            migrationBuilder.CreateIndex(
                name: "IX_Oturumlar_OgretmenId_OlusturmaZamani",
                table: "Oturumlar",
                columns: new[] { "OgretmenId", "OlusturmaZamani" });

            migrationBuilder.CreateIndex(
                name: "IX_Uyarilar_OturumId_Zaman",
                table: "Uyarilar",
                columns: new[] { "OturumId", "Zaman" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Katilimcilar");

            migrationBuilder.DropTable(
                name: "Okumalar");

            migrationBuilder.DropTable(
                name: "Uyarilar");

            migrationBuilder.DropTable(
                name: "Oturumlar");

            migrationBuilder.DropTable(
                name: "Ogretmenler");
        }
    }
}
