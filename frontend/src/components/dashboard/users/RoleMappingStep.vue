<template>
  <div class="role-mapping-container">
    <table class="table table-sm align-middle">
      <thead>
        <tr><th>{{ sourceLabel }} Role</th><th>Users</th><th>CARE Role</th></tr>
      </thead>
      <tbody>
        <tr v-for="role in roleRows" :key="role.raw">
          <td>
            {{ role.label }}
          </td>
          <td>{{ role.count }}</td>
          <td>
            <select
              :value="mappedRoleValue(role.raw)"
              class="form-select form-select-sm"
              @change="updateRoleMapping(role.raw, $event.target.value)"
            >
              <option
                value="__unmapped"
                disabled
              >
                Select mapping
              </option>
              <option v-for="option in careRoleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </td>
        </tr>
        <tr v-if="roleRows.length === 0">
          <td colspan="3" class="text-center text-muted">
            No roles were found. Imported users will receive CARE's basic user role.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { getRoleRows } from "./moodleRoleMapping.js";

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
        { value: "", label: "Do not assign additional role" },
        ...this.systemRoles.filter((role) => !role.deleted && role.name !== "admin").map((role) => ({
          value: role.name,
          label: role.name.charAt(0).toUpperCase() + role.name.slice(1),
        })),
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
