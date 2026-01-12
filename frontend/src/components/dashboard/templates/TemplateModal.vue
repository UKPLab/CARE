<template>
    <BasicCoordinator
      ref="coordinator"
      table="template"
      title="Template"
      :custom-submit="true"
      @submit="update"
    />
  </template>
  
  <script>
  import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";
  
  /**
   * Template Modal Component
   * 
   * Handles creating and editing templates using BasicCoordinator
   * which auto-generates the form from the template model fields.
   * Content field is excluded from the form (removed from model fields)
   * as it's edited in the dedicated editor page.
   * 
   * @author Mohammad Elwan
   */
  export default {
    name: "TemplateModal",
    components: { BasicCoordinator },
    data() {
      return {
        isEdit: false,
      };
    },
    methods: {
      open(templateId = null, defaultValues = {}) {
        const id = templateId ? Number(templateId) : 0;
        this.isEdit = id > 0;
        
        this.$nextTick(() => {
          this.$refs.coordinator.open(id, defaultValues);
        });
      },
      
      update(data) {
        const isEdit = this.isEdit;
        const payload = { ...data };

        // Remove content field - content editing happens in editor, not modal
        delete payload.content;
        // Remove published field - publishing happens via table action buttons, not modal
        delete payload.published;

        if (
          !isEdit &&
          (payload.type === "" ||
            payload.type === null ||
            payload.type === undefined)
        ) {
            this.eventBus.emit("toast", {
            title: "Type required",
            message: "Please choose a template type",
              variant: "danger",
            });
            this.$refs.coordinator.waiting = false;
            return;
          }

        if (!isEdit) {
          delete payload.id;
          // Set minimal content for new templates (will be edited in editor)
          payload.content = {ops: [{insert: '\n'}]};
        }
  
        const eventName = isEdit ? "templateUpdate" : "templateAdd";
        
        this.$socket.emit(eventName, payload, (result) => {
          if (result.success) {
            this.$refs.coordinator.waiting = false;
            this.eventBus.emit("toast", {
              title: isEdit ? "Template updated" : "Template created",
              message: "",
              variant: "success",
            });
            this.$refs.coordinator.close();
            
            // Route to editor after creation
            if (!isEdit && result.data && result.data.id) {
              this.$router.push(`/template/${result.data.id}`);
            }
          } else {
            this.$refs.coordinator.waiting = false;
            this.eventBus.emit("toast", {
              title: "Template operation failed",
              message: result.message,
              variant: "danger",
            });
          }
        });
      },
    },
  };
  </script>