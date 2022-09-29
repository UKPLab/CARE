<template>
  <div class="nav-container" id="wrapper">
    <!-- Top navigation-->
    <nav class="navbar navbar-expand-lg navbar-light bg-light border-bottom">
        <div class="container-fluid">
          <div class="left-toggle-logo">
            <a href="#" role="button" title="Toggle sidebar" type="button" id="sidebarToggle" @click="toggleSidebar()">
              <span class="arrow-toggle"></span> 
            </a>
            <a class="navbar-brand" href="#">PEER</a>
          </div>    
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav ms-auto mt-2 mt-lg-0">
            <li class="nav-item active"><a class="nav-link" href="#!">Home </a></li>
            <li class="nav-item"><a class="nav-link" href="#!">Link</a></li>
            <li class="nav-item"><a class="nav-link" id="navbarDropdown" href="#" role="button">Profile</a></li>
          </ul>
        </div>
      </div>
    </nav>
  </div>
</template>

<script>
/* Navigation.vue - topbar and side toolbar  

This component provides both a topbar and left toggleable side toolbar.

Author: Carly Gettinger (cjgettinger@gmail.com)
Co-Author: 
Source:  
*/

export default {
  name: "Topbar",
  methods: {
    toggleSidebar() {
          document.body.classList.toggle('sb-sidenav-toggled');
    }
  },
}

</script>

<style>

.navbar-brand {
  margin-left: 20px;
}

.arrow-toggle {
  border: solid grey;
  border-width: 0 3px 3px 0;
  border-radius: 2px;
  display: inline-block;
  padding: 7px;
  transform: rotate(135deg);
  transition: 0.3s linear;
}

body.sb-sidenav-toggled  .arrow-toggle {
  transform: rotate(-45deg);
  transition: 0.3s linear;
}

.left-toggle-logo {
  display: flex;
  align-items: center;
}



</style>
