<template>
  <div class="row">
    <div class="col-md-8 mx-auto my-4">
        <Dashboard v-if="isLoggedIn"></Dashboard>
        <LandingPage v-else></LandingPage>
    </div>
  </div>
</template>

<script>
  import LandingPage from "./components/LandingPage.vue";
  import Dashboard from "./components/Dashboard.vue";

  export default {
    components: {LandingPage, Dashboard},
    computed: {
      isLoggedIn: function() { return this.$store.getters['auth/isAuthenticated'] }
    },
  }
</script>

<style>
  #mainContainer {
    float: none;
    margin:0 auto;
  }
</style>
