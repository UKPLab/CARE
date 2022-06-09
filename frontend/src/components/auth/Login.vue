<template>
    <div class="row">
    <div class="col-md-8 mx-auto my-4">
  <div class="col-md-8 mx-auto">
     <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        Login
        <a href="#" class="btn btn-sm btn-primary" @click="this.$router.push('/register')">Register</a>
      </div>

      <div class="card-body">

        <p v-if="showError" class="text-danger text-center">{{ this.errorMessage }}</p>
        <div class="form-group row my-2">
          <label for="username" class="col-md-4 col-form-label text-md-right">Username</label>
          <div class="col-md-6">
            <input v-model="username" type="text" id="username" placeholder="Username or email" class="form-control" autocomplete="username" required autofocus>
          </div>
        </div>

        <div class="form-group row my-2">
          <label for="password" class="col-md-4 col-form-label text-md-right">Password</label>
          <div class="col-md-6">
            <input v-model="password" name="password" id="password" class="form-control" type="password" placeholder="Password" autocomplete="current-password" required>          </div>
        </div>

        <div class="col-md-6 offset-md-4 my-4">
            <button type="button" class="btn btn-primary btn-block" @click="login_user()">Login</button>
            <a href="#" class="btn btn-link" @click="login_guest()">Login as Guest</a>
        </div>
      </div>
     </div>
  </div>
    </div>
    </div>
</template>

<script>
/* Login.vue - login component

This component provides a form to enter user credentials and hereby
login on the server. It links to the registration component.

Author: Dennis Zyska (zyska@ukp...)
Co-Author:  Nils Dycke (dycke@ukp...)
Source: -
*/
import { mapActions } from "vuex";

export default {
  name: "Login",
  data() {
    return {
      showError: false,
      errorMessage: "",
      username: "",
      password: ""
    }
  },
  mounted() {
    this.check();
  },
  methods: {
    ...mapActions({login: "auth/login", check: "auth/check"}),
    async login_user() {
      try {
        await this.login({username: this.username, password: this.password})
        {
          await this.$router.push("/");
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        console.log(error);
        this.errorMessage = error;
      }
    },
    register() {
      this.$router.push("/register");
    },
    async login_guest() {
      try {
        await this.login({username: "guest", password: "guestguest"})
        {
          await this.$router.push("/");
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        console.log(error);
        this.errorMessage = error;
      }

    },
  }
}
</script>

<style scoped>

</style>