<template>
  <Loading v-if="!navigationDataReady" />
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column dashboard-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div 
          id="sidebarContainer"
          class="col border h-100 mh-100 col-sm-auto g-0 d-flex flex-column"
        >
          <Sidebar :active-element="activeNavigationElement" />
        </div>
        <div
          id="viewerContainer"
          class="col border mh-100 justify-content-center p-3"
          style="overflow-y: scroll"
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


const dashboardModules = import.meta.glob("./dashboard/*.vue");
const DEFAULT_DASHBOARD_SETTING = "dashboard.navigation.component.default";

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
    navigationDataReady() {
      return Array.isArray(this.navElements) && this.settings !== null && this.settings !== undefined;
    },
    currentNavigationElement() {
      if (!this.navigationDataReady) {
        return null;
      }

      if (!Array.isArray(this.navElements)) {
        return null;
      }

      if (typeof this.catchAll === "string" && this.catchAll.trim()) {
        const explicitElement = this.navElements.find(
          element => element && typeof element.path === "string" && element.path.toLowerCase() === this.catchAll.toLowerCase()
        );
        if (explicitElement) {
          return explicitElement;
        }
      }

      const defaultName = this.settings?.[DEFAULT_DASHBOARD_SETTING];
      if (typeof defaultName !== "string" || !defaultName.trim()) {
        return null;
      }

      return this.navElements.find(
        element => element && typeof element.name === "string" && element.name.toLowerCase() === defaultName.trim().toLowerCase()
      ) || null;
    },
    activeNavigationElement() {
      const element = this.currentNavigationElement;
      if (!element) {
        return null;
      }

      const requiredRight = `frontend.dashboard.${element.path}.view`;
      if (!this.$store.getters["auth/checkRight"](requiredRight)) {
        return null;
      }

      return dashboardModules[`./dashboard/${element.component}.vue`] ? element : null;
    },
    currentComponent() {
      if (!this.navigationDataReady) {
        return Loading;
      }

      const element = this.currentNavigationElement;
      if (!element || !this.activeNavigationElement) {
        return NotFoundPage;
      }

      const loader = dashboardModules[`./dashboard/${element.component}.vue`];
      return defineAsyncComponent({
          loader,
          loadingComponent: Loading,
          errorComponent: NotFoundPage,
      });
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
