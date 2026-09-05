<template>
    <Card :title="$t('templates.dashboard.title')">
      <template #headerElements>
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          :title="$t('templates.dashboard.browsePublicTemplates')"
          :text="$t('templates.dashboard.publicTemplates')"
          icon="globe"
          @click="$refs.publicTemplatesModal.open()"
        />
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          :title="$t('modals.importExport.wiring.templates.importTooltip')"
          :text="$t('common.import')"
          icon="upload"
          @click="$refs.importFormatModal.open('template')"
        />
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          :title="$t('modals.importExport.wiring.templates.exportAllTooltip')"
          :text="$t('common.exportAll')"
          icon="download"
          @click="$refs.exportFormatModal.open(null, 'template')"
        />
        <BasicButton
          class="btn-primary btn-sm"
          :title="$t('templates.dashboard.addNewTemplate')"
          :text="$t('templates.dashboard.addTemplate')"
          icon="plus"
          @click="$refs.templateModal.open(0)"
        />
      </template>
      <template #body>
        <BasicTable
          :columns="columns"
          :data="templates"
          :options="options"
          :buttons="buttons"
          @action="action"
        />
      </template>
    </Card>
    <TemplateModal ref="templateModal" />
    <PublishModal ref="publishModal" />
    <ConfirmModal ref="deleteConf" />
    <TemplateDetachModal ref="detachModal" />
    <TemplateUpdateModal ref="updateModal" />
    <PublicTemplatesModal ref="publicTemplatesModal" />
    <ExportFormatModal ref="exportFormatModal" :title="$t('modals.importExport.wiring.templates.exportTitle')" />
    <ImportFormatModal ref="importFormatModal" :title="$t('modals.importExport.wiring.templates.importTitle')" />
  </template>
  
  <script>
  import Card from "@/basic/dashboard/card/Card.vue";
  import BasicTable from "@/basic/Table.vue";
  import BasicButton from "@/basic/Button.vue";
  import TemplateModal from "./templates/TemplateModal.vue";
  import PublishModal from "./templates/PublishModal.vue";
  import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
  import TemplateDetachModal from "./templates/TemplateDetachModal.vue";
  import TemplateUpdateModal from "./templates/TemplateUpdateModal.vue";
  import PublicTemplatesModal from "./templates/PublicTemplatesModal.vue";
  import { resolveApiMessage } from "@/assets/utils";
  import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
  import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
  import { emailTemplateTypes } from "@/assets/templateTypes";
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
      Card,
      BasicTable,
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
        options: {
          striped: true,
          hover: true,
          bordered: false,
          borderless: false,
          small: false,
          pagination: 10,
        },
      };
    },
    computed: {
      columns() {
        return [
          { name: this.$t("common.id"), key: "id" },
          { name: this.$t("common.name"), key: "name", sortable: true },
          { name: this.$t("common.createdAt"), key: "createdAt", sortable: true, type: "datetime" },
          { name: this.$t("common.updatedAt"), key: "updatedAt", sortable: true, type: "datetime" },
          { name: this.$t("common.type"), key: "typeName", sortable: true },
          { name: this.$t("common.status"), key: "statusBadge", type: "badge" },
        ];
      },
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
              canDelete: !(t.public && emailTemplateTypes.includes(t.type)),
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
          {
            icon: "pencil",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: this.$t("templates.dashboard.actions.editTemplate"),
            action: "edit",
          },
          // Edit content - own non-copy templates only
          {
            icon: "box-arrow-in-right",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: this.$t("templates.dashboard.actions.editContent"),
            action: "editContent",
          },
          // Edit content - for copies (detaches first)
          {
            icon: "box-arrow-in-right",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [{ key: "isCopy", value: true }],
            title: this.$t("templates.dashboard.actions.editContent"),
            action: "editContentCopy",
          },
          // View content (read-only) - for copies
          {
            icon: "eye",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [{ key: "isCopy", value: true }],
            title: this.$t("templates.dashboard.actions.viewContentReadOnly"),
            action: "viewContent",
          },
          // Publish - own non-copy non-public templates only
          {
            icon: "cloud-arrow-up",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [
              { key: "public", value: false },
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: this.$t("templates.dashboard.actions.publishTemplate"),
            action: "togglePublished",
          },
          // Published badge - own non-copy public templates only
          {
            icon: "check-circle",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
                disabled: true,
              },
            },
            filter: [
              { key: "public", value: true },
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: this.$t("templates.dashboard.actions.publishedCannotBeUnpublished"),
            action: null,
          },
          // Source updated - copies with updates available (opens modal with Update / Make new copy)
          {
            icon: "arrow-clockwise",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-primary": true,
              },
            },
            filter: [{ key: "hasUpdate", value: true }],
            title: this.$t("templates.dashboard.actions.sourceUpdated"),
            action: "openUpdateModal",
          },
          // Export
          {
            icon: "download",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            title: this.$t('templates.dashboard.actions.exportTemplate'),
            action: "export",
          },
          // Delete - own templates that can be deleted (including copies)
          {
            icon: "trash",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [
              { key: "userId", value: this.userId },
              { key: "canDelete", value: true }
            ],
            filterMode: "and",
            title: this.$t("templates.dashboard.actions.deleteTemplate"),
            action: "delete",
          },
        ];
      },
      userId() {
        return this.$store.getters["auth/getUserId"];
      },
    },
    methods: {
      typeName(type) {
        switch (type) {
          case 1: return this.$t("templates.types.emailGeneral");
          case 2: return this.$t("templates.types.emailStudySession");
          case 3: return this.$t("templates.types.emailAssignment");
          case 4: return this.$t("templates.types.documentGeneral");
          case 5: return this.$t("templates.types.documentStudy");
          case 6: return this.$t("templates.types.emailStudyClose");
          case 7: return this.$t("templates.types.emailSubmissionUpload");
          default: return this.$t("templates.dashboard.chooseType")
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
          const text = isPublic ? this.$t("templates.dashboard.status.published") : this.$t("templates.dashboard.status.draft");
          return { text, class: isPublic ? "bg-success" : "bg-secondary" };
        }
        if (sourceStatus === "updated") return { text: this.$t("templates.dashboard.status.updateAvailable"), class: "bg-info" };
        if (sourceStatus === "unavailable") return { text: this.$t("templates.dashboard.status.sourceUnavailable"), class: "bg-warning text-dark" };
        return { text: this.$t("common.copy"), class: "bg-secondary" };
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
                title: this.$t("templates.dashboard.toasts.templateDetached.title"),
                message: this.$t("templates.dashboard.toasts.templateDetached.message"),
                variant: "success",
              });
              this.$router.push(`/template/${t.id}`);
            } else {
              this.eventBus.emit("toast", {
                title: this.$t("templates.dashboard.toasts.detachFailed"),
                message: resolveApiMessage(result),
                variant: "danger",
              });
            }
          });
        });
      },
      deleteTemplate(template) {
        this.$refs.deleteConf.open(
          this.$t("templates.dashboard.confirmDelete.title"),
          this.$t("templates.dashboard.confirmDelete.message", { name: template.name }),
          null,
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit("templateDelete", {
                templateId: template.id,
              }, (result) => {
                if (!result.success) {
                  this.eventBus.emit("toast", {
                    title: this.$t("templates.dashboard.toasts.templateDeleteFailed"),
                    message: resolveApiMessage(result),
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