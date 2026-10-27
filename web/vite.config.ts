/// <reference types="vitest/config" />
import { createReadStream, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Tarayıcıda çalışan analiz için gereken Human modelleri (yüz bulma, yüz ağı, iris, ifade, yüz tanımlayıcı). */
const MODELLER = ['blazeface', 'facemesh', 'iris', 'emotion', 'faceres'];
const MODEL_KLASORU = path.resolve(__dirname, 'node_modules/@vladmandic/human/models');
const SUNUCU = process.env.SEZGI_SUNUCU ?? 'http://localhost:5757';

/**
 * Modelleri node_modules'tan doğrudan sunar ve derlemede /modeller altına kopyalar.
 * Böylece sunucu internete çıkamayan okul ağlarında da çalışır; modeller CDN'den indirilmez.
 */
function humanModelleri(kopyala: boolean): Plugin {
  const dosyalar = MODELLER.flatMap((m) => [`${m}.json`, `${m}.bin`]);
  return {
    name: 'sezgi-human-modelleri',
    configureServer(sunucu) {
      sunucu.middlewares.use('/modeller', (istek, yanit, sonraki) => {
        const ad = path.basename((istek.url ?? '').split('?')[0]);
        if (!dosyalar.includes(ad)) return sonraki();
        yanit.setHeader('Content-Type', ad.endsWith('.json') ? 'application/json' : 'application/octet-stream');
        createReadStream(path.join(MODEL_KLASORU, ad)).pipe(yanit);
      });
    },
    generateBundle() {
      if (!kopyala) return;
      for (const ad of dosyalar) {
        this.emitFile({ type: 'asset', fileName: `modeller/${ad}`, source: readFileSync(path.join(MODEL_KLASORU, ad)) });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const tanitim = mode === 'tanitim';
  return {
    base: tanitim ? (process.env.SEZGI_TABAN ?? '/Sezgi/') : '/',
    plugins: [react(), tailwindcss(), humanModelleri(!tanitim)],
    define: {
      __SURUM__: JSON.stringify(JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version),
    },
    build: {
      outDir: tanitim ? 'dist-tanitim' : '../src/Sezgi.Sunucu/wwwroot',
      emptyOutDir: true,
      chunkSizeWarningLimit: 4000,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': SUNUCU,
        '/saglik': SUNUCU,
        '/indirmeler': SUNUCU,
        '/openapi': SUNUCU,
        '/hub': { target: SUNUCU, ws: true },
      },
    },
    test: {
      environment: 'node',
    },
  };
});
