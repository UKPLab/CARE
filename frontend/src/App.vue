<template>
  <ConnectionStatus :disconnected="disconnected" />
  <div v-if="requireAuth">
    <TopBar v-if="!hideTopbar && appLoaded"/>
    <ApplicationLoading v-if="!appLoaded" :text="appLoadText" />
    <div v-else>
      <PostLoginPrompts />
      <router-view class="top-padding"/>
    </div>
  </div>
  <div v-else>
    <router-view/>
  </div>
  <Toast/>
</template>

<script>
import PostLoginPrompts from './auth/PostLoginPrompts.vue';
import Toast from "@/basic/Toast.vue";
import TopBar from "@/basic/navigation/Topbar.vue";
import { applyTheme, getContrastColor, hexToRgbChannels, resolveTheme, shadeColor } from "@/assets/utils";
import ConnectionStatus from "@/basic/ConnectionStatus.vue";
import ApplicationLoading from "@/basic/ApplicationLoading.vue";
import {createTables} from "@/store/utils";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

import BehaviorLogger from "@/assets/behaviorLogger";
import {computed} from "vue";
import { i18n } from "@/i18n.js";
import {
  applyLocale,
  clearCachedLocale,
  getAuthPageLocale,
  getLocaleFromSettings,
  getStoredLocale,
  setStoredLocale,
} from "@/assets/locale.js";

/**
 * Main App Component
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */
export default {
  name: "App",
  components: {TopBar, Toast, ConnectionStatus, ApplicationLoading, PostLoginPrompts},
  provide() {
    return {
      acceptStats: computed(() => this.acceptStats),
      setStatsContext: this.setStatsContext,
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
      statsContext: {},

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
      // One registration for all tables instead of one per table (see createTables).
      createTables(this.$store, data);
      this.loaded.tables = true;
    },
    appUser: function (data) {
      this.$store.commit("auth/SET_USER", data);
      this.loaded.users = true;
    },
    appSettings: function (data) {
      this.$store.commit("settings/setSettings", data);
      this.loaded.settings = true;
      if (this.requireAuth) {
        const locale = getLocaleFromSettings(data);
        if (locale) {
          applyLocale(i18n, locale);
          setStoredLocale(locale);
        }
      }
    },
    appSystemRoles: function (data) {
      this.$store.commit("admin/setSystemRoles", data);
      this.loaded.systemRoles = true;
    },
  },
  computed: {
    hideTopbar() {
      return this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar;
    },
    appLoaded() {
      return this.appLoadPercent === 100;
    },
    appLoadPercent() {
      const stages = Object.values(this.loaded);
      return stages.filter(Boolean).length / stages.length * 100;
    },
    appLoadStep() {
      return Object.keys(this.loaded).find((k) => !this.loaded[k]);
    },
    appLoadText() {
      if (!this.$socket.connected) {
        return this.$t('common.connecting');
      }
      if (this.appLoadPercent < 100) {
        return this.$t('common.loadingProgress', {
          appLoadStep: this.appLoadStep,
          percent: this.appLoadPercent,
        });
      }
      return this.$t('common.loading');
    },
    acceptStats() {
      if (this.$store.getters["auth/isAuthenticated"]) {
        return this.$store.getters["auth/getUser"].acceptStats;
      } else {
        return false;
      }
    },

    requireAuth() {
      return this.$route.meta.requireAuth !== undefined && this.$route.meta.requireAuth;
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
          const accentHover = shadeColor(accent, 0.12);
          document.documentElement.style.setProperty("--care-accent", accent);
          // An invalid value keeps the tokens.css default, so links never get an invalid colour.
          const accentRgb = hexToRgbChannels(accent);
          if (accentRgb) document.documentElement.style.setProperty("--care-accent-rgb", accentRgb);
          document.documentElement.style.setProperty("--care-on-accent", getContrastColor(accent));
          document.documentElement.style.setProperty("--care-accent-hover", accentHover);
          const accentHoverRgb = hexToRgbChannels(accentHover);
          if (accentHoverRgb) document.documentElement.style.setProperty("--care-accent-hover-rgb", accentHoverRgb);
          document.documentElement.style.setProperty("--care-accent-active", shadeColor(accent, 0.2));
          const knob = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23${accent.replace('#','')}'/%3e%3c/svg%3e")`;
          document.documentElement.style.setProperty("--care-switch-knob", knob);
          const knobOn = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23${getContrastColor(accent).replace('#','')}'/%3e%3c/svg%3e")`;
          document.documentElement.style.setProperty("--care-switch-knob-on", knobOn);
        }
      },
      deep: true,
    },
    $route: {
      handler(to, from) {
        this.syncLocaleForRoute(to);
        if (to.meta && to.meta.checkLogin) {
          this.runCheckLoginFlow();
        }
        if (to.fullPath !== from?.fullPath && this.behaviorLogger) {
          this.behaviorLogger.reportRouteChange(from, to);
        }
      },
      immediate: true,
    },
    "$route.meta.requireAuth"(newValue, oldValue) {
      if (newValue === oldValue) return;
      if (newValue) {
        this.resetAppLoadState(); // Call this method only when transitioning into protected area, false -> true
      }
      this.connect();
    },

    // Consent can change at runtime (consent modal, preferences modal)
    acceptStats(accepted) {
      if (accepted && this.loaded.settings) {
        this.initializeBehaviorLogger();
      } else if (this.behaviorLogger) {
        this.behaviorLogger.destroy();
        this.behaviorLogger = null;
      }
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
      applyTheme(resolveTheme(this.$store.getters["settings/getValue"]("app.theme.mode")));
    },
    async runCheckLoginFlow() {
      const response = await axios.get(getServerURL() + "/auth/check", {
        withCredentials: true,
      });
      if (response.data.user) {
        await this.$router.push(response.data.wizardCompleted === false ? "/wizard" : "/dashboard");
      } else if (response.data.needsSetup) {
        await this.$router.push("/wizard");
      } else {
        clearCachedLocale();
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
        this.behaviorLogger = new BehaviorLogger(this.$socket, this.mouseDebounceTime, {
          getContext: () => this.statsContext,
        });
        this.behaviorLogger.init();
        // The $route watcher ran before the logger existed, so log the page the logger starts on
        this.behaviorLogger.reportRouteChange(null, this.$route);
      }
    },
    /**
     * Adds or changes keys of the study context that the behavior logger adds to its events.
     * Set a key to null to remove it.
     * @param {Object} partial The context keys to set, e.g. {studySessionId: 7}.
     */
    setStatsContext(partial) {
      this.statsContext = {...this.statsContext, ...partial};
    },
    syncLocaleForRoute(route) {
      if (route.meta.requireAuth) {
        const fromSettings = getLocaleFromSettings(this.$store.getters["settings/getSettings"]);
        if (fromSettings) {
          applyLocale(i18n, fromSettings);
          return;
        }
        const stored = getStoredLocale();
        if (stored) {
          applyLocale(i18n, stored);
        }
        return;
      }
      if (route.meta.checkLogin) {
        applyLocale(i18n, getAuthPageLocale());
      }
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

</style>
