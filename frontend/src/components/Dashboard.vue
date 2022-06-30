<template>
    <div class="row">
    <div class="col-md-8 mx-auto my-4">
   <List></List>
  <a href="#" @click="logout()">Logout</a>
    </div>
    </div>
</template>

<script>
/* Dashboard.vue - user-specific dashboard

This component provides the user-specific view of the app.
It includes a websocket to synchronize with the backend and
loads all further sub-components.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import List from "./dashboard/documents/List.vue";

export default {
  name: "Dashboard",
  components: {List},
  created() {
      this.$socket.on('connect', (data) => { console.log('socket connected') });
    },

  sockets: {
      connect: function () {
        console.log('socket connected')
      }
    },
  methods: {
      async logout() {
        await this.$store.dispatch('auth/logout');
        await this.$router.push("/login");
      }
    },
}
</script>

<style scoped>
</style>