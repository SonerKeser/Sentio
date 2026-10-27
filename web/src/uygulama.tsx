import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MotionConfig } from 'motion/react';
import { BildirimSaglayici, Donen } from './bilesenler/ui';
import { Tanitim } from './sayfalar/tanitim/Tanitim';
import { TANITIM_MODU } from './ortam';

const OgrenciUygulamasi = lazy(() => import('./sayfalar/ogrenci/OgrenciUygulamasi'));
const PanelKabugu = lazy(() => import('./sayfalar/panel/PanelKabugu'));
const Oturumlar = lazy(() => import('./sayfalar/panel/Oturumlar'));
const CanliPanel = lazy(() => import('./sayfalar/panel/CanliPanel'));
const RaporSayfasi = lazy(() => import('./sayfalar/panel/RaporSayfasi'));
const AyarlarSayfasi = lazy(() => import('./sayfalar/panel/AyarlarSayfasi'));

function Yukleniyor() {
  return (
    <div className="grid min-h-dvh place-items-center text-soluk">
      <Donen boyut={28} />
    </div>
  );
}

const Tembel = ({ children }: { children: ReactNode }) => <Suspense fallback={<Yukleniyor />}>{children}</Suspense>;

export function Uygulama() {
  return (
    <MotionConfig reducedMotion="user">
      <BildirimSaglayici>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            <Route path="/" element={<Tanitim />} />
            {!TANITIM_MODU && (
              <>
                <Route path="/katil/:kod?" element={<Tembel><OgrenciUygulamasi /></Tembel>} />
                <Route path="/panel" element={<Tembel><PanelKabugu /></Tembel>}>
                  <Route index element={<Tembel><Oturumlar /></Tembel>} />
                  <Route path="oturum/:id" element={<Tembel><CanliPanel /></Tembel>} />
                  <Route path="oturum/:id/rapor" element={<Tembel><RaporSayfasi /></Tembel>} />
                  <Route path="ayarlar" element={<Tembel><AyarlarSayfasi /></Tembel>} />
                </Route>
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </BildirimSaglayici>
    </MotionConfig>
  );
}
