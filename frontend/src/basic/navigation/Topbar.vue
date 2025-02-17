<template>
  <div
    id="wrapper"
    class="nav-container"
  >
    <nav class="navbar fixed-top navbar-expand-lg navbar-light bg-light border-bottom">
      <div class="container-fluid">
        <button
          id="backButton"
          class="btn"
          title="Go back..."
          @click="$router.go(-1)"
        >
          <LoadIcon
            :size="16"
            name="arrow-left"
          />
        </button>
        <a
          class="navbar-brand"
          @click="toHome()"
        >
          <IconAsset
            :style="{cursor: 'pointer'}"
            :height="30"
            name="logo"
          />
        </a>
        <div id="topbarCustomPlaceholder"/>   
        <div id="topbarCenterPlaceholder"/>     
        <ul
          id="topBarNavItems"
          class="navbar-nav ms-auto mt-2 mt-lg-0"
        />
        <ul class="navbar-nav">
          <li class="nav-item dropdown">
            <div
              class="dropdown"
              @click="toggleProfileDropdown()"
              @focusout="toggleProfileDropdown()"
            >
              <button
                id="dropdownMenuButton"
                aria-expanded="false"
                aria-haspopup="true"
                class="btn btn-secondary dropdown-toggle"
                data-toggle="dropdown"
                type="button"
              >
                {{ firstLetterUsername }}
              </button>
              <div
                id="dropdown-show"
                aria-labelledby="dropdownMenuButton"
                class="dropdown-menu dropdown-menu-right"
              >
                <a class="dropdown-item display-username">
                  Signed in as {{ username }}
                </a>
                <a 
                  v-if="consentEnabled"
                  class="dropdown-item"
                  href="#"
                  @click="$refs.consentModal.open()"
                >
                  Update consent
                </a>
                <a 
                  class="dropdown-item"
                  href="#"
                  @click="$refs.passwordModal.open(userId)"
                >
                  Change password
                </a>
                <a
                  class="dropdown-item"
                  href="#"
                  @click="logout()"
                >Logout</a>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </nav>
  </div>
  <PasswordModal ref="passwordModal" />
  <ConsentUpdateModal ref="consentModal" />
</template>

<script>
/**
 *  Topbar shown everywhere throughout the app
 *
 * This component provides both a topbar that is visible at any point in the app
 * after logging in. It includes standard utilities and navigation elements
 * appropriate for the context.
 *
 * @author: Carly Gettinger, Dennis Zyska, Nils Dycke, Linyin Huang
 */

import LoadIcon from "@/basic/Icon.vue";
import IconAsset from "@/basic/icons/IconAsset.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import PasswordModal from "@/basic/modal/PasswordModal.vue";
import ConsentUpdateModal from "@/basic/modal/ConsentUpdateModal.vue";

export default {
  name: "TopBar",
  components: {LoadIcon, IconAsset, PasswordModal, ConsentUpdateModal},
  computed: {
    username() {
      return this.$store.getters['auth/getUsername'];
    },
    firstLetterUsername() {
      return this.$store.getters['auth/getUsername'].charAt(0).toUpperCase();
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    consentEnabled() {
      return this.$store.getters["settings/getValue"]("app.config.consent.enabled") === "true";
    },
  },
  methods: {
    removeSidebarFlag() {
      document.body.classList.remove('sidebar-exists');
    },
    async logout() {
      await axios.get(getServerURL() + '/auth/logout', {withCredentials: true})
      await this.$router.push("/login");
    },
    async toHome() {
      await this.$router.push('/dashboard');
    },
    toggleProfileDropdown() {
      const dropdown = document.getElementById('dropdown-show');
      var close = false;
      if (event.type === 'focusout') {
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

#topbarCenterPlaceholder {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

</style>
