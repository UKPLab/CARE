/* vite.config.js - configure vite for vue

This file is necessary to specify where and how vue components
are compiled into a build directory. This file configures
vite to build the components into the ../dist directory.

Author: Dennis Zyska, Nils Dycke
Source: https://vitejs.dev/config/
*/
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {createHtmlPlugin} from 'vite-plugin-html'
import path from 'path'
import {fileURLToPath, URL} from "url";
import { execSync } from 'child_process';

const getVersion = () => {
  let ciHash = process.env.TAG_COMMIT;
  let tag_latest = process.env.TAG_LATEST;
  if (tag_latest && ciHash) return tag_latest + ": " + ciHash;
  try {
    ciHash = execSync('git rev-parse --short HEAD').toString().trim();
    tag_latest = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    return tag_latest + ": " + ciHash;
  } catch (e) {
    // Fallback if no git is found
    return 'dev-build';
  }
};

export default defineConfig({
    plugins: [vue(),
        createHtmlPlugin({
            inject: {
                data: {
                    title: process.env.VITE_APP_TITLE,
                    config_path: (process.env.NODE_ENV !== 'production') ?
                        process.env.VITE_APP_SERVER_URL + '/config.js' : '/config.js',
                }
            }
        })],
    define: {
        APP_VERSION: JSON.stringify(getVersion()),
    },
    resolve: {
        preserveSymlinks: true,
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
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
    },
    publicDir: "./src/assets/media"
})
