import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrKod({ metin, boyut = 200 }: { metin: string; boyut?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(metin, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1A1535', light: '#F1EEFF' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [metin]);
  return (
    <div
      className="overflow-hidden rounded-2xl bg-metin p-2 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: boyut, height: boyut }}
      role="img"
      aria-label={`Karekod: ${metin}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
