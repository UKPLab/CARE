import * as VueRouter from 'vue-router'

// Set Vue Routing
import Annotater from "./components/dashboard/Annotater.vue";
import Overview from "./components/dashboard/Overview.vue";
import NotFoundPage from "./components/NotFoundPage.vue";

const routes = [
    { path: "/", component: Overview},
    { path: "/index.html", component: Overview},
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