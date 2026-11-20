<template>
          <li class="nav-item dropdown">
            <div
              class="dropdown"
              @click="toggleProfileDropdown"
              @focusout="toggleProfileDropdown"
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
                  {{ $t('navigation.topbar.signedInAs', { username }) }}
                </a>
                <a
                  class="dropdown-item"
                  href="#"
                  @click="$refs.preferencesModal.open()"
                >
                  {{ $t('auth.preferences.title') }}
                </a>
                <a
                  class="dropdown-item"
                  href="#"
                  @click="$refs.twoFactorSettingsModal.open()"
                >
                  {{ $t('auth.twoFactor.configure') }}
                </a>
                <a
                  class="dropdown-item"
                  href="#"
                  @click="$refs.passwordModal.open(userId)"
                >
                  {{ $t('auth.changePassword') }}
                </a>
                <a
                  class="dropdown-item"
                  href="#"
                  @click.prevent="toggleTheme()"
                >{{ isDarkMode ? $t('navigation.topbar.lightMode') : $t('navigation.topbar.darkMode') }}</a>
                <a
                  class="dropdown-item"
                  href="#"
                  @click="logout()"
                >{{ $t('auth.logout') }}</a>
              </div>
            </div>
          </li>
  <PasswordModal ref="passwordModal" />
  <PreferencesModal ref="preferencesModal" />
  <TwoFactorSettingsModal ref="twoFactorSettingsModal" />
</template>
<script>
import {applyTheme,resolveTheme} from '@/assets/utils';
import axios from 'axios';
import getServerURL from '@/assets/serverUrl';
import PasswordModal from '@/basic/modal/PasswordModal.vue';
import PreferencesModal from '@/basic/modal/PreferencesModal.vue';
import TwoFactorSettingsModal from '@/auth/TwoFactorSettingsModal.vue';
export default {
  name:'ProfileMenu', components:{PasswordModal,PreferencesModal,TwoFactorSettingsModal},
  computed:{
    username() {
      return this.$store.getters['auth/getUsername'];
    },
    firstLetterUsername() {
      return this.$store.getters['auth/getUsername'].charAt(0).toUpperCase();
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    isDarkMode() {
      return resolveTheme(this.$store.getters["settings/getValue"]("app.theme.mode")) === "dark";
    }
 },
  methods:{
    toggleTheme() {
      const next = this.isDarkMode ? "light" : "dark";
      applyTheme(next);
      this.$socket.emit("appSettingSet", {key: "app.theme.mode", value: next});
    },
    async logout() {
      await axios.get(getServerURL() + '/auth/logout', {withCredentials: true})
      await this.$router.push("/login");
    },
    toggleProfileDropdown(event) {
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
    }
 },
};
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

[data-bs-theme="dark"] #dropdownMenuButton {
  background: var(--care-accent);
  color: var(--care-on-accent);
}
</style>
