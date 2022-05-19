<template>
    <div class="row">
    <div class="col-md-8 mx-auto my-4">
   <List></List>
  <a href="#" @click="logout()">Logout</a>
    </div>
    </div>
</template>

<script>
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
   mounted() {
     //this.$socket.emit("push_pdf", {"key": "value"});

     /*this.sockets.subscribe("topic", data => {
       console.log("Received message on topic");
       console.log(data);
     });*/
   }
}
</script>

<style scoped>
</style>