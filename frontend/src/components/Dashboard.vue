<template>
  <Loading v-if="navElements === null || settings === null" />
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column dashboard-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div
          id="sidebarContainer"
          class="col border mh-100  col-sm-auto g-0"
        >
          <Sidebar />
        </div>
        <div
          id="viewerContainer"
          class="col border mh-100 justify-content-center p-3"
          style="overflow-y: scroll;"
        >
          <component
            :is="currentComponent"
            :key="$route.path"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Sidebar from "./navigation/Sidebar.vue";
import {defineAsyncComponent} from "vue";
import Loading from "@/basic/Loading.vue";
import Dashboard from "./Dashboard.vue";
import NotFoundPage from "@/basic/NotFound.vue";

/* Dashboard.vue - Dashboard Handler

This view shows the dashboard after login and loads the navigation components
including the sidebar

Author: Dennis Zyska, Nils Dycke
Source: -
*/
export default {
  name: "Dashboard",
  components: {Loading, Sidebar},
  props: ["catchAll"],
  computed: {
    navElements() {
      return this.$store.getters['navigation/getSidebarElementsFlat'];
    },
    settings() {
      return this.$store.getters['settings/getSettings'];
    },
    currentComponent() {
      if (this.navElements === null || this.settings === null) {
        return Loading;
      } else {

        let component = this.navElements.find(element => element.name === this.$route.name);
        if (component === undefined) {
          component = this.navElements.find(e => e.name === this.settings["dashboard.navigation.component.default"]);
        }
        return defineAsyncComponent(
            {
              loader: () => import("./dashboard/" + component.component + ".vue"),
              loadingComponent: Loading,
              errorComponent: NotFoundPage
            });
      }
    },
  },
  watch: {
    navElements(newValue, oldValue) {
      this.createNavigation();
    }
  },
  mounted() {
    this.$socket.emit("settingGetNavigation");
    this.createNavigation();

    console.log("CURRENT ROUTE === ", this.$route);
  },
  methods: {


    async createNavigation() {

      if (this.navElements === null) return;

      const children = this.navElements.map(e => {
        const child = {
          name: e.name,
          alias: (e.alias !== undefined && e.alias !== null) ? e.alias : [],
          path: "/dashboard/" + e.path,
          component: () => import('@/basic/Loading.vue'),
        };
        if ("navigation.dashboard.component.default" in this.settings &&
            child.name === this.settings["navigation.dashboard.component.default"]) {
          child.alias.push("/dashboard");
        }

        return child;
      });

      const routes = {
        path: "/dashboard",
        name: "Dashboard",
        component: Dashboard,
        meta: {requiresAuth: true, toggleSidebar: true},
      };

      // Add new Routes
      this.$router.addRoute(routes);
      children.forEach(child => this.$router.addRoute("Dashboard", child));

      // Push current browser url to route
      if (this.catchAll !== undefined) {
        await this.$router.push("/dashboard/" + this.catchAll);
      }

    }
  }
}
</script>

<style scoped>
.dashboard-wrapper {
  margin-top: -52.5px;
}

#viewerContainer::-webkit-scrollbar {
  display:none;
}

</style>
