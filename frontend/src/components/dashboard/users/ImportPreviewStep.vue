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

    };
  },
  computed: {
    columns() {
      return [
        {
          name: this.$t('common.duplicate'),
          key: "exists",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t('common.yes'), default: this.$t('common.no') },
          },
          filter: [
            {
              key: false, name: this.$t('common.new')
             },
            { key: true, name: this.$t('common.duplicate') },
          ],
        },
        { name: this.$t('dashboard.projects.extId'), key: "extId" },
        { name: this.$t('common.firstName'), key: "firstName" },
        { name: this.$t('common.lastName'), key: "lastName" },
        { name: this.$t('users.columns.email'), key: "email" },
        { name: this.$t('dashboard.projects.roles'), key: "displayRoles" },
      ];
    },
  },
};
</script>
