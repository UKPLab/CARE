<template>
  <button type="button" class="btn btn-primary" @click="guest_login()">Login as Guest</button>
</template>

<script>
import { mapActions } from "vuex";

export default {
  name: "Login",
  data() {
    return {
      showError: false
    }
  },
  methods: {
    ...mapActions(["auth/GuestLogin"]),
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