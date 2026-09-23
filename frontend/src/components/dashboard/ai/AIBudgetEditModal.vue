<template>
  <BasicModal ref="modal" name="aiBudgetEditModal" size="md">
    <template #title>
      {{ $t("ai.budgets.editTitle") }}
    </template>
    <template #body>
      <BasicForm v-model="form" :fields="fields" />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :text="$t('ai.common.cancel')"
          @click="close"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('ai.common.save')"
          :disabled="!isValid"
          @click="save"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
/**
 * Minimal edit modal for a single ai_budget row. Adjusts costLimit only.
 *
 * @author Mohammed Rawhani
 */
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AIBudgetEditModal",
  components: { BasicModal, BasicForm, BasicButton },
  data() {
    return {
      row: null,
      form: { costLimit: null },
    };
  },
  computed: {
    isValid() {
      const value = Number(this.form.costLimit);
      return Number.isFinite(value) && value >= 0;
    },
    fields() {
      return [
        {
          key: "costLimit",
          label: this.$t("ai.budgets.costLimitUsd"),
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: "0",
          help: this.$t("ai.budgets.costLimitHelp"),
        },
      ];
    },
  },
  methods: {
    open(row) {
      if (!row?.id) {
        this.toastError(this.$t("ai.errors.invalidBudget"));
        return;
      }
      this.row = row;
      this.form = { costLimit: Number(row.costLimit) };
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    save() {
      if (!this.isValid || !this.row) return;
      // Standard appDataUpdate path
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "ai_budget",
          data: { id: this.row.id, costLimit: Number(this.form.costLimit) },
        },
        (result) => {
          if (result?.success) {
            this.toastSuccess(this.$t("ai.messages.capUpdated"));
            this.close();
          } else {
            this.toastError(resolveApiMessage(result, "ai.errors.updateCap"));
          }
        }
      );
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", { title: this.$t("ai.common.success"), message, variant: "success" });
    },
    toastError(message) {
      this.eventBus.emit("toast", { title: this.$t("ai.common.error"), message, variant: "danger" });
    },
  },
};
</script>
