import * as VueRouter from 'vue-router'
import store from "./store";

// Set Vue Routing
import Annotater from "./components/dashboard/Annotater.vue";
import Overview from "./components/dashboard/Overview.vue";
import NotFoundPage from "./components/NotFoundPage.vue";
import Login from "./components/auth/Login.vue";
import Register from "./components/auth/Register.vue";


const routes = [
    { path: "/", component: Overview},
    { path: "/index.html", component: Overview},
    { path: "/login", component: Login},
    { path: "/register", component: Register},
    { path: "/annotate/:pdf_path", component: Annotater, props: true },
    { path: "/:catchAll(.*)", name: "NotFound", component: NotFoundPage}
]

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    hashbang: false,
    routes: routes,
    mode: 'html5',
    root: "/"
})

//TODO see issue #14
/*
router.beforeEach((to, from, next) => {
    if (!store.auth.isAuthenticated() && to.path !== '/register') next('/login')
    next();
})*/

export default router;