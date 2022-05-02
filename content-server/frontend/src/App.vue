<script>
  export default {
    created() {
      this.$socket.on('connect', (data) => { console.log('socket connected') });
    },
    computed: {},
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

<template>
  <router-view></router-view>
</template>

<style>
</style>
