import * as Vue from 'vue'
import App from './App.vue'
import BootstrapVue3 from "bootstrap-vue-3";

const app = Vue.createApp({
    render: () => Vue.h(App)
});

//Bootstrap v5
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css';
app.use(BootstrapVue3);

//Routing
import router from './routes.js';
app.use(router);

app.mount('#app');
