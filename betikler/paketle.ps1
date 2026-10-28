<#
.SYNOPSIS
  Sentio sürüm dosyalarını üretir: sunucu (Windows x64, Linux x64, Linux ARM64) ve masaüstü istemcisi (Windows).
.EXAMPLE
  pwsh betikler/paketle.ps1
  pwsh betikler/paketle.ps1 -MasaustuAtla
#>
param(
    [string]$Cikti = "cikti/surum",
    [switch]$MasaustuAtla,
    [switch]$TestAtla
)
$ErrorActionPreference = 'Stop'
$kok = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $kok
$cikti = Join-Path $kok $Cikti
New-Item -ItemType Directory -Force $cikti | Out-Null

function Adim($metin) { Write-Host "`n==> $metin" -ForegroundColor Yellow }

# Windows PowerShell 5.1 yerel komutların hata koduyla durmaz; her komuttan sonra denetlenir.
function Calistir {
    $komut, $argumanlar = $args
    & $komut @argumanlar
    if ($LASTEXITCODE -ne 0) { throw "Komut başarısız oldu ($LASTEXITCODE): $($args -join ' ')" }
}

Adim 'Web arayüzü derleniyor'
Push-Location web
Calistir npm ci --no-audit --no-fund
if (-not $TestAtla) { Calistir npm test }
Calistir npm run build
Pop-Location

if (-not $TestAtla) {
    Adim 'Sunucu testleri'
    Calistir dotnet test tests/Sentio.Sunucu.Testleri -c Release
}

$ara = Join-Path $kok 'cikti/ara'
foreach ($rid in 'win-x64', 'linux-x64', 'linux-arm64') {
    Adim "Sunucu yayımlanıyor: $rid"
    $hedef = Join-Path $ara "Sentio-Sunucu-$rid"
    if (Test-Path $hedef) { Remove-Item -Recurse -Force $hedef }
    Calistir dotnet publish src/Sentio.Sunucu -c Release -r $rid --self-contained -p:PublishSingleFile=true -o $hedef
    Get-ChildItem $hedef -Filter *.pdb | Remove-Item
    Copy-Item betikler/sunucu-oku-beni.txt (Join-Path $hedef 'OKU-BENI.txt')
    if ($rid -like 'linux-*') {
        Copy-Item betikler/sentio.service $hedef
        Calistir python -I betikler/tar-olustur.py $hedef (Join-Path $cikti "Sentio-Sunucu-$rid.tar.gz")
    } else {
        $zip = Join-Path $cikti "Sentio-Sunucu-$rid.zip"
        if (Test-Path $zip) { Remove-Item $zip }
        Compress-Archive -Path (Join-Path $hedef '*') -DestinationPath $zip -CompressionLevel Optimal
    }
}

if (-not $MasaustuAtla) {
    Adim 'Masaüstü istemcisi paketleniyor'
    Push-Location masaustu
    Calistir npm ci --no-audit --no-fund
    Calistir npm run simge
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    Calistir npx electron-builder --win --x64 --publish never
    Pop-Location
    Copy-Item masaustu/dist/Sentio-Masaustu-Kurulum.exe, masaustu/dist/Sentio-Masaustu-Kurulum.exe.blockmap, masaustu/dist/Sentio-Masaustu-Tasinabilir.exe, masaustu/dist/latest.yml $cikti
}

Remove-Item -Recurse -Force $ara
Adim 'Hazır'
Get-ChildItem $cikti | Select-Object Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } } | Format-Table -AutoSize
