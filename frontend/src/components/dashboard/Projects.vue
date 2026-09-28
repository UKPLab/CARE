<template>
  <DashboardListPage
    :title="$t('dashboard.projects.title')"
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
        :title="$t('dashboard.projects.createTooltip')"
        :text="$t('common.create')"
        icon="plus"
        @click="$refs.projectModal.open(0)"
      />
      <BasicButton
        v-if="isAdmin"
        class="btn-secondary btn-sm"
        :title="$t('dashboard.projects.assignTooltip')"
        :text="$t('dashboard.projects.assignButton')"
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
import { resolveApiMessage } from "@/assets/utils";

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
    };
  },
  computed: {
    columns() {
      return [
        {name: "", key: "select", type: "icon-selector"},
        {name: this.$t('dashboard.projects.columns.name'), key: "name"},
        {name: this.$t('common.createdAt'), key: "createdAt"},
        {name: this.$t('dashboard.projects.columns.public'), key: "published", type: "badge"},
        {name: this.$t('dashboard.projects.columns.closed'), key: "closed", type: "badge"},
      ];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    buttons() {
      const buttons = [
        dashboardRowAction("copy", {
          title: this.$t('dashboard.projects.actions.copy'),
          action: "copy",
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("edit", {
          title: this.$t('dashboard.projects.actions.edit'),
          action: "edit",
          filter: [
            {key: "userId", value: this.userId},
          ],
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("delete", {
          title: this.$t('dashboard.projects.actions.delete'),
          action: "delete",
          filter: [
            {key: "userId", value: this.userId},
          ],
          stats: {
            projectId: "id",
          }
        }),
        dashboardRowAction("share", {
          title: this.$t('dashboard.projects.actions.share'),
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
          title: this.$t('dashboard.projects.actions.export'),
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
            text: newD.public || newD.userId === null ? this.$t('common.yes') : this.$t('common.no'),
            class: DASHBOARD_BADGES.publicPrivate[!!(newD.public || newD.userId === null)],
          };
          newD.closed = {
            text: newD.closed ? this.$t('common.yes') : this.$t('common.no'),
            class: newD.closed ? "bg-danger" : "bg-success",
          };
          newD.select = {
            icon: (newD.id === this.projectId) ? "star-fill" : "star",
            title: this.$t('dashboard.projects.selectAsDefault'),
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
          title: this.$t('dashboard.projects.delete.title'),
          message: this.$t('dashboard.projects.delete.message'),
          warning,
          failTitle: this.$t('dashboard.projects.toasts.deleteFailed'),
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
            title: this.$t('dashboard.projects.toasts.publishFailed'),
            message: resolveApiMessage(result),
            variant: "danger"
          });
        }
        else {
          this.eventBus.emit('toast', {
            title: this.$t('dashboard.projects.toasts.publishedTitle'),
            message: this.$t('dashboard.projects.toasts.publishedMessage'),
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