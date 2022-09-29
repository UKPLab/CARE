<template>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column sidebar-wrapper">
    <div class="row d-flex flex-grow-1 overflow-hidden">
      <div class="col border mh-100  col-sm-auto g-0" style="overflow-y: scroll;" id="sidebarContainer">
        <Sidebar></Sidebar>
      </div>
      <div class="col border mh-100 justify-content-center p-3" style="overflow-y: scroll;" id="viewerContainer">
        <router-view></router-view>
      </div>
    </div>
  </div>
</template>

<script>

import Sidebar from "./navigation/Sidebar.vue";
export default {

  name: "Dashboard",
  components: {Sidebar},
}
</script>

<style scoped>
.sidebar-wrapper {
  display: flex;
}

</style>