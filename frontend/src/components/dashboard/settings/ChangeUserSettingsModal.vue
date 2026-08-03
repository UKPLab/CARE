<template>
  <StepperModal
    ref="changeUserSettingsStepper"
    :steps="steps"
    :validation="stepValid"
    :submit-text="$t('common.apply')"
    @submit="handleSubmit"
  >
    <template #title>
      <span>{{ $t('settings.changeUserSettings') }}</span>
    </template>

    <!-- Step 1: Select setting and provide value -->
    <template #step-1>
      <div class="mb-3">
        <h6>{{ $t('dashboard.settings.selectSetting') }}</h6>
        <BasicForm
          v-model="settingSelection"
          :fields="settingFields"
        />
        <div v-if="selectedSetting" class="mt-2">
          <div class="text-muted small">
            {{ selectedSetting.description }}
          </div>
          <div class="mt-2">
            <div v-if="selectedSetting.type === 'edits'">
              <EditorModal
                v-model="settingSelection.value"
                :title="$t('common.editItem', { item: settingSelection.settingKey })"
              ></EditorModal>
            </div>
            <div v-else-if="selectedSetting.type === 'boolean' || selectedSetting.type === 'bool'" class="form-check form-switch">
              <input
                v-model="settingSelection.value"
                :checked="settingSelection.value"
                class="form-check-input"
                role="switch"
                type="checkbox"
              >
            </div>
            <div v-else-if="isLocaleSetting">
              <select v-model="settingSelection.value" class="form-select w-50">
                <option
                  v-for="lang in supportedLocales"
                  :key="lang.code"
                  :value="lang.code"
                >
                  {{ lang.name }}
                </option>
              </select>
            </div>
            <input v-else v-model="settingSelection.value" class="w-50" type="text">
          </div>
           <div class="mt-1">
             <small class="text-secondary">{{ $t('dashboard.settings.selectedValue') }} <strong>{{ previewValue }}</strong></small>
           </div>
        </div>
      </div>
    </template>

    <!-- Step 2: Select users -->
    <template #step-2>
      <div class="mb-3">
        <h6>{{ $t('dashboard.projects.selectUsers') }}</h6>
        <BasicTable
          v-model="userSelection"
          :columns="userColumns"
          :data="users"
          :options="tableOptions"
          :max-table-height="'60vh'"
        />
        <small class="text-muted">
          {{ $t('dashboard.projects.usersSelected', { count: userSelection.length }) }}
        </small>
      </div>
    </template>

    <!-- Step 3: Confirm -->
    <template #step-3>
      <div class="mb-3">
        <h6>{{$t('common.confirm')}}</h6>

        <div class="alert alert-info">
          <strong>{{$t('dashboard.projects.summary')}}</strong><br />
          {{$t('dashboard.settings.settingLabel')}} <strong>{{ settingSelection.settingKey }}</strong><br />
          {{$t('dashboard.settings.newValue')}}
          <strong>
            {{ previewValue }}
          </strong><br />
          {{$t('dashboard.settings.usersLabel')}} <strong>{{ userSelection.length }}</strong>
        </div>

        <div class="alert alert-warning">
          <strong>{{$t('dashboard.projects.noteLabel')}}</strong>
          {{$t('dashboard.settings.noteBody1')}}
        </div>

        <div class="row">
          <div v-if="selectedSetting" class="col-md-6">
            <h6 class="text-success">{{$t('dashboard.settings.setting')}}</h6>
            <div class="mb-1">
              <i class="bi bi-sliders me-1"></i>
              {{ selectedSetting.key }}
            </div>
            <div class="text-muted small">
              {{ selectedSetting.description }}
            </div>
           <div class="mt-2">
             <span class="fw-bold">{{$t('dashboard.settings.newValue')}}</span> {{ previewValue }}
           </div>
          </div>
          <div class="col-md-6">
            <h6 class="text-success">{{$t('dashboard.settings.selectedUsers')}}</h6>
            <ul class="list-unstyled">
              <li
                v-for="user in userSelection"
                :key="user.id"
                class="mb-1"
              >
                <i class="bi bi-person me-1"></i>
                {{ user.firstName }} {{ user.lastName }}
                <span class="text-muted small">({{ user.email }})</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </StepperModal>
  </template>

