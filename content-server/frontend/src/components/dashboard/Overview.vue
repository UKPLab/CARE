<template>
  <List></List>
  <a href="#" @click="logout()">Logout</a>
</template>

<script>
import List from "./documents/List.vue";

export default {
  name: "Overview",
  components: {List},
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