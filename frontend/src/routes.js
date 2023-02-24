/**
 * Specifies all Vue routes in one file. Add new routes here to the "routes" attribute.
 * Additionally, the vue router is configured and basic user authentication to routes
 * that require a login is realized.
 *
 * Pass metadata via the meta attribute. Current supported fields:
 * > requiresAuth: true/false <=> true, iff a login is required
 *
 * @author: Dennis Zyska, Nils Dycke
**/
import * as VueRouter from 'vue-router'
import store from "./store";

const routes = [
    {
        path: "/",
        redirect: "/dashboard"
    },
    {
        path: "/index.html",
        redirect: "/dashboard"
    },
    {
        path: "/dashboard/:catchAll(.*)",
        name: "Dashboard",
        props: true,
        component: () => import('@/components/Dashboard.vue'),
        alias: "/dashboard",
        meta: {requiresAuth: true, toggleSidebar: true, default: true},
    },
    {
        path: "/login",
        component: () => import("@/components/auth/Login.vue"),
        meta: {requiresAuth: false, hideTopbar: true}
    },
    {
        path: "/register",
        component: () => import("@/components/auth/Register.vue"),
        meta: {requiresAuth: false, hideTopbar: true}
    },
    {
        path: "/document/:documentHash",
        component: () => import('@/components/Document.vue'),
        props: true,
        meta: {requiresAuth: true}
    },
    {
        path: "/review/:studySessionHash",
        component: () => import('@/components/Review.vue'),
        props: true,
        meta: {requireAuth: true}
    },
    {
        path: "/study/:studyHash",
        component: () => import("@/components/Study.vue"),
        props: true,
        meta: {requireAuth: true}
    },
    {
        path: "/session/:studySessionHash",
        component: () => import("@/components/StudySession.vue"),
        props: true,
        meta: {requireAuth: true}
    },
    {
        path: "/:catchAll(.*)",
        name: "NotFound",
        component: () => import("@/basic/NotFound.vue"),
        meta: {requiresAuth: false, hideTopbar: true}
    }
]

// create the vue router
const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    hashbang: false,
    routes: routes,
    mode: 'html5',
    root: "/"
})

// add basic access management (requiring login)
router.beforeEach(async (to, from, next) => {
    await store.restored;

    if (to.meta.requiresAuth && store.getters['auth/isAuthenticated'] === false) {
        next("/login");
    } else {
        if (store.getters['auth/isAuthenticated'] && (to.path === '/register' || to.path === '/login')) next('/');
        else next();
    }
})

export default router;