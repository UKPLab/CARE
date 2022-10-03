<template>
  <div class="nav-container" id="wrapper">
    <nav class="navbar fixed-top navbar-expand-lg navbar-light bg-light border-bottom">
      <div class="container-fluid">
        <div class="left-toggle-logo">
          <a href="#" role="button" title="Toggle sidebar" type="button" id="sidebarToggle" @click="toggleSidebar()">
            <span class="arrow-toggle"></span>
          </a>
          <a class="navbar-brand" href="#">PEER</a>
        </div>
        <div id="topbarCustomPlaceholder">

        </div>
          <ul class="navbar-nav ms-auto mt-2 mt-lg-0">
            <li class="nav-item dropdown">
              <div class="dropdown" @click="toggleProfileDropdown()" @focusout="toggleProfileDropdown()">
                <button class="btn btn-secondary dropdown-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                {{ username }}
                </button>
                <div id="dropdown-show" class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuButton">
                  <a class="dropdown-item" href="#">Profile route here!</a>
                  <a class="dropdown-item" href="#" @click="logout()">Logout</a>
                </div>
              </div>
            </li>
          </ul>
      </div>
    </nav>
  </div>
</template>

<script>
/* Sidebar.vue - topbar and side toolbar

This component provides both a topbar and left toggleable side toolbar.

Author: Carly Gettinger (cjgettinger@gmail.com)
Co-Author: 
Source:  
*/

export default {
  name: "Topbar",
  
  data() {
    return {
      username: this.getFirstLetterUsername()
    }
  },
  methods: {
    getFirstLetterUsername() {
      const user = this.$store.getters['auth/getUser'];
      return user.user_name.charAt(0).toUpperCase();
    },
    toggleSidebar() {
      document.body.classList.toggle('sb-sidenav-toggled');
    },
    async logout() {
      await this.$store.dispatch('auth/logout');
      await this.$router.push("/login");
    },
    toggleProfileDropdown() {
      const dropdown = document.getElementById('dropdown-show');
      var close = false;
      if (event.type == 'focusout' ) {
        if(event.relatedTarget != null && event.relatedTarget.classList.contains("dropdown-item")) {
          return;
        }
        close = true;
      }
      this.actuallyToggle(dropdown, close);
    },
    actuallyToggle(dropdownElement, close) {
      if(close || dropdownElement.classList.contains("show")) {
        dropdownElement.classList.remove("show");
      } else {
        dropdownElement.classList.add("show");
      }
    },
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

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(-45deg);
  transition: 0.3s linear;
}

.left-toggle-logo {
  display: flex;
  align-items: center;
}

#dropdownMenuButton::after {
  display: none;
}

#dropdownMenuButton {
  width: 40px;
  height: 40px;
  display: table-cell;
  text-align: center;
  vertical-align: middle;
  border-radius: 50%;
  font-size: 1em;
  color: #fff;
  background: darkblue;
  position: relative;
  border: none;
}

#dropdown-show {
  margin-top: 8px;
  right:0;
  position:absolute;
}


</style>
