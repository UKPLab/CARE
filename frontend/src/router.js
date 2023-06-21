/**
 * Specifies all Vue routes in one file. Add new routes here to the "routes" attribute.
 * Additionally, the vue router is configured and basic user authentication to routes
 * that require a login is realized.
 *
 * Pass metadata via the meta attribute. Current supported fields:
 * > requireAuth: true/false <=> true, iff a login is required
 *
 * @author: Dennis Zyska, Nils Dycke
**/
import * as VueRouter from 'vue-router'

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
        name: "dashboard",
        props: true,
        component: () => import('@/components/Dashboard.vue'),
        alias: "/dashboard",
        meta: {requireAuth: true, toggleSidebar: true, default: true},
    },
    {
        path: "/login",
        component: () => import("@/auth/Login.vue"),
        name: "login",
        meta: {requireAuth: false, hideTopbar: true, checkLogin: true}
    },
    {
        path: "/register",
        component: () => import("@/auth/Register.vue"),
        meta: {requireAuth: false, hideTopbar: true, checkLogin: true}
    },
    {
        path: "/document/:documentHash",
        component: () => import('@/components/Document.vue'),
        props: true,
        meta: {requireAuth: true}
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
        meta: {requireAuth: false, hideTopbar: true}
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

export default router;