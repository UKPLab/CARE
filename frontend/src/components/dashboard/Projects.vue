<template>
  <DashboardListPage
    title="Projects"
    :columns="columns"
    :data="projects"
    :buttons="buttons"
    :table-options="options"
    @action="action"
  >
    <template #headerActions>
      <div class="btn-group gap-2">
      <BasicButton
        class="btn-primary btn-sm"
        title="Create project"
        text="Create"
        icon="plus"
        @click="$refs.projectModal.open(0)"
      />
      <BasicButton
        v-if="isAdmin"
        class="btn-secondary btn-sm"
        title="Assign projects"
        text="Assign projects"
        icon="people-fill"
        @click="$refs.assignProjectModal.open()"
      />
      </div>
    </template>
  </DashboardListPage>
  <ProjectModal ref="projectModal"/>
  <ExportModal ref="exportModal"/>
  <ConfirmModal ref="deleteConf"/>
  <AssignProjectModal ref="assignProjectModal"/>

</template>

<script>
import BasicButton from "@/basic/Button.vue";
import ProjectModal from "./coordinator/Project.vue";
import ExportModal from "./projects/ExportModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AssignProjectModal from "./projects/AssignProjectModal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { DEFAULT_DASHBOARD_TABLE_OPTIONS } from "@/basic/dashboard/constants.js";
import { DASHBOARD_BADGES, dashboardRowAction, confirmSoftDelete } from "@/basic/dashboard/actions.js";

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
    DashboardListPage,
    BasicButton,
    ProjectModal,
    ConfirmModal,
    AssignProjectModal,
  },
  data() {
    return {
      options: {...DEFAULT_DASHBOARD_TABLE_OPTIONS},
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
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    buttons() {
      const buttons = [
        dashboardRowAction("copy", {
          title: "Copy project",
          action: "copy",
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("edit", {
          title: "Edit project",
          action: "edit",
          filter: [
            {key: "userId", value: this.userId},
          ],
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("delete", {
          title: "Delete project",
          action: "delete",
          filter: [
            {key: "userId", value: this.userId},
          ],
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("share", {
          title: "Share project",
          action: "publish",
          filter: [
            {key: "public", value: false},
            {key: "userId", value: this.userId},
          ],
          filterMode: "and",
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("download", {
          title: "Export data",
          action: "export",
          stats: {
            projectId: "id",
          }
        }),
      ];
      return buttons;
    },
    projects() {
      return this.$store.getters["table/project/getAll"]
        .map((d) => {
          let newD = {...d};
          newD.published = {
            text: newD.public || newD.userId === null ? "Yes" : "No",
            class: DASHBOARD_BADGES.publicPrivate[!!(newD.public || newD.userId === null)],
          };
          newD.closed = {
            text: newD.closed ? "Yes" : "No",
            class: newD.closed ? "bg-danger" : "bg-success",
          };
          newD.select = {
            icon: (newD.id === this.projectId) ? "star-fill" : "star",
            title: "Select project as default",
            action: "select",
            selected: newD.id === this.projectId,
          };
          return newD;
        });
    },
    projectId() {
      return this.$store.getters['settings/getValueAsInt']("projects.default");
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
   async deleteProject(params) {
      // Get all studies and documents related to this project
      const studies = this.$store.getters["table/study/getFiltered"](
        (e) => e.projectId === params.id
      );
      const documents = this.$store.getters["table/document/getFiltered"](
        (d) => d.projectId === params.id
      );

      // Build warning message
      let warning = "";
      if (studies && studies.length > 0) {
        warning += `There ${studies.length !== 1 ? "are" : "is"} currently ${studies.length} ${studies.length !== 1 ? "studies" : "study"} linked to this project. Deleting the project will also delete the ${studies.length !== 1 ? "studies" : "study"}.\n`;
      }
      if (documents && documents.length > 0) {
        warning += `There ${documents.length !== 1 ? "are" : "is"} currently ${documents.length} ${documents.length !== 1 ? "documents" : "document"} linked to this project. Deleting the project will also delete the ${documents.length !== 1 ? "documents" : "document"}.\n`;
      }

      confirmSoftDelete(
        {
          confirmRef: this.$refs.deleteConf,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "project",
          id: params.id,
          title: "Delete Project",
          message: "Are you sure you want to delete this project?",
          warning,
          failTitle: "Project delete failed",
          onSuccess: () => {
            this.$socket.emit("appSettingSet", { key: "projects.default", value: 1 });
          },
        }
      );
    },
    publishProject(params) {
      this.$socket.emit("appDataUpdate", {
        table: "project",
        data: {
          id: params.id,
          public: true
        }
      }, (result) => {
        if (!result.success) {
          this.eventBus.emit('toast', {
            title: "Project publish failed",
            message: result.message,
            variant: "danger"
          });
        }
        else {
          this.eventBus.emit('toast', {
            title: "Project published",
            message: "The project has been successfully published.",
            variant: "success"
          });
        }
      });
    },
    selectProject(projectId) {
        this.$socket.emit("appSettingSet", { key: "projects.default", value: projectId });
    },
  },
};
</script>

<style scoped></style>