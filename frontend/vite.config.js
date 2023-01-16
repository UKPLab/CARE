/* vite.config.js - configure vite for vue

This file is necessary to specify where and how vue components
are compiled into a build directory. This file configures
vite to build the components into the ../dist directory.

Author: Dennis Zyska, Nils Dycke
Source: https://vitejs.dev/config/
*/
import {fileURLToPath, URL} from 'url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {createHtmlPlugin} from 'vite-plugin-html'

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
