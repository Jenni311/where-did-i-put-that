import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Where Did I Put That?',
        short_name: 'Where Did I Put That?',
        description: 'Save where you put things so you can find them later.',
        theme_color: '#f88c8c',
        background_color: '#faf6f0',
        display: 'standalone',
        icons: [
          {
            src: '/where-did-i-put-that/APP-ICON-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/where-did-i-put-that/APP-ICON-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/where-did-i-put-that/APP-ICON-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/where-did-i-put-that/APP-ICON-1024x1024.png',
            sizes: '1024x1024',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  base: '/where-did-i-put-that/',
})