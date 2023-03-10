<template>
  <TopBar v-if="!hideTopbar" />
  <Toast />
  <router-view class="top-padding" />
</template>

<script>
import Toast from "@/basic/Toast.vue";
import TopBar from "@/basic/Topbar.vue";

/**
 * Main App Component
 *
 * @author Dennis Zyska, Nils Dycke
 */
export default {
  name: "App",
  components: {TopBar, Toast},
  sockets: {
    logout: function () {
      this.$router.push("/login");
    }
  },
  computed: {
    hideTopbar() {
      return this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar;
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
    this.$socket.emit("settingGetAll");
  },
}
</script>

<style>
.top-padding {
  padding-top: 52.5px;
}
</style>
