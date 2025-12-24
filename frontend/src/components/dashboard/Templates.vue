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
    <ConfirmModal ref="deleteConf" />
  </template>
  
  <script>
  import Card from "@/basic/dashboard/card/Card.vue";
  import BasicTable from "@/basic/Table.vue";
  import BasicButton from "@/basic/Button.vue";
  import TemplateModal from "./templates/TemplateModal.vue";
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
        })
      );
      },
      buttons() {
        return [
          {
            icon: "pencil",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
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
            title: "Edit content",
            action: "editContent",
          },
          {
           icon: "eye-slash",
           options: {
             iconOnly: true,
             specifiers: {
               "btn-outline-secondary": true,
             },
           },
           filter: [{ key: "hidden", value: true }],
           title: "Show template",
           action: "toggleHidden",
          },
          {
            icon: "eye",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            filter: [{ key: "hidden", value: false }],
            title: "Hide template",
            action: "toggleHidden",
          },
          {
            icon: "trash",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              },
            },
            title: "Delete template",
            action: "delete",
          },
        ];
      },
    },
    methods: {
      typeName(type) {
        switch (type) {
          case 1: return "Email";
          case 2: return "Study";
          case 3: return "Document";
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
          case "delete":
            this.deleteTemplate(data.params);
            break;
          case "toggleHidden":
            this.toggleHidden(data.params);
            break;

        }
      },
      toggleHidden(template) {
        this.$socket.emit("templateUpdate", {
          id: template.id,
          hidden: !template.hidden,
        }, (result) => {
          if (result.success) {
            this.eventBus.emit("toast", {
              title: !template.hidden ? "Template hidden" : "Template shown",
              message: "",
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: "Template update failed",
              message: result.message,
              variant: "danger",
            });
          }
        });
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