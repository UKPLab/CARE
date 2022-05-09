<template>
      <Login></Login>
</template>

<script>
import Login from "./Login.vue";

export default {
  components: {Login},
  name: "LandingPage",
  data() {
    return {
      page_title: "Peer",
      page_subtitle: "Annotation-based peer review"
    }
  }
}
</script>

<style>
</style>