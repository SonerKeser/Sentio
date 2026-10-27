import * as signalR from '@microsoft/signalr';

export class ApiHatasi extends Error {
  constructor(
    message: string,
    public readonly durum: number,
  ) {
    super(message);
  }
}

const VARSAYILAN_HATA: Record<number, string> = {
  401: 'Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın.',
  403: 'Bu işlem için yetkiniz yok.',
  404: 'Aradığınız kayıt bulunamadı.',
  429: 'Çok fazla deneme yapıldı. Bir dakika bekleyip yeniden deneyin.',
};

/** JSON API çağrısı. Sunucunun ProblemDetails yanıtındaki "detail" alanı hata mesajı olarak taşınır. */
export async function api<T>(yol: string, secenekler: RequestInit & { govde?: unknown; jeton?: string } = {}): Promise<T> {
  const { govde, jeton, headers, ...kalan } = secenekler;
  let yanit: Response;
  try {
    yanit = await fetch(yol, {
      credentials: 'same-origin',
      ...kalan,
      headers: {
        Accept: 'application/json',
        ...(govde !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
        ...headers,
      },
      body: govde !== undefined ? JSON.stringify(govde) : kalan.body,
    });
  } catch {
    throw new ApiHatasi('Sunucuya ulaşılamadı. Ağ bağlantınızı ve sunucunun çalıştığını kontrol edin.', 0);
  }

  if (!yanit.ok) {
    let mesaj = VARSAYILAN_HATA[yanit.status] ?? `Sunucu isteği tamamlayamadı (${yanit.status}).`;
    try {
      const sorun = await yanit.json();
      if (typeof sorun?.detail === 'string') mesaj = sorun.detail;
    } catch {
      /* gövde JSON değil */
    }
    throw new ApiHatasi(mesaj, yanit.status);
  }
  if (yanit.status === 204) return undefined as T;
  const tur = yanit.headers.get('content-type') ?? '';
  return (tur.includes('json') ? await yanit.json() : undefined) as T;
}

export function hubBaglantisi(yol: string, jeton?: () => string): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(yol, jeton ? { accessTokenFactory: jeton } : {})
    .withAutomaticReconnect({
      // Önce hızlı, sonra seyrek: okul ağlarındaki kısa kopmalarda ders akışı kesilmesin.
      nextRetryDelayInMilliseconds: (b) => (b.previousRetryCount < 4 ? 1000 * (b.previousRetryCount + 1) : 10_000),
    })
    .configureLogging(signalR.LogLevel.Warning)
    .build();
}

export const hataMesaji = (e: unknown) =>
  e instanceof Error ? e.message.replace(/^An unexpected error occurred invoking '\w+' on the server\. HubException: /, '') : String(e);

export function boyutYaz(bayt: number): string {
  if (bayt < 1024 * 1024) return `${Math.max(1, Math.round(bayt / 1024))} KB`;
  return `${(bayt / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
}
