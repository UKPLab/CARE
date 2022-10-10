<template>
  <Loading v-if="navElements === null || settings === null"></Loading>
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column sidebar-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden">
        <div id="sidebarContainer" class="col border mh-100  col-sm-auto g-0" style="overflow-y: scroll;">
          <Sidebar></Sidebar>
        </div>
        <div id="viewerContainer" class="col border mh-100 justify-content-center p-3" style="overflow-y: scroll;">
          <router-view></router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import Sidebar from "./navigation/Sidebar.vue";
import {defineAsyncComponent} from "vue";
import Loading from "./basic/Loading.vue";


export default {

  name: "Dashboard",
  components: {Loading, Sidebar},
  props: ["catchAll"],
  computed: {
    navElements() {
      return this.$store.getters['navigation/getNavElements'];
    },
    settings() {
      return this.$store.getters['settings/getSettings'];
    },
  },
  watch: {
    navElements(newValue, oldValue) {
      this.createNavigation();
    }
  },
  mounted() {
    this.$socket.emit("getSettings");
    this.createNavigation();
  },
  methods: {
    async createNavigation() {
      if (this.navElements === null) return;
      const children = await Promise.all(this.navElements.map(async e => ({
        name: e.name,
        alias: (e.alias !== undefined && e.alias !== null) ? e.alias : [],
        path: e.path,
        component: defineAsyncComponent(
            {loader: () => import("./dashboard/" + e.component + ".vue"), loadingComponent: Loading})
      })));

      const routes = {
        path: "/dashboard",
        name: "Dashboard",
        alias: ["/dashboard", "/", "/index.html"],
        component: defineAsyncComponent(() => import('./Dashboard.vue')),
        meta: {requiresAuth: true, toggleSidebar: true},

      };

      // Add new Routes
      this.$router.addRoute(routes);
      children.forEach(child => this.$router.addRoute("Dashboard", child));

      // Push current browser url to route
      if (this.catchAll !== undefined) {
        await this.$router.push("/dashboard/" + this.catchAll);
      }
      if (this.$route.meta.default) {
        await this.$router.push("/dashboard/" + this.navElements.find(e => e.default).path);
      }

    }
  }
}
</script>

<style scoped>
.sidebar-wrapper {
  display: flex;
}

</style>