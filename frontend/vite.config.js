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
import fs from 'fs'

const getVersion = () => {
    const versionFilePath = path.join(__dirname, '..', 'version.json');
    console.log(versionFilePath);
    if (fs.existsSync(versionFilePath)) {
        try {
            const { version, branch } = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
            return `${branch}: ${version}`;
        } catch (e) {
            console.error("Error parsing version.json", e);
        }
    }
    try {
        Hash = execSync('git rev-parse --short HEAD').toString().trim();
        tag_latest = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        console.log("inside getVersion try");
        return tag_latest + ": " + Hash;
    } catch (e) {
        console.log("inside getVersion error");
        console.log(e.toString());
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
    server: {
        port: 3000,
    },
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
