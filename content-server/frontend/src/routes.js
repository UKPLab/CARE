import * as VueRouter from 'vue-router'
import store from "./store";

// Set Vue Routing
import Annotater from "./components/dashboard/Annotater.vue";
import Dashboard from "./components/Dashboard.vue";
import NotFoundPage from "./components/NotFoundPage.vue";
import Login from "./components/auth/Login.vue";
import Register from "./components/auth/Register.vue";


const routes = [
    { path: "/", component: Dashboard, meta: { requiresAuth: true }},
    { path: "/index.html", component: Dashboard, meta: { requiresAuth: true }},
    { path: "/login", component: Login, meta: { requiresAuth: false }},
    { path: "/register", component: Register, meta: { requiresAuth: false }},
    { path: "/annotate/:pdf_path", component: Annotater, props: true, meta: { requiresAuth: true } },
    { path: "/:catchAll(.*)", name: "NotFound", component: NotFoundPage, meta: { requiresAuth: false }}
]

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    hashbang: false,
    routes: routes,
    mode: 'html5',
    root: "/"
})

router.beforeEach(async (to, from, next) => {
    await store.restored;
    if (to.meta.requiresAuth && store.getters['auth/isAuthenticated'] === false) next("/login");
    else if (store.getters['auth/isAuthenticated'] && (to.path === '/register' || to.path === '/login')) next('/');
    else next();
})

export default router;