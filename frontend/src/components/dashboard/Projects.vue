<template>
  <Card title="Projects">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        title="Create project"
        text="Create"
        @click="$refs.projectModal.open(0)"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="projects"
        :options="options"
        :buttons="buttons"
        @action="action"
      />
    </template>
  </Card>
  <ProjectModal ref="projectModal"/>
  <ExportModal ref="exportModal"/>
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import ProjectModal from "./coordinator/Project.vue";
import ExportModal from "./projects/ExportModal.vue";

/**
 * Project list component
 *
 * This component show the available projects, and allows the user to create new projects.
 *
 * @author Dennis Zyska
 */
export default {
  name: "DashboardProject",
  subscribeTable: ["project"],
  components: {
    ExportModal,
    Card,
    BasicTable,
    BasicButton,
    ProjectModal,
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
        {name: "", key: "select", type: "icon-selector"},
        {name: "Project name", key: "name"},
        {name: "Created At", key: "createdAt"},
        {name: "Public", key: "published", type: "badge"},
        {name: "Closed", key: "closed", type: "badge"},
      ],
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    buttons() {
      const buttons = [
        {
          icon: "clipboard",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Copy project",
          action: "copy",
        },
        {
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          filter: [
            {key: "userId", value: this.userId},
          ],
          title: "Edit project",
          action: "edit",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          filter: [
            {key: "userId", value: this.userId},
          ],
          title: "Delete project",
          action: "delete",
        },
        {
          icon: "share",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          filter: [
            {key: "public", value: false},
            {key: "userId", value: this.userId},
          ],
          title: "Share project",
          action: "publish",
        },
        {
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          title: "Export data",
          icon: "download",
          action: "export",
        }
      ];
      return buttons;
    },
    projects() {
      return this.$store.getters["table/project/getAll"]
        .map((d) => {
          let newD = {...d};
          newD.published = {
            text: newD.public || newD.userId === null ? "Yes" : "No",
            class: newD.public || newD.userId === null ? "bg-success" : "bg-danger",
          };
          newD.closed = {
            text: newD.closed ? "Yes" : "No",
            class: newD.closed ? "bg-danger" : "bg-success",
          };
          newD.select = {
            icon: (newD.id === this.selectedProject) ? "star-fill" : "star",
            title: "Select project as default",
            action: "select",
            selected: newD.id === this.selectedProject,
          };
          return newD;
        });
    },
    selectedProject() {
      return 1; // TODO: get from store
      return this.$store.getters['settings/getValueAsInt']("tags.tagSet.default");
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "copy":
          this.$refs.projectModal.copy(data.params.id);
          break;
        case "edit":
          this.$refs.projectModal.open(data.params.id);
          break;
        case "delete":
          this.deleteProject(data.params);
          break;
        case "publish":
          this.publishProject(data.params);
          break;
        case "select":
          this.selectProject(data.params.id);
          break;
        case "export":
          this.$refs.exportModal.open(data.params.id);
          break;
      }
    },
    deleteProject(params) {
      //TODO: Implement
      console.log("Not implemented yet", params);
    },
    publishProject(params) {
      //TODO: Implement
      console.log("Not implemented yet", params);
    },
    selectProject(id) {
      //TODO: Implement
      console.log("Not implemented yet", id);
    },
  },
};
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>