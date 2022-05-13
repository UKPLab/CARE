<template>
  <router-view></router-view>
  <span>Welcome!</span>
</template>

<script>
export default {
  name: "Dashboard",
  created() {
      this.$socket.on('connect', (data) => { console.log('socket connected') });
    },
    methods: {
      async logout() {
        await this.$store.dispatch('auth/logout');
        await this.$router.push("/");
      }
    },
  sockets: {
      connect: function () {
        console.log('socket connected')
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