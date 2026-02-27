import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['icons/*.png', 'manifest.webmanifest'],
      manifest: {
        name: 'NPC Translator',
        short_name: 'NPC Trans',
        description: 'Traduttore multilingua offline-first con OCR e voce',
        theme_color: '#0f0f17',
        background_color: '#0a0a0f',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://translate.googleapis.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'translation-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 50 }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true }
    }
  }
})