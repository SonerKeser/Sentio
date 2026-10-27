import { Link } from 'react-router';
import { sinif } from './ui';

export function LogoIsareti({ boyut = 28 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="logo-g" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFE3A1" />
          <stop offset=".55" stopColor="#FFC94A" />
          <stop offset="1" stopColor="#FF7AD9" />
        </radialGradient>
      </defs>
      <path fill="url(#logo-g)" d="M32 4c14 0 27 9 28 26 1 16-11 30-28 30S3 47 4 31C5 14 18 4 32 4Z" />
      <ellipse cx="23" cy="28" rx="3.6" ry="4.6" fill="#1A1535" />
      <ellipse cx="41" cy="28" rx="3.6" ry="4.6" fill="#1A1535" />
      <path d="M21 40c6 6 16 6 22 0" fill="none" stroke="#1A1535" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ hedef = '/', className }: { hedef?: string; className?: string }) {
  return (
    <Link to={hedef} className={sinif('inline-flex items-center gap-2.5', className)} aria-label="Sezgi ana sayfa">
      <LogoIsareti />
      <span className="baslik text-[22px] font-bold leading-none tracking-tight">Sezgi</span>
    </Link>
  );
}

/** GitHub işareti (lucide marka simgelerini artık içermiyor). */
export function GithubSimgesi({ boyut = 20 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}
