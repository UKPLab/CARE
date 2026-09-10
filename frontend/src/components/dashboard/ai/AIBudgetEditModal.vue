<template>
  <BasicModal ref="modal" name="aiBudgetEditModal" size="md">
    <template #title>
      Edit cost limit
    </template>
    <template #body>
      <BasicForm v-model="form" :fields="fields" />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          text="Cancel"
          @click="close"
        />
        <BasicButton
          class="btn btn-primary"
          text="Save"
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
          label: "Cost limit ($)",
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: "0",
          help: "Setting to 0 blocks all usage at this level. To remove the cap entirely, close this modal and use the trash icon.",
        },
      ];
    },
  },
  methods: {
    open(row) {
      if (!row?.id) {
        this.toastError("Invalid budget row");
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
            this.toastSuccess("Cap updated");
            this.close();
          } else {
            this.toastError(result?.message || "Failed to update cap");
          }
        }
      );
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", { title: "Success", message, variant: "success" });
    },
    toastError(message) {
      this.eventBus.emit("toast", { title: "Error", message, variant: "danger" });
    },
  },
};
</script>
