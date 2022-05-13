import * as VueRouter from 'vue-router'

// Set Vue Routing
import Annotater from "./components/Annotater.vue";
import LandingPage from "./components/LandingPage.vue";
import NotFoundPage from "./components/NotFoundPage.vue";

const routes = [
    { path: "/", component: LandingPage},
    { path: "/index.html", component: LandingPage},
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

export default router;