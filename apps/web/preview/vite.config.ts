import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { PLACEHOLDERS, placeholderSvg } from './placeholder-media';

// The fixture preview: the real app over a stubbed API, for screenshots against
// the artboards. Dev-only, built on its own and never by `pnpm build`:
//
//   vite build --config preview/vite.config.ts --outDir <absolute dir> --emptyOutDir
//   node preview/serve.mjs <dir> <port>
//
// A relative --outDir resolves against this folder (the root), not the app.

const web = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Writes the neutral picture stand-ins at the paths the fixtures point to. */
function placeholderMedia(): Plugin {
  return {
    name: 'preview-placeholder-media',
    generateBundle() {
      for (const p of PLACEHOLDERS) {
        this.emitFile({ type: 'asset', fileName: p.path, source: placeholderSvg(p) });
      }
    },
  };
}

/**
 * Tailwind finds class names by scanning from the Vite root, which here is this
 * folder. Tell the app's own stylesheet to scan the app as well, so the preview
 * gets exactly the utilities the production build gets.
 */
function scanAppSources(): Plugin {
  const theme = web('../src/shared/ui/theme.css');
  return {
    name: 'preview-scan-app-sources',
    enforce: 'pre',
    transform(code, id) {
      if (id.split('?')[0] !== theme) return null;
      return { code: `@source ${JSON.stringify(web('../src'))};\n${code}`, map: null };
    },
  };
}

export default defineConfig({
  root: web('.'),
  base: './',
  // The app's own public files: theme-init.js and the favicon.
  publicDir: web('../public'),
  plugins: [scanAppSources(), react(), tailwindcss(), placeholderMedia()],
  resolve: { alias: { '@': web('../src') } },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // The app chunk is named as the production entry is (`index-<hash>.js`), so the
        // "page is out of date" banner, which only a production entry can show, can be
        // shot by answering `/api/info` with another `web_entry`.
        chunkFileNames: chunk =>
          chunk.name === 'main' ? 'assets/index-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
