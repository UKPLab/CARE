/* vite.config.js - configure vite for vue

This file is necessary to specify where and how vue components
are compiled into a build directory. This file configures
vite to build the components into the ../dist directory.

Author: Dennis Zyska, Nils Dycke
Source: https://vitejs.dev/config/
*/
import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    }
  },
  build: {
    outDir: "../dist"
  },
  root: "./",
  test: {
    // enable jest-like global test APIs
    globals: true,
    // simulate DOM with happy-dom
    // (requires installing happy-dom as a peer dependency)
    environment: 'happy-dom'
  }
})
