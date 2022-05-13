<template>
  <div class="col-md-8 mx-auto">
     <div class="card">
      <div v-if="login" class="card-header d-flex justify-content-between align-items-center">
        Login
        <a href="#" class="btn btn-sm btn-primary" @click="login=false">Register</a>
      </div>
       <div v-else class="card-header d-flex justify-content-between align-items-center">
        Register
        <a href="#" class="btn btn-sm btn-primary" @click="login=true">Login</a>
      </div>
      <div class="card-body">
        <Login v-if="login"></Login>
        <Register v-else></Register>
      </div>
     </div>
  </div>
</template>

<script>
import Login from "./auth/Login.vue";
import Register from "./auth/Register.vue";

export default {
  components: {Login, Register},
  name: "LandingPage",
  data() {
    return {
      login: true,
    }
  },
}
</script>

<style>
</style>