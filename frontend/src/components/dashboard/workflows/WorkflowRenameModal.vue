<template>
  <BasicModal
    ref="modal"
    name="workflowRenameModal"
    size="lg"
  >
    <template #title>
      {{ $t("workflow.renameModal.title") }}
    </template>
    <template #body>
      <div v-if="selectedWorkflow" class="mb-3">
        <p class="text-muted mb-3">
          {{ $t("workflow.renameModal.description") }}
        </p>
        
        <div class="alert alert-info" role="alert">
          <strong>{{ $t("workflow.renameModal.currentWorkflow") }}:</strong> {{ translateMaybeKey(selectedWorkflow.name) }}
        </div>
        
        <BasicForm
          ref="form"
          v-model="formData"
          :fields="formFields"
        />
      </div>
      
      <div v-if="isLoading" class="text-center py-3">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">{{ $t("common.loading") }}</span>
        </div>
        {{ $t("workflow.renameModal.renamingWorkflow") }}
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :text="$t('common.cancel')"
          @click="close"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('workflow.renameModal.renameWorkflow')"
          :disabled="!canSubmit"
          @click="handleSubmit"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";
import { resolveApiMessage, translateMaybeKey } from "@/assets/utils";

/**
 * Workflow Rename Modal Component
 * 
 * Renames the existing workflow with the updated name instead of creating a new one.
 * The original workflow is hidden from the frontend view.
 * 
 * @author Karim Ouf
 */
export default {
  name: "WorkflowRenameModal",
  components: {
    BasicModal,
    BasicButton,
    BasicForm,
  },
  subscribeTable: ["workflow", "workflow_step"],
  data() {
    return {
      selectedWorkflow: null,
      formData: {
        name: "",
      },
      isLoading: false,
    };
  },
  computed: {
    formFields() {
      return [
        {
          key: "name",
          label: this.$t("workflow.renameModal.form.newWorkflowName"),
          type: "text",
          required: true,
          placeholder: this.$t("workflow.renameModal.form.enterNewWorkflowName"),
          maxlength: 255,
          size: 12,
        },
      ];
    },
    canSubmit() {
      const currentName = this.selectedWorkflow
        ? translateMaybeKey(this.selectedWorkflow.name)
        : "";
      return (
        !this.isLoading &&
        this.formData.name &&
        this.formData.name.trim().length > 0 &&
        this.selectedWorkflow &&
        this.formData.name.trim() !== currentName
      );
    },
  },
  methods: {
    translateMaybeKey,
    open(workflowId) {
      this.selectedWorkflow = this.$store.getters["table/workflow/get"](workflowId);
      if (!this.selectedWorkflow) {
        this.eventBus.emit("toast", {
          title: this.$t("workflow.renameModal.errors.workflowNotFound.title"),
          message: this.$t("workflow.renameModal.errors.workflowNotFound.message"),
          variant: "danger",
        });
        return;
      }
      
      this.formData = {
        name: translateMaybeKey(this.selectedWorkflow.name),
      };
      this.isLoading = false;
      
      this.$refs.modal.open();
    },
    
    close() {
      this.$refs.modal.close();
      this.resetForm();
    },
    
    resetForm() {
      this.selectedWorkflow = null;
      this.formData = {
        name: "",
      };
      this.isLoading = false;
    },
    
    async handleSubmit() {
      if (!this.$refs.form.validate() || !this.canSubmit) {
        return;
      }
      //TODO: Validate unique name
      this.isLoading = true;
      try {
        const newWorkflowData = {
          name: this.formData.name.trim() || this.selectedWorkflow.name,
          description: this.selectedWorkflow.description,
          parentWorkflowId: this.selectedWorkflow.id,
          hideInFrontend: false,
        };
        this.$socket.emit("appDataUpdate", {
            table: "workflow",
            data: newWorkflowData,
            }, (result) => {
            if (!result.success) {
                this.eventBus.emit("toast", {
                  title: this.$t("workflow.renameModal.errors.creationFailed"),
                  message: resolveApiMessage(result),
                  variant: "danger",
                });
            }
        });
             
        this.$socket.emit("appDataUpdate", {
            table: "workflow",
            data: {
              id: this.selectedWorkflow.id,
              deleted: true,
            },
          }, (result) => {
            if (!result.success) {
                this.eventBus.emit("toast", {
                  title: this.$t("workflow.renameModal.errors.hideOriginalFailed"),
                  message: resolveApiMessage(result),
                  variant: "danger",
                });
            }
          });
        
        this.eventBus.emit("toast", {
          title: this.$t("workflow.renameModal.success.title"),
          message: this.$t("workflow.renameModal.success.message", {
            oldName: translateMaybeKey(this.selectedWorkflow.name),
            newName: this.formData.name.trim(),
          }),
          variant: "success",
        });
        
        this.close();
        
      } catch (error) {
        console.error("Failed to rename workflow:", error);
        this.eventBus.emit("toast", {
          title: this.$t("workflow.renameModal.errors.renameFailed"),
          message: error.message || this.$t("workflow.renameModal.errors.renameFailedMessage"),
          variant: "danger",
        });
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
.alert {
  border-left: 4px solid #0dcaf0;
}

.form-text {
  font-size: 0.875rem;
  color: #6c757d;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}
</style>
