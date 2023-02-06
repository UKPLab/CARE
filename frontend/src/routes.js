/* routes.js - Front-end vue routes

Specifies all Vue routes in one file. Add new routes here to the "routes" attribute.
Additionally, the vue router is configured and basic user authentication to routes
that require a login is realized.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import * as VueRouter from 'vue-router'
import store from "./store";


/*
 * Defines the routes for Vue. Each route links to a specific route and by passing
 * meta-data on the type of the route.
 *
 * Add a new route by specifying a path, a component and (if authentication is required) adding suitable metadata.
 *
 * Pass metadata via the meta attribute. Current supported fields:
 * > requiresAuth: true/false <=> true, iff a login is required
 */


const routes = [
    {path: "/", redirect: "/dashboard"},
    {path: "/index.html", redirect: "/dashboard"},
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
        path: "/annotate/:documentHash",
        component: () => import('@/components/Annotater.vue'),
        props: true,
        meta: {requiresAuth: true}
    },
    {
        path: "/report/:documentHash",
        component: () => import('@/components/Annotater.vue'),
        props: route => ({documentHash: route.params.documentHash, readonly: true}),
        meta: {requireAuth: true}
    },
    {
        path: "/study/:studyHash",
        component: () => import("@/components/Study.vue"),
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