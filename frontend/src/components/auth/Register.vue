<template>
  <div class="row">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            Register
            <a class="btn btn-sm btn-primary" href="#" @click="this.$router.push('/login')">Login</a>
          </div>

          <div class="card-body mx-4 my-4">
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="first_name">First name</label>
              <div class="col-md-6">
                <input id="first_name" v-model="first_name" autofocus class="form-control" name="first_name" required
                       type="text">
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="last_name">Last name</label>
              <div class="col-md-6">
                <input id="last_name" v-model="last_name" class="form-control" name="last_name" required type="text">
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="user_name">Username</label>
              <div class="col-md-6">
                <input id="user_name" v-model="user_name" class="form-control" name="user_name" required type="text">
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="email">E-Mail</label>
              <div class="col-md-6">
                <input id="email" v-model="email" class="form-control" name="email" required type="text">
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="password">Password</label>
              <div class="col-md-6">
                <input id="password" v-model="password" class="form-control" name="password" required type="password">
              </div>
            </div>

            <div class="form-group row my-2">
              <div class="col-md-6 offset-md-4">
                <label>
                  <input v-model="terms" name="terms" type="checkbox"> I accept the <a href="#"
                                                                                       v-on:click="this.$refs.terms.open()">terms</a>!
                </label>
              </div>
            </div>

            <!-- Remove for now, as it is redundant
            <div class="form-group row my-2">
              <div class="col-md-6 offset-md-4">
                <label>
                  <input v-model="stats" name="stats" type="checkbox"> I allow the collection of <a href="#" v-on:click="this.$refs.stats.open()">anonymous statistics</a>!
                </label>
              </div>
            </div>
            -->

            <div class="col-md-6 offset-md-4">
              <button class="btn btn-primary" type="button" @click="register_user()">Register</button>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <TermsModal ref="terms"></TermsModal>
</template>

<script>
/* Register.vue - registration component

This component provides a basic mask to enter user information
and register a user on the server.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import {mapActions} from "vuex";
import TermsModal from "./TermsModal.vue";

export default {
  name: "Register",
  components: {TermsModal},
  data() {
    return {
      first_name: "",
      last_name: "",
      user_name: "",
      email: "",
      password: "",
      terms: false,
      stats: false,
    }
  },
  methods: {
    ...mapActions({register: "auth/register"}),
    async register_user() {
      try {
        let response = await this.register({
          first_name: this.first_name,
          last_name: this.last_name,
          user_name: this.user_name,
          email: this.email,
          password: this.password,
          terms: this.terms,
          stats: this.stats,
        });

        if (response.statusText === "Created") {
          this.eventBus.emit('toast', {
            message: "The user registration was successful",
            title: "User Registration Complete",
            variant: 'success'
          });

          await this.$router.push("/login");
        }
      } catch (err) {
        this.eventBus.emit('toast', {
          message: err.response.data,
          title: "Invalid User Credentials",
          variant: 'danger'
        });
      }
    }
  }
}
</script>

<style scoped>

</style>