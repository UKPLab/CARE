<template>
  <Toast ></Toast>
  <router-view></router-view>
  <button @click="this.$socket.emit('nlp_test', {'test':'test'})">Test</button>
</template>

<script>
import Toast from "./components/dashboard/Toast.vue";
export default {
  components: {Toast}
}
</script>

<style>
</style>
