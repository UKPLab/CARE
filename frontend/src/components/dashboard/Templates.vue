<template>
    <Card title="Templates">
      <template #headerElements>
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
  </template>
  
  <script>
  import Card from "@/basic/dashboard/card/Card.vue";
  import BasicTable from "@/basic/Table.vue";
  import BasicButton from "@/basic/Button.vue";
  import TemplateModal from "./templates/TemplateModal.vue";
  import PublishModal from "./templates/PublishModal.vue";
  import ConfirmModal from "@/basic/modal/ConfirmModal.vue"; 
  /**
   * Templates dashboard component
   *
   * This component provides a view to display/manage templates.
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
          { name: "Type", key: "typeName", sortable: true},
        ],
      };
    },
    computed: {
      templates() {
        return this.$store.getters["table/template/getAll"].map(t => ({
          ...t,
          typeName: this.typeName(t.type),
          // Published email templates (types 1, 2, 3) cannot be deleted
          canDelete: !(t.published && [1, 2, 3].includes(t.type)),
        }));
      },
      buttons() {
        // Template-specific button filtering: buttons with multiple filters use AND logic
        // Single filter buttons can use default OR logic (though they'll work the same either way)
        return [
          {
            icon: "pencil",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [{ key: "userId", value: this.userId }],
            title: "Edit template",
            action: "edit",
          },
          {
            icon: "box-arrow-in-right",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [{ key: "userId", value: this.userId }],
            title: "Edit content",
            action: "editContent",
          },
          {
            icon: "eye",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [
              { key: "published", value: true },
              { key: "userId", value: this.userId, type: "not" }
            ],
            filterMode: "and", // All filters must match: published=true AND userId != current user
            title: "View content (read-only)",
            action: "viewContent",
          },
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
             { key: "userId", value: this.userId }
           ],
           filterMode: "and", // All filters must match: published=false AND userId=current user
           title: "Publish template",
           action: "togglePublished",
          },
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
              { key: "userId", value: this.userId }
            ],
            filterMode: "and", // All filters must match: published=true AND userId=current user
            title: "Published (cannot be unpublished)",
            action: null,
          },
          {
            icon: "trash",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            // Show only for own templates that can be deleted
            // Published email templates (types 1, 2, 3) cannot be deleted
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
          default: return "Choose Type"
        }
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
    },
  };
  </script>
  
  <style scoped>
  </style>