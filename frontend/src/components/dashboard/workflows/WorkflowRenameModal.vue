<template>
  <BasicModal
    ref="modal"
    name="workflowRenameModal"
    size="lg"
  >
    <template #title>
      Rename Workflow
    </template>
    <template #body>
      <div v-if="selectedWorkflow" class="mb-3">
        <p class="text-muted mb-3">
          This will create a new workflow with the updated name. The original workflow will be hidden.
        </p>
        
        <div class="alert alert-info" role="alert">
          <strong>Current Workflow:</strong> {{ selectedWorkflow.name }}
        </div>
        
        <BasicForm
          ref="form"
          v-model="formData"
          :fields="formFields"
        />
      </div>
      
      <div v-if="isLoading" class="text-center py-3">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        Creating new workflow...
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary me-2"
        text="Cancel"
        @click="close"
      />
      <BasicButton
        class="btn btn-primary"
        text="Create New Workflow"
        :disabled="!canSubmit"
        @click="handleSubmit"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Workflow Rename Modal Component
 * 
 * Creates a new workflow with the updated name instead of renaming the existing one.
 * The original workflow is hidden from the frontend view.
 * 
 * @author Generated for CARE System
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
          label: "New Workflow Name",
          type: "text",
          required: true,
          placeholder: "Enter new workflow name",
          maxlength: 255,
          size: 12,
        },
      ];
    },
    canSubmit() {
      return (
        !this.isLoading &&
        this.formData.name &&
        this.formData.name.trim().length > 0 &&
        this.selectedWorkflow &&
        this.formData.name.trim() !== this.selectedWorkflow.name
      );
    },
  },
  methods: {
    open(workflowId) {
      this.selectedWorkflow = this.$store.getters["table/workflow/get"](workflowId);
      if (!this.selectedWorkflow) {
        this.eventBus.emit("toast", {
          title: "Error",
          message: "Workflow not found",
          variant: "danger",
        });
        return;
      }
      
      // Initialize form with current workflow data
      this.formData = {
        name: this.selectedWorkflow.name,
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
                  title: "Creation Failed",
                  message: result.message || "Failed to create new workflow",
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
                    title: "Hide Original Failed",
                    message: result.message || "Failed to hide original workflow",
                    variant: "danger",
                });
            }
          });
        
        this.eventBus.emit("toast", {
          title: "Workflow Renamed",
          message: `Workflow "${this.selectedWorkflow.name}" has been renamed to "${this.formData.name.trim()}"`,
          variant: "success",
        });
        
        this.close();
        
      } catch (error) {
        console.error("Failed to rename workflow:", error);
        this.eventBus.emit("toast", {
          title: "Rename Failed",
          message: error.message || "Failed to rename workflow",
          variant: "danger",
        });
      } finally {
        this.isLoading = false;
      }
    },
    
    async copyWorkflowSteps(originalWorkflowId, newWorkflowId) {
      try {
        // Get all steps from the original workflow
        const originalSteps = this.$store.getters["table/workflow_step/getFiltered"](
          (step) => step.workflowId === originalWorkflowId && !step.deleted
        );
        
        // Copy each step to the new workflow
        for (const step of originalSteps) {
          const newStepData = {
            workflowId: newWorkflowId,
            name: step.name,
            description: step.description,
            stepType: step.stepType,
            parameters: step.parameters,
            position: step.position,
            order: step.order,
          };
          
          await new Promise((resolve, reject) => {
            this.$socket.emit("appDataAdd", {
              table: "workflow_step",
              data: newStepData,
            }, (result) => {
              if (result.success) {
                resolve(result);
              } else {
                reject(new Error(`Failed to copy step: ${step.name}`));
              }
            });
          });
        }
        
      } catch (error) {
        console.error("Failed to copy workflow steps:", error);
        throw new Error("Failed to copy workflow steps");
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
