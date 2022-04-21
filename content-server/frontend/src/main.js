import * as Vue from 'vue'
import * as VueRouter from 'vue-router'
import App from './App.vue'
import Annotater from "./components/Annotater.vue";
import LandingPage from "./components/LandingPage.vue";


const routes = [
    { path: "/", component: LandingPage},
    { path: "/index.html", component: LandingPage},
    { path: "/annotate/:pdf_path", component: Annotater, props: true }
]

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    hashbang: false,
    routes: routes,
    mode: 'html5',
    root: "/"
})

const app = Vue.createApp({
    render: () => Vue.h(App)
})
// define window as a global property (needed for vue3)
app.config.globalProperties.window = window

app.use(router)
app.mount('#app')
