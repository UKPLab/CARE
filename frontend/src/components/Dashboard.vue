<template>
  <Loading v-if="navElements > 0 || settings === null" />
  <div v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column dashboard-wrapper">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div
          id="viewerContainer"
          class="col mh-100 justify-content-center p-3"
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
import { defineAsyncComponent } from "vue";
import Loading from "@/basic/Loading.vue";
import NotFoundPage from "@/auth/NotFound.vue";


const dashboardModules = import.meta.glob("./dashboard/*.vue");

// One async wrapper per page module. currentComponent re-runs whenever the nav_element
// table or the rights in the store change; a fresh defineAsyncComponent each time is a new
// component type, so Vue unmounted and remounted the whole page (tables refetched, icons and
// buttons rebuilt) on unrelated store updates.
const asyncPageCache = new Map();
function asyncPage(modulePath, loader) {
  if (!asyncPageCache.has(modulePath)) {
    asyncPageCache.set(modulePath, defineAsyncComponent({
      loader,
      loadingComponent: Loading,
      errorComponent: NotFoundPage,
    }));
  }
  return asyncPageCache.get(modulePath);
}

export default {
  name: "DashboardRoute",
  subscribeTable: ["nav_element"],
  components: { Loading, NotFoundPage },
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
        // Check access before loading component
        const requiredRight = `frontend.dashboard.${component.path}.view`;
        const hasAccess = this.$store.getters["auth/checkRight"](requiredRight);
        
        if (!hasAccess) {
          return NotFoundPage;
        }

        const modulePath = `./dashboard/${component.component}.vue`;
        const loader = dashboardModules[modulePath];
        if (!loader) {
          return NotFoundPage;
        }

        return asyncPage(modulePath, loader);
      } else {
        return Loading;
      }
    },
  },
};
</script>

<style scoped>
.dashboard-wrapper {
  margin-top: -52.5px;
}

#viewerContainer {
  min-width: 0;
  overflow-x: hidden;
}

#viewerContainer::-webkit-scrollbar {
  display: none;
}
</style>
