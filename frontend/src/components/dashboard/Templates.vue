<template>
    <Card title="Templates">
      <template #headerElements>
        <BasicButton
          class="btn-outline-secondary btn-sm me-2"
          title="Browse public templates"
          text="Public Templates"
          icon="globe"
          @click="$refs.publicTemplatesModal.open()"
        />
        <BasicButton
          class="btn-primary btn-sm"
          title="Add new template"
          text="Add Template"
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
    <PublicTemplatesModal ref="publicTemplatesModal" />
  </template>
  
  <script>
  import Card from "@/basic/dashboard/card/Card.vue";
  import BasicTable from "@/basic/Table.vue";
  import BasicButton from "@/basic/Button.vue";
  import TemplateModal from "./templates/TemplateModal.vue";
  import PublishModal from "./templates/PublishModal.vue";
  import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
  import PublicTemplatesModal from "./templates/PublicTemplatesModal.vue";
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
      PublicTemplatesModal,
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
              // Published email templates (types 1, 2, 3, 6) cannot be deleted
              canDelete: !(t.published && [1, 2, 3, 6].includes(t.type)),
              isCopy,
              hasUpdate,
              sourceStatus,
              statusBadge: this.getStatusBadge(isCopy, sourceStatus, t.published),
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
            title: "Edit template",
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
            title: "Edit content",
            action: "editContent",
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
            title: "View content (read-only)",
            action: "viewContent",
          },
          // Publish - own non-copy unpublished templates only
          {
            icon: "cloud-arrow-up",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [
              { key: "published", value: false },
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: "Publish template",
            action: "togglePublished",
          },
          // Published badge - own non-copy published templates only
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
              { key: "published", value: true },
              { key: "userId", value: this.userId },
              { key: "isCopy", value: false },
            ],
            filterMode: "and",
            title: "Published (cannot be unpublished)",
            action: null,
          },
          // Retrieve new version - copies with updates available
          {
            icon: "arrow-clockwise",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-primary": true,
              },
            },
            filter: [{ key: "hasUpdate", value: true }],
            title: "Retrieve new version from source",
            action: "updateFromSource",
          },
          // Make new copy - copies with updates available
          {
            icon: "files",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-primary": true,
              },
            },
            filter: [{ key: "hasUpdate", value: true }],
            title: "Make new copy of updated source",
            action: "makeNewCopy",
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
            title: "Delete template",
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
          case 1: return "Email - General";
          case 2: return "Email - Study Session";
          case 3: return "Email - Assignment";
          case 4: return "Document - General";
          case 5: return "Document - Study";
          case 6: return "Email - Study Close";
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
       * @param {boolean} published
       * @returns {string}
       */
      getStatusBadge(isCopy, sourceStatus, published) {
        // TBadge expects value with .text (and optional .class)
        if (!isCopy) {
          const text = published ? "Published" : "Draft";
          return { text, class: published ? "bg-success" : "bg-secondary" };
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
          case "viewContent":
            this.$router.push(`/template/${data.params.id}`);
            break;
          case "delete":
            this.deleteTemplate(data.params);
            break;
          case "togglePublished":
            this.$refs.publishModal.open(data.params.id);
            break;
          case "updateFromSource":
            this.updateFromSource(data.params);
            break;
          case "makeNewCopy":
            this.makeNewCopy(data.params);
            break;
        }
      },
      deleteTemplate(template) {
        this.$refs.deleteConf.open(
          "Delete Template",
          `Are you sure you want to delete "${template.name}"?`,
          null,
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit("appDataUpdate", {
                table: "template",
                data: {
                  id: template.id,
                  deleted: true,
                },
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
      /**
       * Update a copied template with the latest content from its source
       */
      updateFromSource(template) {
        this.$refs.deleteConf.open(
          "Retrieve New Version",
          `This will replace the content of "${template.name}" with the latest version from the source template. Continue?`,
          null,
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit("templateUpdateFromSource", {
                templateId: template.id,
              }, (result) => {
                if (result.success) {
                  this.eventBus.emit("toast", {
                    title: "Template updated",
                    message: "Content has been updated from the source template",
                    variant: "success",
                  });
                } else {
                  this.eventBus.emit("toast", {
                    title: "Update failed",
                    message: result.message,
                    variant: "danger",
                  });
                }
              });
            }
          }
        );
      },
      /**
       * Make a new copy of the source template (force=true to skip duplicate check)
       */
      makeNewCopy(template) {
        this.$refs.deleteConf.open(
          "Make New Copy",
          `Create a new copy of the source template? Your existing copy will remain unchanged.`,
          null,
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit("templateCopy", {
                sourceTemplateId: template.sourceId,
                force: true,
              }, (result) => {
                if (result.success) {
                  this.eventBus.emit("toast", {
                    title: "Template copied",
                    message: "A new copy has been created from the updated source",
                    variant: "success",
                  });
                } else {
                  this.eventBus.emit("toast", {
                    title: "Copy failed",
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