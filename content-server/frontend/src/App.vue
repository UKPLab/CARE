<template>
  <div class="row">
    <div class="col-md-8 mx-auto my-4">
        <span v-if="isLoggedIn">
          <a @click="logout">Logout</a>
        </span>
        <router-view></router-view>
      </div>
  </div>
</template>


<script>
  export default {
    created() {
      this.$socket.on('connect', (data) => { console.log('socket connected') });
    },
    computed: {
      isLoggedIn: function() { return this.$store.getters['auth/isAuthenticated'] }
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

<style>
  #mainContainer {
    float: none;
    margin:0 auto;
  }
</style>