<script>
/**
 * Change User Settings Modal Component
 *
 * Provides a multi-step interface to change a selected setting for a selected users.
 *
 * @author: Akash Gundapuneni
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";
import EditorModal from "@/basic/editor/Modal.vue";
import { resolveApiMessage } from "@/assets/utils";
import { LOCALE_SETTING_KEY, SUPPORTED_LOCALES } from "@/assets/locale.js";

export default {
  name: "ChangeUserSettingsModal",
  components: {
    StepperModal,
    BasicForm,
    BasicTable,
    EditorModal,
  },
  props: {
    settings: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  data() {
    return {
      settingSelection: {
        settingKey: null,
        value: null,
      },
      userSelection: [],
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        selectableRows: true,
        sort: {
          column: "id",
          order: "ASC",
        },
      },
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t('dashboard.settings.selectSetting') },
        { title: this.$t('dashboard.projects.selectUsers') },
        { title: this.$t('common.confirm') },
      ];
    },
    userColumns() {
      return [
        { name: this.$t('common.userId'), key: "id", sortable: true },
        { name: this.$t('common.firstName'), key: "firstName", sortable: true },
        { name: this.$t('common.lastName'), key: "lastName", sortable: true },
        { name: this.$t('users.columns.email'), key: "email", sortable: true },
      ];
    },
    users() {
      return this.$store.getters["admin/getUsersByRole"] || [];
    },
    selectedSetting() {
      if (!this.settingSelection.settingKey) return null;
      return (this.settings || []).find(
        (s) => s.key === this.settingSelection.settingKey
      );
    },
    selectedType() {
      return (this.selectedSetting?.type || "string").toLowerCase();
    },
    isBooleanType() {
      return this.selectedType === "boolean" || this.selectedType === "bool";
    },
    isLocaleSetting() {
      return this.settingSelection.settingKey === LOCALE_SETTING_KEY;
    },
    supportedLocales() {
      return SUPPORTED_LOCALES;
    },
    settingFields() {
      return [
        {
          key: "settingKey",
          label: this.$t('dashboard.settings.selectSetting'),
          type: "select",
          options: (this.settings || []).map((s) => ({
            name: s.key,
            value: s.key,
          })),
          required: true,
        },
      ];
    },
    stepValid() {
      const hasValue = this.isBooleanType
        ? true
        : (this.settingSelection.value !== null &&
          this.settingSelection.value !== undefined &&
          String(this.settingSelection.value).trim().length > 0);
      const step1Valid = !!this.settingSelection.settingKey && hasValue;
      const step2Valid = this.userSelection.length > 0;
      return [step1Valid, step2Valid, true];
    },
    previewValue() {
      const v = this.settingSelection.value;
      if (this.isBooleanType) {
        return this.toBoolean(v) ? "true" : "false";
      }
      if (this.isLocaleSetting) {
        const match = SUPPORTED_LOCALES.find((lang) => lang.code === v);
        return match ? `${match.name} (${v})` : String(v ?? "");
      }
      return String(v ?? "");
    },
  },
  watch: {
    "settingSelection.settingKey"(newKey) {
      // Initialize/reset the value whenever the setting key changes
      const selected = (this.settings || []).find((s) => s.key === newKey);
      if (!selected) {
        this.settingSelection.value = null;
        return;
      }
      this.settingSelection.value = selected.value;
    },
  },
  methods: {
    toBoolean(value) {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return Boolean(value);
    },
    open() {
      // Reset state
      this.settingSelection = { settingKey: null, value: null };
      this.userSelection = [];

      // Ensure we have users in store
      this.$socket.emit("userGetByRole", { role: "all" }, () => {});

      this.$refs.changeUserSettingsStepper.open();
    },
    close() {
      this.$refs.changeUserSettingsStepper.close();
    },
    toServerString(value, type) {
      if (type === "boolean" || type === "bool") {
        return this.toBoolean(value) ? "true" : "false";
      }
      // server expects strings for all types
      return String(value ?? "");
    },
    handleSubmit() {
      const key = this.settingSelection.settingKey;
      const value = this.toServerString(this.settingSelection.value, this.selectedType);
      const userIds = this.userSelection.map((u) => u.id);

      if (!key || !userIds.length) {
        this.eventBus.emit("toast", {
          title: this.$t('dashboard.settings.updateFailed'),
          message: this.$t('dashboard.settings.selectSettingAndUser'),
          variant: "danger",
        });
        return;
      }

      this.$refs.changeUserSettingsStepper.setWaiting(true);
      this.$socket.emit(
        "appSettingSet",
        {
          key,
          value,
          userIds,
        },
        (result) => {
          this.$refs.changeUserSettingsStepper.setWaiting(false);
          if (!result || !result.success) {
            this.eventBus.emit("toast", {
              title: this.$t('dashboard.settings.updateFailed'),
              message: resolveApiMessage(result) || this.$t('errors.server.unknownError'),
              variant: "danger",
            });
            return;
          }
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.settings.settingsUpdated'),
            message: this.$t('dashboard.settings.updatedMessage', {key, count: userIds.length}),
            variant: "success",
          });
          this.close();
        }
      );
    },
  },
};
</script>

<style scoped>
</style>


