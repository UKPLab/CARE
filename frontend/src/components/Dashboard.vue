<template>
  <Loading v-if="!navigationDataReady" />
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column dashboard-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div 
          id="sidebarContainer"
          class="col border mh-100 col-sm-auto g-0"
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
import { resolveNavigationElement } from "./dashboard/navigation/helpers/navElement.js";


const dashboardModules = import.meta.glob("./dashboard/*.vue");

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

      return resolveNavigationElement(this.navElements, this.catchAll, this.settings);
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
