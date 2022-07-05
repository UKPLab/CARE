<template>
<nav id="top-navbar" class="navbar fixed-top navbar-expand-lg navbar-light bg-light">
  <div class="container-fluid" id="top-container">
    <a class="navbar-brand" href="/">PEER</a>
    <div class="collapse navbar-collapse" id="navbarSupportedContent">
      <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
        <li class="nav-item">
          <button class="btn" type="submit" @click="closeSidebar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </li>
      </ul>
    </div>
    <!-- check for additional fields: https://getbootstrap.com/docs/5.0/components/navbar/ -->
  </div>
</nav>
</template>

<script>
export default {
  name: "TopBar",
  methods: {
    closeSidebar(){
      this.$emit("closeSidebar");
    }
  }
}
</script>

<style scoped>

#top-navbar {
  width: 100%;
  position: absolute;
}
#top-container {
  padding-left:10px;
  padding-right:5px;
}
</style>