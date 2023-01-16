<template>
  <div class="row">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            Login
            <a class="btn btn-sm btn-primary" @click="this.$router.push('/register')">Register</a>
          </div>

          <div class="card-body mx-4 my-4">

            <p v-if="showError" class="text-danger text-center">{{ this.errorMessage }}</p>
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="username">Username</label>
              <div class="col-md-6">
                <input id="username" v-model="username" v-on:keyup.enter="$refs.password.focus()"  autocomplete="username" autofocus class="form-control"
                       placeholder="Username or email" required type="text">
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="password">Password</label>
              <div class="col-md-6">
                <input id="password" ref="password" v-model="password" autocomplete="current-password" class="form-control"
                       name="password" v-on:keyup.enter="login_user()"
                       placeholder="Password" required type="password"></div>
            </div>

            <div class="col-md-6 offset-md-4 my-4">
              <button class="btn btn-primary btn-block" type="button" @click="login_user()">Login</button>
              <a v-if="guestLogin" class="btn btn-link" href="#" @click="login_guest()">Login as Guest</a>
            </div>
          </div>
        </div>
        <div class="text-center">{{ copyright }}</div>
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
import {mapActions} from "vuex";

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
  computed: {
    copyright() {
      return window.config['app.config.copyright'];
    },
    guestLogin() {
      return window.config['app.login.guest'] === 'true';
    },
  },
  methods: {
    ...mapActions({login: "auth/login", check: "auth/check"}),
    async login_user() {
      try {
        await this.login({username: this.username, password: this.password})
        {
          await this.$router.go(0);
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
        await this.login({username: "guest", password: "guestguest"});
        {
          await this.$router.go(0);
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