/* main.js - Main entry point for the vue app

This is the main entry point to start the Vue app. Here
the app is configured with:
* vuex store
* boostrap vue3
* router

Load this script in your webpage HTML to create and mount the Vue app.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import * as Vue from 'vue'
import App from './App.vue'
import BootstrapVue3 from "bootstrap-vue-3";
import SocketIO from 'socket.io-client';
import VueSocketIO from 'vue-3-socket.io';
import store from "./store";
import router from './routes.js';

const app = Vue.createApp({
    render: () => Vue.h(App)
});

// devtools
if (process.env.NODE_ENV !== 'production') {
    app.config.devtools = true;
}

//Bootstrap v5
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap"
app.use(BootstrapVue3);

// Socket IO
// https://www.npmjs.com/package/vue-3-socket.io
app.use(new VueSocketIO({
    debug: true,
    connection: SocketIO(import.meta.env.VITE_APP_WEBSOCKET_URL,
        {
            path:'',
            withCredentials: true,
        }),
    vuex: {
        store,
        actionPrefix: 'SOCKET_',
        mutationPrefix: 'SOCKET_'
    }
}));

app.use(store);
app.use(router);
app.mount('#app');
