<template>
  <Toast ></Toast>
  <router-view></router-view>
</template>

<script>
import Toast from "./components/dashboard/Toast.vue";
export default {
  components: {Toast},
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
</style>
