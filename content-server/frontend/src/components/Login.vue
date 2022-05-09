<template>
   <div class="col-md-8">
    <div class="card">
      <div class="card-header">Login</div>
      <div class="card-body">
        <p v-if="showError" class="text-danger text-center">{{ this.errorMessage }}</p>
        <div class="form-group row">
          <label for="username" class="col-md-4 col-form-label text-md-right">Username or E-Mail</label>
          <div class="col-md-6">
            <input v-model="username" type="text" id="username" placeholder="Username or email" class="form-control" autocomplete="username" required autofocus>
          </div>
        </div>

        <div class="form-group row">
          <label for="password" class="col-md-4 col-form-label text-md-right">Password</label>
          <div class="col-md-6">
            <input v-model="password" name="password" id="password" class="form-control" type="password" placeholder="Password" autocomplete="current-password" required>          </div>
        </div>

        <div class="col-md-6 offset-md-4">
            <button type="button" class="btn btn-primary btn-block" @click="login_user()">Login</button>
            <a href="#" class="btn btn-link" @click="login_guest()">Login as Guest</a>

        </div>
      </div>
    </div>
  </div>
</template>

<script>
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
  methods: {
    ...mapActions({login: "auth/login"}),
    async login_user() {
      try {
        await this.login({username: this.username, password: this.password})
        {
          await this.$router.push("/");
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = error;
      }
    },
    login_guest() {
      this.login({username: "guest", password: "guestguest"})
    },
  }
}
</script>

<style scoped>
</style>