<template>
  <Topbar v-if="!hideTopbar"></Topbar>
  <Toast></Toast>
  <router-view class="top-padding"></router-view>
</template>

<script>
import Toast from "./components/basic/Toast.vue";
import Topbar from "./components/navigation/Topbar.vue";

export default {
  components: {Topbar, Toast},
  watch: {
    '$route'(to, from) {
      if (to.fullPath !== from.fullPath) {
        this.$socket.emit("stats", {action: "routeStep", data: {from: from.fullPath, to: to.fullPath}});
      }
    }
  },
  computed: {
    hideTopbar() {
      return this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar;
    },
    authenticated() {
      return this.$store.getters['auth/isAuthenticated'];
    }
  },
  mounted() {
    // Load application data on startup
    if (this.authenticated) {
      this.$socket.emit("tagSetGetAll");
      this.$socket.emit("tagGetAll");
      this.$socket.emit("settingGetAll");
      this.$socket.emit("documentGetAll");
    }
    // TODO: wait for all data to be loaded before rendering the page
    // show loading screen until all data is loaded
  },
  sockets: {
    logout: function (data) {
      this.$router.push("/login");
    }
  }
}
</script>

<style>
.top-padding {
  padding-top: 52.5px;
  /* if this is changed - also change offset */
}
</style>
