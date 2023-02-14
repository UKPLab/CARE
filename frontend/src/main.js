/**
 * This is the main entry point to start the Vue app.
 * @author: Dennis Zyska
*/
import * as Vue from 'vue'
import App from './App.vue'
import SocketIO from 'socket.io-client';
import VueSocketIO from 'vue-3-socket.io';
import store from "./store";
import router from './routes';

const app = Vue.createApp({
    render: () => Vue.h(App)
});

// activate devtools in development mode
if (process.env.NODE_ENV !== 'production') {
    app.config.devtools = true;
}

// Bootstrap
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap/dist/js/bootstrap.bundle.js'
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css'
import BootstrapVue3 from "bootstrap-vue-3";
import {BToastPlugin} from 'bootstrap-vue-3'
app.use(BootstrapVue3);
app.use(BToastPlugin);

// Socket IO
// https://www.npmjs.com/package/vue-3-socket.io
// Server URL for hot reload
import getServerURL from './assets/serverUrl.js';
app.use(new VueSocketIO({
    debug: (process.env.NODE_ENV !== 'production'),
    connection: SocketIO(getServerURL(),
        {
            path: '',
            withCredentials: true,
        }),
    vuex: {
        store,
        actionPrefix: 'SOCKET_',
        mutationPrefix: 'SOCKET_'
    }
}));

//EventBus
import mitt from 'mitt';
const eventBus = mitt()
app.config.globalProperties.eventBus = eventBus;

app.use(store);
app.use(router);
app.mount('#app');
