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
   * 
   * @author Mohammad Elwan
   */
  export default {
    name: "TemplateModal",
    components: { BasicCoordinator },
    data() {
      return {
        isEdit: false,
        originalTemplate: null,
      };
    },
    computed: {
      readOnlyFields() {
        return this.isEdit ? ["type"] : [];
      },
    },
    methods: {      
      open(templateId = null, defaultValues = {}) {
        const id = templateId ? Number(templateId) : 0;        
        this.isEdit = id > 0;  // Edit mode if we have a valid ID; otherwise create mode

        if (this.isEdit) {
          this.originalTemplate = defaultValues && defaultValues.id 
            ? { ...defaultValues }
            : this.$store.getters["table/template/get"](id);
        } else {
          this.originalTemplate = null;
        }
        
        this.$nextTick(() => {
          this.$refs.coordinator.open(id, defaultValues);
        });
      },
      
      update(data) {
        const isEdit = this.isEdit;
        const payload = { ...data };

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

        if (isEdit && this.originalTemplate && payload.type !== undefined) {
          const originalType = this.originalTemplate.type;
          const newType = payload.type;
          
          if (Number(originalType) !== Number(newType)) {
            this.eventBus.emit("toast", {
              title: "Type cannot be changed",
              message: "Template type is immutable and cannot be modified after creation.",
              variant: "danger",
            });
            this.$refs.coordinator.waiting = false;
            return;
          }
        }

        if (typeof payload.content === "string") {
          try {
            payload.content = JSON.parse(payload.content);
          } catch (e) {
            this.eventBus.emit("toast", {
              title: "Invalid JSON",
              message: "Content must be valid JSON: " + e.message,
              variant: "danger",
            });
            this.$refs.coordinator.waiting = false;
            return;
          }
        }

        if (isEdit) {
          delete payload.type;
        } else {
          delete payload.id;
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