"""Linux sunucu paketini çalıştırma izinleri korunarak tar.gz yapar (Windows'ta derlerken gerekli).

Kullanım: python -I betikler/tar-olustur.py <klasor> <cikti.tar.gz>
"""
import os
import sys
import tarfile

klasor, cikti = sys.argv[1], sys.argv[2]
kok_ad = os.path.basename(os.path.normpath(klasor))
CALISTIRILABILIR = {"Sentio.Sunucu", "createdump"}


def ayarla(bilgi: tarfile.TarInfo) -> tarfile.TarInfo:
    bilgi.uid = bilgi.gid = 0
    bilgi.uname = bilgi.gname = "root"
    if bilgi.isdir() or os.path.basename(bilgi.name) in CALISTIRILABILIR:
        bilgi.mode = 0o755
    else:
        bilgi.mode = 0o644
    return bilgi


with tarfile.open(cikti, "w:gz") as tar:
    tar.add(klasor, arcname=kok_ad, filter=ayarla)
print(cikti)
