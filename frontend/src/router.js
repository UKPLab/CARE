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
import getServerURL from "@/assets/serverUrl";

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
        name: "register",
        component: () => import("@/auth/Register.vue"),
        meta: {requireAuth: false, hideTopbar: true, checkLogin: true}
    },
    {
        path: "/reset-password/:token?",
        name: "reset-password",
        component: () => import("@/auth/ResetPassword.vue"),
        meta: {requireAuth: false, hideTopbar: true, checkLogin: true}
    },
    {
        path: "/wizard",
        name: "wizard",
        component: () => import("@/auth/SetupWizard.vue"),
        meta: {requireAuth: false, hideTopbar: true}
    },
    {
        path: "/document/:documentHash",
        component: () => import('@/components/Document.vue'),
        props: true,
        meta: {requireAuth: true}
    },
    {
        path: "/review/:studySessionHash", // Review link
        component: () => import('@/components/StudySession.vue'),
        props: true,
        meta: {requireAuth: true, readOnly: true}
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
        meta: {requireAuth: true, readOnly: false}
    },
    {
        path: "/:catchAll(.*)",
        name: "NotFound",
        component: () => import("@/auth/NotFound.vue"),
        meta: {requireAuth: false, hideTopbar: true}
    },
]

// create the vue router
const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    hashbang: false,
    routes: routes,
    mode: "html5",
    root: "/",
});

/**
 * If the user is logged in and the setup wizard is not completed, redirect to /wizard
 * so they cannot bypass it by typing /dashboard, /login, etc.
 */
router.beforeEach(async (to, from, next) => {
    if (to.path === "/wizard") return next();
    if (!to.meta.requireAuth && !to.meta.checkLogin) return next();
    try {
        const r = await fetch(getServerURL() + "/auth/check", { credentials: "include" });
        if (!r.ok) return next();
        const d = await r.json();
        if (d.user && d.wizardCompleted === false) {
            return next({ path: "/wizard" });
        }
    } catch (_) {}
    next();
});

// Navigation guard to check if self-registration is enabled
router.beforeEach((to, from, next) => {
    // Check if trying to access register page
    if (to.name === "register") {
        // Check if self-registration is enabled
        const isSelfRegistrationEnabled = window.config && window.config["app.register.enabled"] === "true";
        if (!isSelfRegistrationEnabled) {
            // Redirect to login
            next({
                name: "login",
                query: { 
                    redirectedFrom: to.query.redirectedFrom,
                    registrationDisabled: "true"
                }
            });
            return;
        }
    }
    next();
});

export default router;