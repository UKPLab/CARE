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
import { formatLocalizedDate } from "@/assets/utils";

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
        { key: "audience", label: this.$t("ai.share.audienceType"), value: this.audienceLabel },
        { key: "expiry", label: this.$t("ai.share.expiryDate"), value: this.expiryDateLabel },
        { key: "costLimit", label: this.$t("ai.budgets.costLimit"), value: this.costLimitLabel },
      ];
    },
    expiryDateLabel() {
      if (!this.expiryDate) return "-";
      return formatLocalizedDate(`${this.expiryDate}T00:00:00`) || this.expiryDate;
    },
    costLimitLabel() {
      const value = Number(this.costLimit);
      if (!Number.isFinite(value) || value <= 0) return this.$t("ai.common.noLimit");
      const perRecipient = `$${value.toFixed(2)}`;
      if (this.selectedCount <= 1) return perRecipient;
      return this.$t("ai.share.totalCost", { perRecipient, total: `$${(value * this.selectedCount).toFixed(2)}` });
    },
  },
};
</script>
