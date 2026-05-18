<template>
    <BasicCoordinator
      ref="coordinator"
      table="template"
      :title="$t('templates.modal.title')"
      :text-add="$t('common.add')"
      :text-cancel="$t('common.cancel')"
      :custom-submit="true"
      :fields-override="coordinatorFields"
      @submit="update"
    />
  </template>
  
  <script>
  import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";
  import { resolveApiMessage } from "@/assets/utils";

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
  const SUPPORTED_LANGUAGES = [
    { nameKey: "common.languages.en", value: "en" },
    { nameKey: "common.languages.de", value: "de" },
    { nameKey: "common.languages.fr", value: "fr" },
  ];

  export default {
    name: "TemplateModal",
    components: { BasicCoordinator },
    data() {
      return {
        isEdit: false,
        languagesWithContent: [],
      };
    },
    computed: {
      isAdmin() {
        return this.$store.getters["auth/isAdmin"];
      },
      /**
       * Fields configuration for the coordinator, derived from the store
       * but filtered locally for:
       * - type: non-admins can only create document templates (4, 5)
       * - defaultLanguage: limited to languages that have content when editing
       */
      coordinatorFields() {
        const baseFields =
          this.$store.getters["table/template/getFields"] || [];

        return baseFields.map((field) => {
          const f = { ...field };

          if (f.key === "type" && !this.isAdmin) {
            if (Array.isArray(f.options)) {
              f.options = f.options.filter(
                (opt) => opt.value === null || [4, 5].includes(opt.value)
              );
            }
          }

          if (f.key === "defaultLanguage") {
            const translatedLanguages = SUPPORTED_LANGUAGES.map((opt) => ({
              name: this.$t(opt.nameKey),
              value: opt.value,
            }));

            const langs = this.languagesWithContent || [];
            if (langs.length > 0) {
              f.options = translatedLanguages.filter((opt) =>
                langs.includes(opt.value)
              );
            } else {
              f.options = translatedLanguages;
            }
          }

          return f;
        });
      },
    },
    methods: {
      open(templateId = null, defaultValues = {}) {
        const id = templateId ? Number(templateId) : 0;
        this.isEdit = id > 0;

        if (id === 0) {
          this.languagesWithContent = [];
          this.$nextTick(() => this.$refs.coordinator.open(id, defaultValues));
          return;
        }

        // For edit: restrict default language to languages that have content
        this.$socket.emit("templateGetLanguages", { templateId: id }, (res) => {
          const data = res.success && res.data ? res.data : {};
          const languagesArray = Array.isArray(data) ? data : (data.languages || []);

          this.languagesWithContent = languagesArray;

          this.$nextTick(() => this.$refs.coordinator.open(id, defaultValues));
        });
      },
      update(data) {
        const isEdit = this.isEdit;
        const payload = { ...data };

        // Remove content field - content editing happens in editor, not modal
        delete payload.content;
        // Remove public field - publishing happens via table action buttons, not modal
        delete payload.public;

        if (
          !isEdit &&
          (payload.type === "" ||
            payload.type === null ||
            payload.type === undefined)
        ) {
            this.eventBus.emit("toast", {
              title: this.$t("templates.modal.errors.typeRequired.title"),
              message: this.$t("templates.modal.errors.typeRequired.message"),
              variant: "danger",
            });
            this.$refs.coordinator.waiting = false;
            return;
          }

        if (!isEdit) {
          delete payload.id;
          payload.defaultLanguage = payload.defaultLanguage;
          // Set minimal content for new templates
          payload.content = { ops: [{ insert: "\n" }] };
        }
  
        if (isEdit) {
          this.$socket.emit(
            "appDataUpdate",
            { table: "template", data: payload },
            (result) => {
              this.handleSaveResult(result, isEdit);
            }
          );
          return;
        }

        this.$socket.emit("templateAdd", payload, (result) => {
          this.handleSaveResult(result, isEdit);
        });
      },
      handleSaveResult(result, isEdit) {
        if (result.success) {
          this.$refs.coordinator.waiting = false;
          this.eventBus.emit("toast", {
            title: isEdit
              ? this.$t("templates.modal.success.updated")
              : this.$t("templates.modal.success.created"),
            message: "",
            variant: "success",
          });
          this.$refs.coordinator.close();
          // Route to editor after creation (templateAdd returns row; appDataUpdate returns numeric id on edit only)
          if (!isEdit && result.data && result.data.id) {
            this.$router.push(`/template/${result.data.id}`);
          }
        } else {
          this.$refs.coordinator.waiting = false;
          this.eventBus.emit("toast", {
            title: this.$t("templates.modal.errors.operationFailed"),
            message: resolveApiMessage(result),
            variant: "danger",
          });
        }
      },
    },
  };
  </script>