<template>
  <div class="preview-table-container">
    <BasicTable
      :model-value="modelValue"
      :columns="columns"
      :data="users"
      :options="tableOptions"
      :max-table-height="400"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * Preview and select users before a bulk import.
 */
export default {
  name: "ImportPreviewStep",
  components: { BasicTable },
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    users: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        search: true,
        pagination: 10,
        selectableRows: true,
      },
      columns: [
        {
          name: "Duplicate",
          key: "exists",
          type: "badge",
          typeOptions: {
            keyMapping: { true: "Yes", default: "No" },
          },
          filter: [
            { key: false, name: "New" },
            { key: true, name: "Duplicate" },
          ],
        },
        { name: "extId", key: "extId" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Email", key: "email" },
        { name: "Roles", key: "displayRoles" },
      ],
    };
  },
};
</script>
