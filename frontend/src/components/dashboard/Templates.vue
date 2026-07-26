<template>
    <DashboardListPage
      title="Templates"
      :columns="columns"
      :data="templates"
      :buttons="buttons"
      :table-options="options"
      @action="action"
    >
      <template #headerActions>
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          title="Browse public templates"
          text="Public Templates"
          icon="globe"
          @click="$refs.publicTemplatesModal.open()"
        />
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          title="Import Templates"
          text="Import"
          icon="upload"
          @click="$refs.importFormatModal.open('template')"
        />
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          title="Export All Templates"
          text="Export All"
          icon="download"
          @click="$refs.exportFormatModal.open(null, 'template')"
        />
        <BasicButton
          class="btn-primary btn-sm"
          title="Add new template"
          text="Add Template"
          icon="plus"
          @click="$refs.templateModal.open(0)"
        />
      </template>
    </DashboardListPage>
    <TemplateModal ref="templateModal" />
    <PublishModal ref="publishModal" />
    <ConfirmModal ref="deleteConf" />
    <TemplateDetachModal ref="detachModal" />
    <TemplateUpdateModal ref="updateModal" />
    <PublicTemplatesModal ref="publicTemplatesModal" />
    <ExportFormatModal ref="exportFormatModal" title="Export Template" />
    <ImportFormatModal ref="importFormatModal" title="Import Templates" />
  </template>
  
  <script>
  import BasicButton from "@/basic/Button.vue";
  import TemplateModal from "./templates/TemplateModal.vue";
  import PublishModal from "./templates/PublishModal.vue";
  import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
  import TemplateDetachModal from "./templates/TemplateDetachModal.vue";
  import TemplateUpdateModal from "./templates/TemplateUpdateModal.vue";
  import PublicTemplatesModal from "./templates/PublicTemplatesModal.vue";
  import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
  import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
  import DashboardListPage from "@/basic/dashboard/ListPage.vue";
  import { DEFAULT_DASHBOARD_TABLE_OPTIONS } from "@/basic/dashboard/constants.js";
  import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
  /**
   * Templates dashboard component
   *
   * This component provides a view to display/manage templates.
   * Main table shows only the current user's own templates (including copies).
   * Public templates are browsable via the PublicTemplatesModal.
   *
   * @author Mohammad Elwan
   */
  export default {
    name: "DashboardTemplates",
    subscribeTable: ["template"],
    components: {
      DashboardListPage,
      BasicButton,
      TemplateModal,
      PublishModal,
      ConfirmModal,
      TemplateDetachModal,
      TemplateUpdateModal,
      PublicTemplatesModal,
      ExportFormatModal,
      ImportFormatModal,
    },
    data() {
      return {
        options: { ...DEFAULT_DASHBOARD_TABLE_OPTIONS },
        columns: [
          { name: "ID", key: "id" },
          { name: "Name", key: "name", sortable: true },
          { name: "Created At", key: "createdAt", sortable: true, type: "datetime" },
          { name: "Updated At", key: "updatedAt", sortable: true, type: "datetime" },
          { name: "Type", key: "typeName", sortable: true },
          { name: "Status", key: "statusBadge", type: "badge" },
        ],
      };
    },
    computed: {
      templates() {
        return this.$store.getters["table/template/getAll"]
          .filter(t => t.userId === this.userId)
          .map(t => {
            const isCopy = !!t.sourceId;
            const sourceStatus = this.getSourceStatus(t);
            const hasUpdate = sourceStatus === "updated";
            return {
              ...t,
              typeName: this.typeName(t.type),
              // Public email templates (types 1, 2, 3, 6, 7) cannot be deleted
              canDelete: !(t.public && [1, 2, 3, 6, 7].includes(t.type)),
              isCopy,
              hasUpdate,
              sourceStatus,
              statusBadge: this.getStatusBadge(isCopy, sourceStatus, t.public),
            };
          });
      },
      buttons() {
        return [
          // Edit metadata - own non-copy templates only
          dashboardRowAction("edit", {
            filter: [
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: "Edit template",
            action: "edit",
          }),
          // Edit content - own non-copy templates only
          dashboardRowAction("editContent", {
            filter: [
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: "Edit content",
            action: "editContent",
          }),
          // Edit content - for copies (detaches first)
          dashboardRowAction("editContent", {
            filter: [{ key: "isCopy", value: true }],
            title: "Edit content",
            action: "editContentCopy",
          }),
          // View content (read-only) - for copies
          dashboardRowAction("view", {
            filter: [{ key: "isCopy", value: true }],
            title: "View content (read-only)",
            action: "viewContent",
          }),
          // Publish - own non-copy non-public templates only
          dashboardRowAction("publish", {
            filter: [
              { key: "public", value: false },
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: "Publish template",
            action: "togglePublished",
          }),
          // Published badge - own non-copy public templates only
          dashboardRowButton("check-circle", {
            options: {
              specifiers: {
                disabled: true,
              },
            },
            filter: [
              { key: "public", value: true },
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: "Published (cannot be unpublished)",
            action: null,
          }),
          // Source updated - copies with updates available (opens modal with Update / Make new copy)
          dashboardRowAction("sync", {
            filter: [{ key: "hasUpdate", value: true }],
            title: "Source updated",
            action: "openUpdateModal",
          }),
          // Export
          dashboardRowAction("download", {
            title: "Export template",
            action: "export",
          }),
          // Delete - own templates that can be deleted (including copies)
          dashboardRowAction("delete", {
            filter: [
              { key: "userId", value: this.userId },
              { key: "canDelete", value: true }
            ],
            filterMode: "and",
            title: "Delete template",
            action: "delete",
          }),
        ];
      },
      userId() {
        return this.$store.getters["auth/getUserId"];
      },
    },
    methods: {
      typeName(type) {
        switch (type) {
          case 1: return "Email - General";
          case 2: return "Email - Study Session";
          case 3: return "Email - Assignment";
          case 4: return "Document - General";
          case 5: return "Document - Study";
          case 6: return "Email - Study Close";
          case 7: return "Email - Submission upload";
          default: return "Choose Type"
        }
      },
      /**
       * Determine the source status for a template row.
       * @param {Object} t - Template row
       * @returns {string|null} 'available' | 'updated' | 'unavailable' | null
       */
      getSourceStatus(t) {
        if (!t.sourceId) return null;
        const source = this.$store.getters["table/template/get"](t.sourceId);
        if (!source || source.deleted) return "unavailable";
        // Compare as timestamps so status is correct after refresh (store may have string or Date)
        const sourceTime = source.updatedAt ? new Date(source.updatedAt).getTime() : 0;
        const copyTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
        if (sourceTime > copyTime) return "updated";
        return "available";
      },
      /**
       * Get the status badge value for a template row.
       * @param {boolean} isCopy
       * @param {string|null} sourceStatus
       * @param {boolean} isPublic
       * @returns {string}
       */
      getStatusBadge(isCopy, sourceStatus, isPublic) {
        // TBadge expects value with .text (and optional .class)
        if (!isCopy) {
          const text = isPublic ? "Published" : "Draft";
          return { text, class: isPublic ? "bg-success" : "bg-secondary" };
        }
        if (sourceStatus === "updated") return { text: "Update available", class: "bg-info" };
        if (sourceStatus === "unavailable") return { text: "Source unavailable", class: "bg-warning text-dark" };
        return { text: "Copy", class: "bg-secondary" };
      },
      action(data) {
        switch (data.action) {
          case "edit":
            this.$refs.templateModal.open(data.params.id, data.params);
            break;
          case "editContent":
            this.$router.push(`/template/${data.params.id}`);
            break;
          case "editContentCopy":
            this.editContentCopy(data.params);
            break;
          case "viewContent":
            this.$router.push(`/template/${data.params.id}`);
            break;
          case "delete":
            this.deleteTemplate(data.params);
            break;
          case "togglePublished":
            this.$refs.publishModal.open(data.params.id);
            break;
          case "openUpdateModal":
            this.$refs.updateModal.open(data.params);
            break;
          case "export":
            this.$refs.exportFormatModal.open(data.params.id, "template");
            break;
        }
      },
      /**
       * Edit content of a copy: show detach warning, then detach and navigate to editor
       */
      editContentCopy(template) {
        this.$refs.detachModal.open(template, (t) => {
          this.$socket.emit("templateDetach", { templateId: t.id }, (result) => {
            if (result.success) {
              this.eventBus.emit("toast", {
                title: "Template detached",
                message: "You can now edit this template",
                variant: "success",
              });
              this.$router.push(`/template/${t.id}`);
            } else {
              this.eventBus.emit("toast", {
                title: "Detach failed",
                message: result.message,
                variant: "danger",
              });
            }
          });
        });
      },
      deleteTemplate(template) {
        this.$refs.deleteConf.open(
          "Delete Template",
          `Are you sure you want to delete "${template.name}"?`,
          null,
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit("templateDelete", {
                templateId: template.id,
              }, (result) => {
                if (!result.success) {
                  this.eventBus.emit("toast", {
                    title: "Template delete failed",
                    message: result.message,
                    variant: "danger",
                  });
                }
              });
            }
          }
        );
      },
    },
  };
  </script>
  
  <style scoped>
  </style>