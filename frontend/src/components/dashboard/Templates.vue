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
  </template>
  
  <script>
  import Card from "@/basic/dashboard/card/Card.vue";
  import BasicTable from "@/basic/Table.vue";
  import BasicButton from "@/basic/Button.vue";
  import TemplateModal from "./templates/TemplateModal.vue";

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
                "btn-outline-primary": true,
              },
            },
            title: "Edit template",
            action: "edit",
          },
          {
            icon: "trash",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-danger": true,
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
          case "delete":
            this.deleteTemplate(data.params);
            break;
        }
      },
      deleteTemplate(template) {
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
      },
    },
  };
  </script>
  
  <style scoped>
  </style>