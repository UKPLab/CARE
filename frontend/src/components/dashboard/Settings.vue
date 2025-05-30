<template>
  <div>
    <h1>Settings</h1>
    <div class="alert alert-warning d-flex align-items-center mt-3" role="alert">
      <LoadIcon class="me-2" iconName="exclamation-triangle-fill" />
      <div>
        Remember to click <strong>Save Settings</strong> after making changes.
      </div>
    </div>
    <div class="button-group">
      <button
        class="btn btn-primary me-2"
        @click="save"
      >
        <LoadIcon
          class="me-1"
          iconName="upload"
        ></LoadIcon>
        Save Settings
      </button>
      <button
        class="btn btn-primary"
        @click="load"
      >
        <LoadIcon
          class="me-1"
          iconName="download"
        ></LoadIcon>
        Load Settings
      </button>
    </div>
  </div>
  <Loading v-if="settings === null"></Loading>
  <div v-else>
    <SettingItem
      v-for="(group, key) in groupedSettings"
      :key="key"
      :group="group"
      :title="key"
    />
  </div>
</template>

<script>
import Loading from "@/basic/Loading.vue";
import LoadIcon from "@/basic/Icon.vue";
import SettingItem from "@/components/dashboard/settings/SettingItem.vue";

export default {
  name: "DashboardSettings",
  components: { LoadIcon, Loading, SettingItem },
  data() {
    return {
      settings: null,
      collapseFirst: {},
    };
  },
  computed: {
    groupedSettings() {
      if (!this.settings) return {};
      return this.settings.reduce((acc, setting) => {
        const keys = setting.key.split('.');
        if (!acc[keys[0]]) acc[keys[0]] = {};
        this.nestSettings(acc[keys[0]], keys.slice(1), setting);
        return acc;
      }, {});
    }
  },
  mounted() {
    this.settings = null;
    this.load();
  },
  methods: {
    nestSettings(obj, keys, setting) {
      if (keys.length === 1) {
        if (!obj[keys[0]]) obj[keys[0]] = [];
        obj[keys[0]].push(setting);
      } else {
        if (!obj[keys[0]]) obj[keys[0]] = {};
        this.nestSettings(obj[keys[0]], keys.slice(1), setting);
      }
    },
    save() {
      this.$socket.emit("settingSave", this.settings, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "Success",
            message: res.data,
            variant: "success"
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Error Saving Settings",
            message: res.message,
            variant: "danger"
          });
        }
      });
    },
    load() {
      this.$socket.emit("settingGetData", null, (res) => {
        if (res.success) {
          this.settings = res.data.sort((a, b) => (a.key > b.key ? 1 : -1));
          this.collapseFirst = this.settings.reduce((acc, setting) => {
            const key = setting.key.split('.')[0];
            acc[key] = true;
            return acc;
          }, {});
        } else {
          this.eventBus.emit("toast", {
            title: "Error Loading Settings",
            message: res.message,
            variant: "danger",
          });
        }
      });
    }
  }
};
</script>
