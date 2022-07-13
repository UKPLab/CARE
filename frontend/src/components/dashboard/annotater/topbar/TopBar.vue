<template>
  <nav id="top-navbar" class="navbar fixed-top navbar-expand-lg navbar-light bg-light">
    <div id="top-container" class="container-fluid">
      <a class="navbar-brand" href="/">PEER</a>
      <div id="navbarSupportedContent" class="collapse navbar-collapse">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
          <li class="nav-item">
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
}
</script>

<style scoped>

#top-navbar {
  width: 100%;
  position: absolute;
}

#top-container {
  padding-left: 10px;
  padding-right: 5px;
}
</style>