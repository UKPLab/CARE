import * as Vue from 'vue'
import App from './App.vue'
import BootstrapVue3 from "bootstrap-vue-3";
import SocketIO from 'socket.io-client';
import VueSocketIO from 'vue-3-socket.io'
import MyVuexStore from './vuex-store.js'
import { createStore } from 'vuex';

//Store
const store = createStore({

});

const app = Vue.createApp({
    render: () => Vue.h(App)
});
app.use(MyVuexStore);

// devtools
if (process.env.NODE_ENV === 'development') {
    app.config.devtools = true;
}

//Bootstrap v5
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css';
app.use(BootstrapVue3);

//Routing
import router from './routes.js';
app.use(router);

// Socket IO
// https://www.npmjs.com/package/vue-3-socket.io
const options = { path:'' };
app.use(new VueSocketIO({
    debug: true,
    connection: SocketIO('http://127.0.0.1:6001', options),
    vuex: {
        MyVuexStore,
        actionPrefix: 'SOCKET_',
        mutationPrefix: 'SOCKET_'
    }
}));

app.mount('#app');
