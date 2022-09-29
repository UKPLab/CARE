<template>
  <div class="nav-container" id="wrapper">
    <div class="border-end bg-white" id="sidebar-wrapper">
      <div class="list-group list-group-flush">
        <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">Dashboard</a>
        <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">Shortcuts</a>
        <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">Overview</a>
        <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">Events</a>
        <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">Profile</a>
        <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">Status</a>
      </div>
    </div>
  </div>
</template>

<script>
/* Sidebar.vue - topbar and side toolbar  

This component provides both a topbar and left toggleable side toolbar.

Author: Carly Gettinger (cjgettinger@gmail.com)
Co-Author: 
Source: left toggleable toolbar - simple sidebar found at https://github.com/StartBootstrap/startbootstrap-simple-sidebar
*/

export default {
  name: "Sidebar",
  methods: {
    toggleSidebar() {
          document.body.classList.toggle('sb-sidenav-toggled');
    }
  },
}

</script>

<style>

#sidebar-wrapper {
    min-height: 100vh;
    margin-left: -15rem;
    -webkit-transition: margin .25s ease-out;
    -moz-transition: margin .25s ease-out;
    -o-transition: margin .25s ease-out;
    transition: margin .25s ease-out;
}

#sidebar-wrapper .list-group {
    width: 15rem;
}

body.sb-sidenav-toggled #wrapper #sidebar-wrapper {
    margin-left: 0;
}

@media (min-width: 768px) {
    #sidebar-wrapper {
        margin-left: 0;
    }

    #page-content-wrapper {
        min-width: 0;
        width: 100%;
    }

    body.sb-sidenav-toggled #wrapper #sidebar-wrapper {
        margin-left: -15rem;
    }
}

</style>
