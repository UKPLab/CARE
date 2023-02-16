<template>
  <div id="wrapper" class="nav-container">
    <nav class="navbar fixed-top navbar-expand-lg navbar-light bg-light border-bottom">
      <div class="container-fluid">
        <button id='backButton' class="btn" title="Go back..." @click="this.$router.go(-1)">
          <svg class="bi bi-arrow-left" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"
               xmlns="http://www.w3.org/2000/svg">
            <path
                d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"
                fill-rule="evenodd"/>
          </svg>
        </button>
        <a class="navbar-brand" @click="toHome()">
          <IconAsset name="logo" height=30></IconAsset>
        </a>
        <div id="topbarCustomPlaceholder">

        </div>
        <ul class="navbar-nav ms-auto mt-2 mt-lg-0" id="topBarNavItems">
        </ul>
        <ul class="navbar-nav">
          <li class="nav-item dropdown">
            <div class="dropdown" @click="toggleProfileDropdown()" @focusout="toggleProfileDropdown()">
              <button id="dropdownMenuButton" aria-expanded="false" aria-haspopup="true"
                      class="btn btn-secondary dropdown-toggle" data-toggle="dropdown" type="button">
                {{ firstLetterUsername }}
              </button>
              <div id="dropdown-show" aria-labelledby="dropdownMenuButton" class="dropdown-menu dropdown-menu-right">
                <a class="dropdown-item display-username">Signed in as {{ username }} </a>
                <!--<a class="dropdown-item" href="#">Profile</a>
                <a class="dropdown-item" href="#">Settings</a>
                <hr class="dropdown-divider">
                <a class="dropdown-item" href="#">Privacy Policy</a>-->
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

Author: Carly Gettinger (cjgettinger@gmail.com), Dennis Zyska
Co-Author: 
Source:  
*/

import LoadIcon from "@/icons/LoadIcon.vue";
import IconAsset from "@/icons/IconAsset.vue";

export default {
  name: "Topbar",
  components: {LoadIcon, IconAsset},
  computed: {
    username() {
      return this.$store.getters['auth/getUsername'];
    },
    firstLetterUsername() {
      return this.$store.getters['auth/getUsername'].charAt(0).toUpperCase();
    },
  },
  methods: {
    removeSidebarFlag() {
      document.body.classList.remove('sidebar-exists');
    },
    async logout() {
      await this.$store.dispatch('auth/logout');
      await this.$router.push("/login");
    },
    async toHome() {
      await this.$router.push('/dashboard');
    },
    toggleProfileDropdown() {
      const dropdown = document.getElementById('dropdown-show');
      var close = false;
      if (event.type == 'focusout') {
        if (event.relatedTarget != null && event.relatedTarget.classList.contains("dropdown-item")) {
          return;
        }
        close = true;
      }
      this.actuallyToggle(dropdown, close);
    },
    actuallyToggle(dropdownElement, close) {
      if (close || dropdownElement.classList.contains("show")) {
        dropdownElement.classList.remove("show");
      } else {
        dropdownElement.classList.add("show");
      }
    },
  },
}

</script>

<style>

#dropdownMenuButton::after {
  display: none;
}

#dropdownMenuButton {
  width: 35px;
  height: 35px;
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
  right: 0;
  position: absolute;
}

.display-username {
  font-style: italic;
  pointer-events: none;
}

body.sidebar-exists #backButton {
  display: none;
}


</style>
