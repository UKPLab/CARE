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

// Set Vue Routing
import Annotater from "./components/dashboard/annotater/Annotater.vue";
import Dashboard from "./components/Dashboard.vue";
import NotFoundPage from "./components/NotFoundPage.vue";
import Login from "./components/auth/Login.vue";
import Register from "./components/auth/Register.vue";

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
    { path: "/", component: Dashboard, meta: { requiresAuth: true }},
    { path: "/index.html", component: Dashboard, meta: { requiresAuth: true }},
    { path: "/login", component: Login, meta: { requiresAuth: false }},
    { path: "/register", component: Register, meta: { requiresAuth: false }},
    { path: "/annotate/:pdf_path", component: Annotater, props: true, meta: { requiresAuth: true } },
    { path: "/:catchAll(.*)", name: "NotFound", component: NotFoundPage, meta: { requiresAuth: false }}
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
    if (to.meta.requiresAuth && store.getters['auth/isAuthenticated'] === false) next("/login");
    else {
        if (store.getters['auth/isAuthenticated'] && (to.path === '/register' || to.path === '/login')) next('/');
        else next();
    }
})

export default router;