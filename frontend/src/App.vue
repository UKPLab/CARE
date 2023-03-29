<template>
  <Loader v-if="!appLoaded" :loading="!appLoaded" :text="appLoadText" class="pageLoader"/>
  <div v-else>
    <TopBar v-if="!hideTopbar"/>
    <Toast/>
    <router-view class="top-padding"/>
  </div>
</template>

<script>
import Toast from "@/basic/Toast.vue";
import TopBar from "@/basic/Topbar.vue";
import Loader from "@/basic/Loader.vue";
import {createTable} from "@/store/utils";

/**
 * Main App Component
 *
 * @author Dennis Zyska, Nils Dycke
 */
export default {
  name: "App",
  components: {TopBar, Toast, Loader},
  data() {
    return {
      loaded: {
        tables: false,
        settings: true,
      },
    }
  },
  sockets: {
    logout: function () {
      this.$router.push("/login");
    },
    appTables: function (data) {
      data.forEach((table) => {
        createTable(this.$store, table);
      });
      this.loaded.tables = true;
    },
    appSettings: function (data) {
      this.$store.commit("settings/setSettings", data);
      this.loaded.settings = true;
    },
  },
  computed: {
    hideTopbar() {
      return this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar;
    },
    appLoaded() {
      return this.appLoadPercent === 100;
    },
    appLoadPercent() {
      return Object.values(this.loaded).filter((v) => v).length / Object.values(this.loaded).length * 100;
    },
    appLoadStep() {
      return Object.keys(this.loaded).find((k) => !this.loaded[k]);
    },
    appLoadText() {
      if (this.appLoadPercent < 100) {
        return "Load " + this.appLoadStep + " (" + this.appLoadPercent + "%)";
      }
      return "Loading...";
    },
  },
  watch: {
    $route(to, from) {
      if (to.fullPath !== from.fullPath) {
        this.$socket.emit("stats", {action: "routeStep", data: {from: from.fullPath, to: to.fullPath}});
      }
    }
  },
  mounted() {
    this.$socket.emit("appInit");
  },
}
</script>

<style>
.top-padding {
  padding-top: 52.5px;
}

.pageLoader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%)
}
</style>
