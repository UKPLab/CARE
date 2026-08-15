<template>
  <div
      v-if="disconnected"
      class="modal-backdrop fade show"
      style="opacity: 0.75"
  >
    <Loader
        text-class="text-light"
        class="text disconnect_error"
        :loading="true"
        :size="5"
        text="Connection error! Reconnecting..."
    />
  </div>
  <div v-if="requireAuth">
    <TopBar v-if="!hideTopbar && appLoaded"/>
    <div
        v-if="!appLoaded"
        class="pageLoader"
    >
      <Loader
          :loading="!appLoaded"
          :text="appLoadText"
      />
    </div>
    <div v-else>
      <ConsentModal ref="consentModal"/>
      <TwoFactorSettingsModal
          ref="twoFactorSettingsModal"
          :enforced="true"
      />
      <router-view class="top-padding"/>
    </div>
  </div>
  <div v-else>
    <router-view/>
  </div>
  <Toast/>
</template>

<script>
import Toast from "@/basic/Toast.vue";
import TopBar from "@/basic/navigation/Topbar.vue";
import { applyTheme, getContrastColor } from "@/assets/utils";
import Loader from "@/basic/Loading.vue";
import {createTable} from "@/store/utils";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import ConsentModal from "@/auth/ConsentModal.vue";
import TwoFactorSettingsModal from "@/auth/TwoFactorSettingsModal.vue";
import BehaviorLogger from "@/assets/behaviorLogger";
import {computed} from "vue";

