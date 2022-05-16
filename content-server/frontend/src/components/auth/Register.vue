<template>
  <div class="form-group row my-2">
    <label for="first_name" class="col-md-4 col-form-label text-md-right">First name</label>
    <div class="col-md-6">
      <input v-model="first_name"  type="text" id="first_name" class="form-control" name="first_name" required autofocus>
    </div>
  </div>

  <div class="form-group row my-2">
    <label for="last_name" class="col-md-4 col-form-label text-md-right">Last name</label>
    <div class="col-md-6">
      <input v-model="last_name"  type="text" id="last_name" class="form-control" name="last_name" required>
    </div>
  </div>

  <div class="form-group row my-2">
    <label for="user_name" class="col-md-4 col-form-label text-md-right">Username</label>
    <div class="col-md-6">
      <input v-model="user_name"  type="text" id="user_name" class="form-control" name="user_name" required>
    </div>
  </div>

   <div class="form-group row my-2">
    <label for="email" class="col-md-4 col-form-label text-md-right">E-Mail</label>
    <div class="col-md-6">
      <input v-model="email"  type="text" id="email" class="form-control" name="email" required>
    </div>
  </div>

  <div class="form-group row my-2">
    <label for="password" class="col-md-4 col-form-label text-md-right">Password</label>
    <div class="col-md-6">
      <input v-model="password"  type="password" id="password" class="form-control" name="password" required>
    </div>
  </div>

  <div class="form-group row my-2">
    <div class="col-md-6 offset-md-4">
      <label>
        <input v-model="terms"  type="checkbox" name="terms"> I accept the terms!
      </label>
    </div>
  </div>

  <div class="col-md-6 offset-md-4">
    <button type="button" class="btn btn-primary" @click="register_user()">Register</button>

  </div>

</template>

<script>
import { mapActions } from "vuex";

export default {
  name: "Register",
  data() {
    return {
      first_name: "",
      last_name: "",
      user_name: "",
      email: "",
      password: "",
      terms: false,
    }
  },
  methods: {
    ...mapActions({register: "auth/register"}),
    async register_user() {
      await this.register({
        first_name: this.first_name,
        last_name: this.last_name,
        user_name: this.user_name,
        email: this.email,
        password: this.password,
        terms: this.terms,
      });
    }
  }
}
</script>

<style scoped>

</style>