<template>
  <BasicModal ref="modal" name="workflowCreateModal" size="lg">
    <template #title>
      Create New Workflow
    </template>
    <template #body>
      <BasicForm
        ref="form"
        v-model="formData"
        :fields="formFields"
      />
    </template>
    <template #footer>
      <BasicButton
        text="Cancel"
        data-bs-dismiss="modal"
      />
      <BasicButton
        :disabled="!isFormValid || isLoading"
        :text="isLoading ? 'Creating...' : 'Create Workflow'"
        variant="primary"
        @click="createWorkflow"
      >
        <span v-if="isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
      </BasicButton>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";

export default {
  name: "WorkflowCreateModal",
  subscribeTable: ["workflow"],
  emits: ["workflow-created"],
  components: {
    BasicModal,
    BasicButton,
    BasicForm,
  },
  data() {
    return {
      isLoading: false,
      formData: {
        name: "",
        description: "",
      },
    };
  },
  computed: {
    formFields() {
      return [
        {
          key: "name",
          label: "Workflow Name",
          type: "text",
          required: true,
          placeholder: "Enter workflow name",
          maxlength: 255,
          size: 12
        },
        {
          key: "description",
          label: "Description",
          type: "textarea",
          placeholder: "Enter workflow description (optional)",
          maxlength: 1000,
          rows: 3,
          size: 12,
        }
      ];
    },
    isFormValid() {
      return this.formData.name && this.formData.name.trim().length >= 3;
    },
  },
  methods: {
    open() {
      this.resetForm();
      this.$refs.modal.open();
    },
    
    close() {
      this.$refs.modal.close();
    },
    
    resetForm() {
      this.formData = {
        name: "",
        description: "",
      };
      this.isLoading = false;
    },
    
    async createWorkflow() {
      //TODO: Validate unique name
      
      this.isLoading = true;
      
      try {
        this.$socket.emit(
          "appDataUpdate",
          {
            table: "workflow",
            data: {
              name: this.formData.name.trim(),
              description: this.formData.description.trim(),
              hideInFrontend: false,
            },
          },
          (result) => {
            this.isLoading = false;
            
            if (result.success) {
              this.eventBus.emit("toast", {
                title: "Workflow Created",
                message: `Workflow "${this.formData.name}" has been created successfully`,
                variant: "success",
              });
              
              this.close();
            } else {
              this.eventBus.emit("toast", {
                title: "Creation Failed",
                message: result.message || "Failed to create workflow",
                variant: "danger",
              });
            }
          }
        );
      } catch (error) {
        this.isLoading = false;
        this.eventBus.emit("toast", {
          title: "Error",
          message: "An unexpected error occurred",
          variant: "danger",
        });
      }
    },
  },
};
</script>

<style scoped>
.invalid-feedback {
  display: block;
}
</style>