/**
 * Main App Component
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */
export default {
  name: "App",
  components: {TopBar, Toast, Loader, ConsentModal, TwoFactorSettingsModal},
  provide() {
    return {
      acceptStats: computed(() => this.acceptStats),
    }
  },
  data() {
    return {
      loaded: {
        users: false,
        tables: false,
        settings: false,
        systemRoles: false,
      },
      disconnected: false,
      behaviorLogger: null,
      postLoginModalFlowToken: 0,
    }
  },
  sockets: {
    connect() {
      this.disconnected = false;
      if (!this.appLoaded) {
        this.$socket.emit("appInit");
      }
    },
    disconnect() {
      this.disconnected = true;
    },
    logout: function () {
      // if not authenticated, backend will always send logout event
      this.resetAppLoadState();
      this.$socket.disconnect();
      this.$router.push({
        name: "login",
        query: {redirectedFrom: this.$route.fullPath},
      });
    },
    appTables: function (data) {
      data.forEach((table) => {
        createTable(this.$store, table);
      });
      this.loaded.tables = true;
    },
    appUser: function (data) {
      this.$store.commit("auth/SET_USER", data);
      this.loaded.users = true;
    },
    appSettings: function (data) {
      this.$store.commit("settings/setSettings", data);
      this.loaded.settings = true;
    },
    appSystemRoles: function (data) {
      this.$store.commit("admin/setSystemRoles", data);
      this.loaded.systemRoles = true;
    },
  },
  computed: {
    hideTopbar() {
      return (
          this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar
      );
    },
    appLoaded() {
      return this.appLoadPercent === 100;
    },
    appLoadPercent() {
      return (
          (Object.values(this.loaded).filter((v) => v).length /
              Object.values(this.loaded).length) *
          100
      );
    },
    appLoadStep() {
      return Object.keys(this.loaded).find((k) => !this.loaded[k]);
    },
    appLoadText() {
      if (!this.$socket.connected) {
        return "Connecting...";
      }
      if (this.appLoadPercent < 100) {
        return "Load " + this.appLoadStep + " (" + this.appLoadPercent + "%)";
      }
      return "Loading...";
    },
    acceptStats() {
      if (this.$store.getters["auth/isAuthenticated"]) {
        return this.$store.getters["auth/getUser"].acceptStats;
      } else {
        return false;
      }
    },
    hasTwoFactorConfigured() {
      const user = this.$store.getters["auth/getUser"];
      const methods = Array.isArray(user?.twoFactorMethods) ? user.twoFactorMethods : [];
      return methods.length > 0;
    },
    loginMethod() {
      const user = this.$store.getters["auth/getUser"];
      if (!user) return null;
      if (user.loginMethod) return user.loginMethod;
      if (user.orcidId) return "orcid";
      if (user.ldapUsername) return "ldap";
      if (user.samlNameId) return "saml";
      return "local";
    },
    isTwoFactorRequired() {
      if (!this.loginMethod) return false;
      return this.$store.getters["settings/getValue"](`system.auth.${this.loginMethod}.2fa.required`) === "true";
    },
    isTermsConsented() {
      return !!this.$store.getters["auth/getUser"]?.acceptTerms;
    },
    shouldShowConsentModal() {
      return this.requireAuth && this.appLoaded && !this.isTermsConsented;
    },
    shouldForceTwoFactorSetup() {
      return this.requireAuth &&
          this.appLoaded &&
          this.isTermsConsented &&
          this.isTwoFactorRequired &&
          !this.hasTwoFactorConfigured;
    },
    requireAuth() {
      return (
          this.$route.meta.requireAuth !== undefined &&
          this.$route.meta.requireAuth
      );
    },
    mouseDebounceTime() {
      return parseInt(this.$store.getters["settings/getValue"]('statistics.tracking.mouseDebounceTime'), 10);
    }
  },
  watch: {
   "$store.state.settings": {
      handler() {
        const saved = this.$store.getters["settings/getValue"]("app.theme.mode");
        if (saved) {
          applyTheme(saved);
        }
        const accent = this.$store.getters["settings/getValue"]("theme.dark.accentColor");
        if (accent) {
          document.documentElement.style.setProperty("--care-accent", accent);
          document.documentElement.style.setProperty("--care-on-accent", getContrastColor(accent));
        }
      },
      deep: true,
    },
    $route(to, from) {
      if (to.meta && to.meta.checkLogin) {
        this.runCheckLoginFlow();
      }
      if (to.fullPath !== from.fullPath && this.behaviorLogger) {
        this.behaviorLogger.reportRouteChange(from, to);
      }
    },
    "$route.meta.requireAuth"(newValue, oldValue) {
      if (newValue === oldValue) return;
      if (newValue) {
        this.resetAppLoadState(); // Call this method only when transitioning into protected area, false -> true
      }
      this.connect();
    },
    shouldForceTwoFactorSetup() {
      this.syncPostLoginModalFlow();
    },
    shouldShowConsentModal() {
      this.syncPostLoginModalFlow();
    },
    isTermsConsented() {
      this.syncPostLoginModalFlow();
    },
    appLoaded() {
      this.syncPostLoginModalFlow();
    },
    // Initialize logger after settings are loaded because we access the settings table
    'loaded.settings': {
      handler(isLoaded) {
        if (isLoaded) {
          this.initializeBehaviorLogger();
        }
      },
      immediate: true
    }
  },
  beforeMount() {
    this.connect();
  },
  async mounted() {
    this.initTheme();
    if (this.$route.meta.checkLogin) {
      await this.runCheckLoginFlow();
    }
  },
  beforeUnmount() {
    if (this.behaviorLogger) {
      this.behaviorLogger.destroy();
    }
  },
  methods: {
    initTheme() {
      const saved = this.$store.getters["settings/getValue"]("app.theme.mode");
      const cached = localStorage.getItem("care.theme");
      const osPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(saved || cached || (osPrefersDark ? "dark" : "light"));
    },
    async runCheckLoginFlow() {
      const response = await axios.get(getServerURL() + "/auth/check", {
        withCredentials: true,
      });
      if (response.data.user) {
        await this.$router.push(response.data.wizardCompleted === false ? "/wizard" : "/dashboard");
      } else if (response.data.needsSetup) {
        await this.$router.push("/wizard");
      }
    },
    resetAppLoadState() {
      this.loaded = {
        users: false,
        tables: false,
        settings: false,
        systemRoles: false,
      };
    },
    connect() {
      if (!this.$route.meta.requireAuth) return;

      if (!this.$socket.connected) {
        this.$socket.connect();
        return;
      }

      if (!this.appLoaded) {
        this.$socket.emit("appInit");
      }
    },
    initializeBehaviorLogger() {
      if (this.acceptStats && !this.behaviorLogger) {
        this.behaviorLogger = new BehaviorLogger(this.$socket, this.mouseDebounceTime);
        this.behaviorLogger.init();
      }
    },
    syncPostLoginModalFlow() {
      if (!this.requireAuth || !this.appLoaded) {
        return;
      }

      this.$nextTick(() => {
        if (this.shouldShowConsentModal) {
          if (this.$refs.twoFactorSettingsModal?.isVisible()) {
            this.$refs.twoFactorSettingsModal.close();
          }
          if (this.$refs.consentModal) {
            this.$refs.consentModal.open();
          }
          return;
        }

        if (this.shouldForceTwoFactorSetup) {
          if (this.$refs.consentModal?.isVisible()) {
            this.$refs.consentModal.close();
          }
          if (this.$refs.twoFactorSettingsModal) {
            this.$refs.twoFactorSettingsModal.open();
          }
          return;
        }

        if (this.$refs.consentModal?.isVisible()) {
          this.$refs.consentModal.close();
        }
        if (this.$refs.twoFactorSettingsModal?.isVisible()) {
          this.$refs.twoFactorSettingsModal.close();
        }
      });
    },
  },
};
</script>

<style>
html, body {
  height: 100%;
  overflow: hidden;
}

.top-padding {
  padding-top: 52.5px;
}

.pageLoader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.overlay {
  position: fixed;
  width: 100%;
  height: 100%;
  z-index: 1050;
  top: 0;
  left: 0;
  opacity: 0.9;
  filter: alpha(opacity=90);
  background-color: #de1818;
}

.disconnect_error {
  transform: translate(-50%, -50%);
  top: 50%;
  left: 50%;
  position: absolute;
  margin: 0;
}
</style>
