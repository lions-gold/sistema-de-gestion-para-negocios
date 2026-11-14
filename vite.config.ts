import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
  const basePath = resolveViteBase();
  const manifestStartUrl = basePath === './' ? './' : basePath;

  const gaMeasurementId =
    env.VITE_GA_MEASUREMENT_ID ||
    process.env.VITE_GA_MEASUREMENT_ID ||
    'G-SM1TH2026EC';
  const gscVerification =
    env.VITE_GSC_VERIFICATION ||
    process.env.VITE_GSC_VERIFICATION ||
    'SmithSolutionsECommerce-GSC-2026-Verified';

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      analyticsHtmlPlugin(gaMeasurementId, gscVerification),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: [
          'favicon.svg',
          'icon.svg',
          'apple-touch-icon.png',
          'smith-logo-animated.gif',
        ],
        manifest: {
          id: manifestStartUrl,
          name: 'Smith Solutions E-Commerce',
          short_name: 'SmithSaaS',
          description:
            'Plataforma Multi-SaaS, almacenes, punto de venta multidivisa BCV y modo offline con recopilación local.',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: 'any',
          scope: manifestStartUrl,
          start_url: manifestStartUrl,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,gif,woff2}'],
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/bcv$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-bcv-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets-cache',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
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
