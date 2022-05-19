import * as Vue from 'vue'
import App from './App.vue'
import BootstrapVue3 from "bootstrap-vue-3";
import SocketIO from 'socket.io-client';
import VueSocketIO from 'vue-3-socket.io';
import WebsocketStore from './store/modules/websocket.js';
import store from "./store";

const app = Vue.createApp({
    render: () => Vue.h(App)
});



// devtools
if (process.env.NODE_ENV !== 'production') {
    console.log(process.env.NODE_ENV);
    app.config.devtools = true;
}

//Bootstrap v5
//import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap"
app.use(BootstrapVue3);

// Socket IO
// https://www.npmjs.com/package/vue-3-socket.io
app.use(new VueSocketIO({
    debug: false,
    connection: SocketIO(import.meta.env.VITE_APP_WEBSOCKET_URL, { path:'' }),
    vuex: {
        store,
        actionPrefix: 'SOCKET_',
        mutationPrefix: 'SOCKET_'
    }
}));

// using Vuex Store
app.use(store);

//Routing
import router from './routes.js';
app.use(router);

app.mount('#app');
