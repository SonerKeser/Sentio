import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource-variable/figtree';
import './stil.css';
import { Uygulama } from './uygulama';

createRoot(document.getElementById('kok')!).render(
  <StrictMode>
    <Uygulama />
  </StrictMode>,
);
