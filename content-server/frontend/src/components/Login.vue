<template>
  <button type="button" class="btn btn-primary" @click="guest_login2()">Login as Guest</button>
  <button type="button" class="btn btn-primary" @click="guest_login3()">Login as Failure</button>
</template>

<script>
import { mapActions } from "vuex";
import axios from "axios";

export default {
  name: "Login",
  data() {
    return {
      showError: false
    }
  },
  methods: {
    ...mapActions(["auth/GuestLogin"]),
    guest_login2() {
      axios.post('/auth/guest_login', {username: "guest", password:"guestguest"});
    },
        guest_login3() {
      axios.post('/auth/guest_login', {username: "guest", password:"adsfadsf"});
    },
    async guest_login() {
      try {
        await this.GuestLogin()
        {
          await this.$router.push("/");
          this.showError = false;
        }
      } catch(error) {
        this.showError = true;
      }
    }
  },
}
</script>

<style scoped>

</style>