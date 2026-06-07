/**
 * This is the main entry point to start the Vue app.
 * @author: Dennis Zyska
 */
import * as Vue from 'vue'
import App from './App.vue'
import SocketIO from 'socket.io-client';
import VueSocketIO from 'vue-3-socket.io';
import store from "./store";
import router from './router';
import './assets/styles/global.css';

const app = Vue.createApp({
    render: () => Vue.h(App)
});


import { createI18n } from 'vue-i18n'
import messages from '@i18n/messages.js'
import { DEFAULT_LOCALE, getInitialLocale } from '@/assets/locale.js'

export const i18n = createI18n({
  legacy: true,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages
});

app.use(i18n);

// activate devtools in development mode
 
if (process.env.NODE_ENV !== 'production') {
    app.config.devtools = true;
}

// Bootstrap
import 'bootstrap/dist/css/bootstrap.css'
// import 'bootstrap/dist/js/bootstrap.bundle.js'
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css'
import "bootstrap-icons/font/bootstrap-icons.css";
import BootstrapVue3 from "bootstrap-vue-3";
import {BToastPlugin} from 'bootstrap-vue-3'

app.use(BootstrapVue3);
app.use(BToastPlugin);

// VNetworkGraph
import VNetworkGraph from 'v-network-graph';
import 'v-network-graph/lib/style.css';
app.use(VNetworkGraph);

// Socket IO
// https://www.npmjs.com/package/vue-3-socket.io
// Server URL for hot reload
import getServerURL from '@/assets/serverUrl.js';

const socketio = new VueSocketIO({
     
    debug: (process.env.NODE_ENV !== 'production'),
    connection: SocketIO(getServerURL(),
        {
            path: '',
            withCredentials: true,
            reconnect: !0,
            autoConnect: false
        }),
    vuex: {
        store,
        actionPrefix: 'SOCKET_',
        mutationPrefix: 'SOCKET_'
    }
});

app.use(socketio);

//EventBus
import mitt from 'mitt';

const eventBus = mitt()
app.config.globalProperties.eventBus = eventBus;
app.config.unwrapInjectedRef = true;

app.use(router);
app.use(store);

//Add Auto emits for sockets on mounted
import subscribeTable from "@/plugins/subscribeTable";

app.use(subscribeTable);

router.isReady().then(() => app.mount('#app'));
