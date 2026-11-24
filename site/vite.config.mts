import Vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  // Served as a GitHub Pages project site: https://cedar-ai-project.github.io/personal-librarian/
  base: '/personal-librarian/',
  plugins: [
    Vue({
      template: { transformAssetUrls },
    }),
    Vuetify(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
})
