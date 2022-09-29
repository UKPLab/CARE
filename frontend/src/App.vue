<template>
  <Topbar v-if="!hideTopbar"></Topbar>
  <Toast ></Toast>
  <router-view class="top-padding"></router-view>
</template>

<script>
import Toast from "./components/dashboard/Toast.vue";
import Topbar from "./components/navigation/Topbar.vue";
export default {
  components: {Topbar, Toast},
  watch: {
    '$route' (to, from) {
      if(to.fullPath !== from.fullPath){
        this.$socket.emit("stats", {action: "routeStep", data: {from: from.fullPath, to: to.fullPath}});
      }
    }
  },
  computed: {
    hideTopbar() {
      return this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar;
    }
  },
  mounted() {
    console.log("Test:")
    console.log(this.$route.meta);

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
