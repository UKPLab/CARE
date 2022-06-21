<template>
<nav id="topbar" class="navbar navbar-expand-lg navbar-light bg-light">
  <div class="container-fluid">
    <a class="navbar-brand" href="/">PEER Topbar</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navbarSupportedContent">
      <!-- check for additional fields: https://getbootstrap.com/docs/5.0/components/navbar/ -->
    </div>
  </div>
</nav>
</template>

<script>
export default {
  name: "TopBar"
}
</script>

<style scoped>
#topbar {
  max-width:100%;
  width:500px;
}
</style>