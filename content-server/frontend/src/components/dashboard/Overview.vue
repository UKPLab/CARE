<template>
  <span> Welcome!</span>
  <a href="#" @click="logout()">Logout</a>
</template>

<script>
export default {
  name: "Overview",
   methods: {
      async logout() {
        await this.$store.dispatch('auth/logout');
        await this.$router.push("/");
      }
    },
}
</script>

<style scoped>

</style>