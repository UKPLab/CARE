<template>
  <BasicDetails :items="reviewItems">
    <BasicTable
      :columns="columns"
      :data="selectedRows"
      :options="tableOptions"
      :max-table-height="360"
    />
  </BasicDetails>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicDetails from "@/basic/Details.vue";

export default {
  name: "AIShareReviewStep",
  components: { BasicTable, BasicDetails },
  props: {
    resourceLabel: { type: String, required: true },
    resourceName: { type: String, default: "" },
    audienceLabel: { type: String, required: true },
    expiryDate: { type: String, default: "" },
    costLimit: { type: [Number, String], default: null },
    selectedCount: { type: Number, default: 0 },
    columns: { type: Array, required: true },
    selectedRows: { type: Array, required: true },
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
      },
    };
  },
  computed: {
    reviewItems() {
      return [
        { key: "resource", label: this.resourceLabel, value: this.resourceName },
        { key: "audience", label: "Audience Type", value: this.audienceLabel },
        { key: "expiry", label: "Expiry Date", value: this.expiryDateLabel },
        { key: "costLimit", label: "Cost limit", value: this.costLimitLabel },
      ];
    },
    expiryDateLabel() {
      if (!this.expiryDate) return "-";
      const date = new Date(`${this.expiryDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return this.expiryDate;
      return date.toLocaleDateString();
    },
    costLimitLabel() {
      const value = Number(this.costLimit);
      if (!Number.isFinite(value) || value <= 0) return "No limit";
      const perRecipient = `$${value.toFixed(2)}`;
      if (this.selectedCount <= 1) return perRecipient;
      return `${perRecipient} ($${(value * this.selectedCount).toFixed(2)} total)`;
    },
  },
};
</script>
