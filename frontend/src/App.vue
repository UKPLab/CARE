<template>
  <Toast ></Toast>
  <Topbar></Topbar>
  <div class="website-wrapper">
    <Navigation></Navigation>
    <router-view></router-view>
  </div>
</template>

<script>
import Toast from "./components/dashboard/Toast.vue";
import Navigation from "./components/navigation/Navigation.vue";
import Topbar from "./components/navigation/Topbar.vue";
export default {
  components: {Toast, Navigation, Topbar},
  watch: {
    '$route' (to, from) {
      if(to.fullPath !== from.fullPath){
        this.$socket.emit("stats", {action: "routeStep", data: {from: from.fullPath, to: to.fullPath}});
      }
    }
  }
}
</script>

<style>
.website-wrapper {
  display:flex;
  }
</style>
