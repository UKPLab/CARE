<template>
  <BasicTable
    :model-value="modelValue"
    :columns="columns"
    :options="tableOptions"
    :data="users"
    :max-table-height="400"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * Searchable single-select table of users, used by admins to choose whose
 * submission they are uploading. The parent subscribes to the user table.
 */
export default {
  name: "SubmissionUserPicker",
  components: { BasicTable },
  props: {
    modelValue: {
      type: Array,
      default: () => [],
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
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        singleSelect: true,
        search: true,
      },
    };
  },
  computed: {
    columns() {
      return [
        { name: this.$t("dashboard.uploadModal.columns.id"), key: "id", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.extId"), key: "extId", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.firstName"), key: "firstName", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.lastName"), key: "lastName", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.userName"), key: "userName", sortable: true },
      ];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
  },
};
</script>
