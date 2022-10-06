<template>
  <Loading v-if="navElements === null" ></Loading>
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column sidebar-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden">
        <div class="col border mh-100  col-sm-auto g-0" style="overflow-y: scroll;" id="sidebarContainer">
          <Sidebar></Sidebar>
        </div>
        <div class="col border mh-100 justify-content-center p-3" style="overflow-y: scroll;" id="viewerContainer">
          <router-view></router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import Sidebar from "./navigation/Sidebar.vue";
import Home from "./dashboard/Home.vue";
import { defineAsyncComponent} from "vue";
import Loading from "./Loading.vue";


export default {

  name: "Dashboard",
  components: {Loading, Sidebar},
  props: ["catchAll"],
  computed: {
    navElements() {
      return this.$store.getters['navigation/getNavElements'];
    }
  },
  watch: {
    navElements(newValue, oldValue) {
      this.createNavigation();
    }
  },
  mounted() {
    this.createNavigation();
    console.log(this.catchAll)
  },
  methods: {
    async createNavigation() {
      const children = await Promise.all(this.navElements.map(async e => ({
        name: e.name,
        alias: (e.alias !== undefined) ? e.alias : [],
        path: e.path,
        component: defineAsyncComponent(
            {loader: () => import("./" + e.component + ".vue"), loadingComponent: Loading})
      })));
      console.log(children);

      const routes = {
        path: "/dashboard",
        name: "Dashboard",
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

      console.log(this.navElements);
      console.log(this.$router);
    }
  }
}
</script>

<style scoped>
.sidebar-wrapper {
  display: flex;
}

</style>