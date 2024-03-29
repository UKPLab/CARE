<template>
  <div v-if="requireAuth">
    <TopBar v-if="!hideTopbar"/>
    <div v-if="!appLoaded" class="pageLoader">
      <Loader :loading="!appLoaded" :text="appLoadText"/>
    </div>
    <div v-else>
      <router-view class="top-padding"/>
    </div>
  </div>
  <div v-else>
    <router-view/>
  </div>
  <Toast/>
</template>

<script>
import Toast from "@/basic/Toast.vue";
import TopBar from "@/basic/navigation/Topbar.vue";
import Loader from "@/basic/Loading.vue";
import {createTable} from "@/store/utils";
import axios from 'axios';
import getServerURL from "@/assets/serverUrl";

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
        users: false,
        tables: false,
        settings: false,
      },
    }
  },
  sockets: {
    connect() {
      this.$socket.emit("appInit");
    },
    logout: function () {
      // if not authenticated, backend will always send logout event
      this.$socket.disconnect();
      this.$router.push({name: "login", query: {redirectedFrom: this.$route.path}});
    },
    appTables: function (data) {
      data.forEach((table) => {
        createTable(this.$store, table);
      });
      this.loaded.tables = true;
    },
    appUser: function (data) {
      this.$store.commit("auth/SET_USER", data);
      this.loaded.users = true;
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
      if (!this.$store.connected) {
        return "Connecting...";
      }
      if (this.appLoadPercent < 100) {
        return "Load " + this.appLoadStep + " (" + this.appLoadPercent + "%)";
      }
      return "Loading...";
    },
    requireAuth() {
      return this.$route.meta.requireAuth !== undefined && this.$route.meta.requireAuth;
    },
  },
  watch: {
    $route(to, from) {
      if (to.fullPath !== from.fullPath) {
        this.$socket.emit("stats", {action: "routeStep", data: {from: from.fullPath, to: to.fullPath}});
      }
    },
    "$route.meta.requireAuth"(newValue, oldValue) {
      if (newValue !== oldValue) {
        if (newValue && !this.$socket.connected) {
          this.$socket.connect();
        }
      }
    }
  },
  mounted() {
    this.$router.isReady().then(async () => {
      if (this.$route.meta.checkLogin) {
        // Check if user already authenticated, if so, we redirect him to the dashboard.
        const response = await axios.get(getServerURL() + '/auth/check',
            {withCredentials: true});
        if (response.data.user) {
          await this.$router.push("/dashboard");
        }
      }
    });

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
