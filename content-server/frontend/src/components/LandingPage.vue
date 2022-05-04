<template>
  <div id="main" style="width:600px;display:inline-block">
    <div class="jumbotron my-auto">
      <h1>{{ page_title }}</h1>
      <h2>{{ page_subtitle }}</h2>

      <div class="logo">
        <img alt="Logo" src="../assets/logo.svg">
      </div>

      <Login></Login>
    </div>
  </div>
</template>

<script>
import Login from "./Login.vue";

export default {
  components: {Login},
  name: "LandingPage",
  data() {
    return {
      page_title: "Peer",
      page_subtitle: "Annotation-based peer review"
    }
  }
}
</script>

<style>
.logo {
  display: block;
  margin-left: auto;
  margin-right: auto;

  width: 60%;
}

img {
  min-width: 200px;
  max-width: calc(min(500px, 100%));
  width: 100%;
}

body {

  font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif ! default;
  text-align: center;
  font-size: calc(min(20px, 14px + 1.0vw));


}

h1 {
  margin-top: 1.0vh;
  font-size: calc(min(36px, 20px + 1.0vw));
}

h2 {
  margin-top: 10px;
  font-size: calc(min(30px, 16px + 1.0vw));
  color: grey;
}
</style>