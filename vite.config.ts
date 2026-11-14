import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

function analyticsHtmlPlugin(gaId: string, gscToken: string): Plugin {
  return {
    name: 'smith-solutions-analytics-html',
    transformIndexHtml(html) {
      return html
        .replace(/__VITE_GA_MEASUREMENT_ID__/g, gaId)
        .replace(/__VITE_GSC_VERIFICATION__/g, gscToken);
    },
  };
}

function resolveViteBase(): string {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }
  if (process.env.GITHUB_PAGES === 'true') {
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
    return repo ? `/${repo}/` : './';
  }
  return '/';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gaMeasurementId =
    env.VITE_GA_MEASUREMENT_ID ||
    process.env.VITE_GA_MEASUREMENT_ID ||
    'G-SM1TH2026EC';
  const gscVerification =
    env.VITE_GSC_VERIFICATION ||
    process.env.VITE_GSC_VERIFICATION ||
    'SmithSolutionsECommerce-GSC-2026-Verified';

  return {
    base: resolveViteBase(),
    plugins: [
      react(),
      tailwindcss(),
      analyticsHtmlPlugin(gaMeasurementId, gscVerification),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
