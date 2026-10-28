using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sentio.Sunucu.Veri.Gocler
{
    /// <inheritdoc />
    public partial class Etkilesim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Bolumler",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Ad = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Mola = table.Column<bool>(type: "INTEGER", nullable: false),
                    Baslangic = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Bitis = table.Column<DateTime>(type: "TEXT", nullable: true),
                    PlanlananBitis = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bolumler", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Bolumler_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KatilimciIstatistikleri",
                columns: table => new
                {
                    KatilimciId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Ad = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    AdAnahtari = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    Kaynak = table.Column<byte>(type: "INTEGER", nullable: false),
                    Dikkat = table.Column<float>(type: "REAL", nullable: false),
                    Katilim = table.Column<float>(type: "REAL", nullable: false),
                    Valans = table.Column<float>(type: "REAL", nullable: false),
                    YuzOrani = table.Column<float>(type: "REAL", nullable: false),
                    Baskin = table.Column<byte>(type: "INTEGER", nullable: true),
                    OkumaSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    UyariSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    AnlamadimSayisi = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KatilimciIstatistikleri", x => x.KatilimciId);
                    table.ForeignKey(
                        name: "FK_KatilimciIstatistikleri_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OturumIstatistikleri",
                columns: table => new
                {
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    KatilimciSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    OkumaSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    SureSn = table.Column<double>(type: "REAL", nullable: false),
                    Dikkat = table.Column<float>(type: "REAL", nullable: false),
                    Katilim = table.Column<float>(type: "REAL", nullable: false),
                    Valans = table.Column<float>(type: "REAL", nullable: false),
                    OlumsuzOran = table.Column<float>(type: "REAL", nullable: false),
                    YuzOrani = table.Column<float>(type: "REAL", nullable: false),
                    Dagilim = table.Column<string>(type: "TEXT", nullable: false),
                    AnlamaOrani = table.Column<float>(type: "REAL", nullable: true),
                    YoklamaSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    UyariSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    AnlamadimSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    SoruSayisi = table.Column<int>(type: "INTEGER", nullable: false),
                    HesaplanmaZamani = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OturumIstatistikleri", x => x.OturumId);
                    table.ForeignKey(
                        name: "FK_OturumIstatistikleri_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sinyaller",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    KatilimciId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tur = table.Column<byte>(type: "INTEGER", nullable: false),
                    Metin = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Zaman = table.Column<DateTime>(type: "TEXT", nullable: false),
                    KapanmaZamani = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sinyaller", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sinyaller_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Yoklamalar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OturumId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tur = table.Column<byte>(type: "INTEGER", nullable: false),
                    Soru = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Secenekler = table.Column<string>(type: "TEXT", nullable: false),
                    Baslangic = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Bitis = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Yoklamalar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Yoklamalar_Oturumlar_OturumId",
                        column: x => x.OturumId,
                        principalTable: "Oturumlar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "YoklamaYanitlari",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    YoklamaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    KatilimciId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Secim = table.Column<int>(type: "INTEGER", nullable: false),
                    Zaman = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_YoklamaYanitlari", x => x.Id);
                    table.ForeignKey(
                        name: "FK_YoklamaYanitlari_Yoklamalar_YoklamaId",
                        column: x => x.YoklamaId,
                        principalTable: "Yoklamalar",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bolumler_OturumId_Baslangic",
                table: "Bolumler",
                columns: new[] { "OturumId", "Baslangic" });

            migrationBuilder.CreateIndex(
                name: "IX_KatilimciIstatistikleri_AdAnahtari",
                table: "KatilimciIstatistikleri",
                column: "AdAnahtari");

            migrationBuilder.CreateIndex(
                name: "IX_KatilimciIstatistikleri_OturumId",
                table: "KatilimciIstatistikleri",
                column: "OturumId");

            migrationBuilder.CreateIndex(
                name: "IX_Sinyaller_KatilimciId",
                table: "Sinyaller",
                column: "KatilimciId");

            migrationBuilder.CreateIndex(
                name: "IX_Sinyaller_OturumId_Zaman",
                table: "Sinyaller",
                columns: new[] { "OturumId", "Zaman" });

            migrationBuilder.CreateIndex(
                name: "IX_Yoklamalar_OturumId_Baslangic",
                table: "Yoklamalar",
                columns: new[] { "OturumId", "Baslangic" });

            migrationBuilder.CreateIndex(
                name: "IX_YoklamaYanitlari_YoklamaId_KatilimciId",
                table: "YoklamaYanitlari",
                columns: new[] { "YoklamaId", "KatilimciId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Bolumler");

            migrationBuilder.DropTable(
                name: "KatilimciIstatistikleri");

            migrationBuilder.DropTable(
                name: "OturumIstatistikleri");

            migrationBuilder.DropTable(
                name: "Sinyaller");

            migrationBuilder.DropTable(
                name: "YoklamaYanitlari");

            migrationBuilder.DropTable(
                name: "Yoklamalar");
        }
    }
}
