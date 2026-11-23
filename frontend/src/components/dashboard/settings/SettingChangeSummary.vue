<template>
  <div class="mb-3">
    <div class="alert alert-info">
      <strong>{{ $t('dashboard.projects.summary') }}</strong><br />
      {{ $t('dashboard.settings.settingLabel') }} <strong>{{ settingKey }}</strong><br />
      {{ $t('dashboard.settings.newValue') }}
      <strong>
        {{ previewValue }}
      </strong><br />
      {{ $t('dashboard.settings.usersLabel') }} <strong>{{ users.length }}</strong>
    </div>

    <div class="alert alert-warning">
      <strong>{{ $t('dashboard.projects.noteLabel') }}</strong>
      {{ $t('dashboard.settings.noteBody1') }}
    </div>

    <div class="row">
      <div v-if="setting" class="col-md-6">
        <h6 class="text-success">{{ $t('dashboard.settings.setting') }}</h6>
        <div class="mb-1">
          <BasicIcon icon-name="sliders" class="me-1" />
          {{ setting.key }}
        </div>
        <div class="text-muted small">
          {{ setting.description }}
        </div>
        <div class="mt-2">
          <span class="fw-bold">{{ $t('dashboard.settings.newValue') }}</span> {{ previewValue }}
        </div>
      </div>
      <div class="col-md-6">
        <h6 class="text-success">{{ $t('dashboard.settings.selectedUsers') }}</h6>
        <ul class="list-unstyled">
          <li
            v-for="user in users"
            :key="user.id"
            class="mb-1"
          >
            <BasicIcon icon-name="person" class="me-1" />
            {{ user.firstName }} {{ user.lastName }}
            <span class="text-muted small">({{ user.email }})</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";

/**
 * Confirmation summary for a bulk user-setting change: the setting, its new
 * value, and the users it will be applied to.
 *
 * @author: Akash Gundapuneni
 */
export default {
  name: "SettingChangeSummary",
  components: { BasicIcon },
  props: {
    setting: {
      type: Object,
      default: null,
    },
    settingKey: {
      type: String,
      default: "",
    },
    previewValue: {
      type: String,
      default: "",
    },
    users: {
      type: Array,
      default: () => [],
    },
  },
};
</script>
