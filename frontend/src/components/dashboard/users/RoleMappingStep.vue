<template>
  <div class="role-mapping-container">
    <div
      class="alert alert-warning"
      role="alert"
    >
      {{ $t('dashboard.users.roleMappingWarning') }}
    </div>
    <div class="row fw-semibold border-bottom pb-2 mx-0">
      <div class="col-5">{{ $t('dashboard.users.roleMappingSourceRole', { source: sourceLabel }) }}</div>
      <div class="col-2">{{ $t('dashboard.users.roleMappingUsers') }}</div>
      <div class="col-5">{{ $t('dashboard.users.roleMappingCareRole') }}</div>
    </div>
    <div
      v-for="role in roleRows"
      :key="role.raw"
      class="row align-items-center border-bottom py-1 mx-0"
    >
      <div class="col-5">{{ role.label }}</div>
      <div class="col-2">{{ role.count }}</div>
      <div class="col-5">
        <select
          :value="mappedRoleValue(role.raw)"
          class="form-select form-select-sm"
          :aria-label="$t('dashboard.users.roleMappingCareRole')"
          @change="updateRoleMapping(role.raw, $event.target.value)"
        >
          <option
            value="__unmapped"
            disabled
          >
            {{ $t('dashboard.users.roleMappingSelect') }}
          </option>
          <option v-for="option in careRoleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>
    <p
      v-if="roleRows.length === 0"
      class="text-center text-muted py-2 mb-0"
    >
      {{ $t('dashboard.users.roleMappingNoRoles') }}
    </p>
  </div>
</template>

<script>
import { getRoleRows } from "./roleMapping.js";

/**
 * Step for mapping external role labels to CARE roles during user import.
 * @author: Linyin Huang
 */
export default {
  name: "RoleMappingStep",
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    users: {
      type: Array,
      required: true,
    },
    systemRoles: {
      type: Array,
      required: true,
    },
    sourceLabel: {
      type: String,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  computed: {
    careRoleOptions() {
      return [
        ...this.systemRoles.filter((role) => role.name !== "admin").map((role) => ({
          value: role.name,
          label: role.name.charAt(0).toUpperCase() + role.name.slice(1),
        })),
        { value: "", label: this.$t("dashboard.users.roleMappingNoExtraRole") }
      ];
    },
    roleRows() {
      return getRoleRows(this.users);
    },
  },
  methods: {
    mappedRoleValue(role) {
      return Object.prototype.hasOwnProperty.call(this.modelValue, role) ? this.modelValue[role] : "__unmapped";
    },
    updateRoleMapping(role, careRole) {
      this.$emit("update:modelValue", {
        ...this.modelValue,
        [role]: careRole,
      });
    },
  },
};
</script>
