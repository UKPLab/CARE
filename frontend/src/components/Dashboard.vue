<template>
  <div class="row">
    <div class="col-md-8 mx-auto my-4">
      <div>
        <p v-if="isAdmin"></p>
        <h3 v-if="isAdmin">User Area</h3>
        <DocumentManager></DocumentManager>
      </div>
      <div v-if="isAdmin">
        <p></p>
        <h3>Admin Area</h3>
        <ReviewManager ></ReviewManager>
      </div>
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

import DocumentManager from "./dashboard/documents/DocumentManager.vue";
import ReviewManager from "./dashboard/review/ReviewManager.vue";

export default {
  name: "Dashboard",
  components: {DocumentManager, ReviewManager},
  created() {
    this.$socket.on('connect', (data) => {
      console.log('socket connected')
    });
  },

  computed: {
    isAdmin: function() {
      return this.$store.getters['auth/isAdmin']
    }
  },

  sockets: {
    connect: function () {
      console.log('socket connected')
    },
    logout: function (data) {
      this.$router.push("/login");
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