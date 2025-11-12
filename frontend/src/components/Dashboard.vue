<template>
  <Loading v-if="navElements > 0 || settings === null" />
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column dashboard-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div 
          v-if="hasComponentAccess"
          id="sidebarContainer"
          class="col border mh-100 col-sm-auto g-0"
        >
          <Sidebar />
        </div>
        <div
          id="viewerContainer"
          class="col border mh-100 justify-content-center p-3"
          style="overflow-y: scroll"
        >
          <NotFoundPage v-if="!hasComponentAccess" />
          <component
            v-else
            :is="currentComponent"
            :key="$route.path"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Dashboard Component
 *
 * This view shows the dashboard after login and loads the navigation components
 * including the sidebar
 *
 * @author: Dennis Zyska, Nils Dycke
 */
import Sidebar from "./dashboard/navigation/Sidebar.vue";
import { defineAsyncComponent } from "vue";
import Loading from "@/basic/Loading.vue";
import NotFoundPage from "@/auth/NotFound.vue";

export default {
  name: "DashboardRoute",
  subscribeTable: ["nav_element"],
  components: { Loading, Sidebar, NotFoundPage },
  props: {
    catchAll: {
      type: String,
      default: undefined,
    },
  },
  computed: {
    navElements() {
      return this.$store.getters["table/nav_element/getAll"];
    },
    settings() {
      return this.$store.getters["settings/getSettings"];
    },
    defaultComponent() {
      if (this.settings && "dashboard.navigation.component.default" in this.settings) {
        return this.navElements.find((e) => e.name.toLowerCase() === this.settings["dashboard.navigation.component.default"].toLowerCase());
      }
      return undefined;
    },
    currentComponent() {
      let component = undefined;
      if (this.navElements.length > 0 && this.catchAll !== undefined) {
        component = this.navElements.find((element) => element.path.toLowerCase() === this.catchAll.toLowerCase());
      }
      if (component === undefined && this.defaultComponent) {
        component = this.defaultComponent;
      }
      if (component !== undefined) {
        return defineAsyncComponent({
          loader: () => import("./dashboard/" + component.component + ".vue"),
          loadingComponent: Loading,
          errorComponent: NotFoundPage,
        });
      } else {
        return Loading;
      }
    },
    hasComponentAccess() {
      // Find the current component from navElements
      let component = undefined;
      if (this.navElements.length > 0 && this.catchAll !== undefined) {
        component = this.navElements.find((element) => element.path.toLowerCase() === this.catchAll.toLowerCase());
        console.log('[Dashboard] Looking for component with catchAll:', this.catchAll, 'Found:', component);
      }
      if (component === undefined && this.defaultComponent) {
        component = this.defaultComponent;
        console.log('[Dashboard] Using default component:', component);
        return true;
      }
      
      // If no component found, allow Loading to display
      if (component === undefined) {
        console.log('[Dashboard] No component found, showing Loading');
        return true;
      }
      
      // Check if user has the required right for this component
      const requiredRight = `frontend.dashboard.${component.path}.view`;
      const hasAccess = this.$store.getters["auth/checkRight"](requiredRight);
      console.log('[Dashboard] Access check - Required right:', requiredRight, 'Has access:', hasAccess);
      return hasAccess;
    },
  },
};
</script>

<style scoped>
.dashboard-wrapper {
  margin-top: -52.5px;
}

#viewerContainer::-webkit-scrollbar {
  display: none;
}
</style>
