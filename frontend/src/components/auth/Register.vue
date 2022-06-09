<template>
    <div class="row">
    <div class="col-md-8 mx-auto my-4">
  <div class="col-md-8 mx-auto">
     <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        Register
        <a href="#" class="btn btn-sm btn-primary" @click="this.$router.push('/login')">Login</a>
      </div>

      <div class="card-body">
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
      </div>
     </div>
  </div>
    </div>
    </div>

</template>

<script>
/* Register.vue - registration component

This component provides a basic mask to enter user information
and register a user on the server.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
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
      let response = await this.register({
        first_name: this.first_name,
        last_name: this.last_name,
        user_name: this.user_name,
        email: this.email,
        password: this.password,
        terms: this.terms,
      });
      console.log(response);
      if (response.statusText === "Created") {
        await this.$router.push("/login");
      }
    }
  }
}
</script>

<style scoped>

</style>