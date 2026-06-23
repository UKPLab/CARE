<template>
  <BasicModal ref="modal" name="aiBudgetEditModal" size="md">
    <template #title>
      Edit cost limit
    </template>
    <template #body>
      <div v-if="row" class="mb-3 alert alert-light small">
        <div><strong>Scope:</strong> {{ row.entityLabel }}</div>
        <div><strong>Limit type:</strong> {{ row.limitTypeLabel }}</div>
      </div>

      <label class="form-label" for="aiBudgetCostLimit">Cost limit ($)</label>
      <input
        id="aiBudgetCostLimit"
        v-model.number="form.costLimit"
        type="number"
        min="0"
        step="0.01"
        class="form-control"
        placeholder="0"
      />
      <small class="text-muted">
        Setting to 0 blocks all usage at this level. To remove the cap entirely, close this modal and use the trash icon.
      </small>
    </template>
    <template #footer>
      <button class="btn btn-secondary" type="button" @click="close">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!isValid" @click="save">Save</button>
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

export default {
  name: "AIBudgetEditModal",
  components: { BasicModal },
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
  },
  methods: {
    open(row) {
      if (!row?.id) {
        this.toastError("Invalid budget row");
        return;
      }
      this.row = row;
      this.form.costLimit = Number(row.costLimit);
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
