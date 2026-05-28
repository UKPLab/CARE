<template>
  <Card :title="$t('dashboard.projects.title')">
    <template #headerElements>
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
    <template #body>
      <BasicTable
        :columns="columns"
        :data="projects"
        :options="options"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="action"
      />
    </template>
  </Card>
  <ProjectModal ref="projectModal"/>
  <ExportModal ref="exportModal"/>
  <ConfirmModal ref="deleteConf"/>
  <AssignProjectModal ref="assignProjectModal"/>

</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import ProjectModal from "./coordinator/Project.vue";
import ExportModal from "./projects/ExportModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AssignProjectModal from "./projects/AssignProjectModal.vue";
import { resolveApiMessage, translateMaybeKey } from "@/assets/utils";

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
    ConfirmModal,
    AssignProjectModal,
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
        {name: this.$t('dashboard.projects.columns.name'), key: "name"},
        {name: this.$t('common.createdAt'), key: "createdAt"},
        {name: this.$t('dashboard.projects.columns.public'), key: "published", type: "badge"},
        {name: this.$t('dashboard.projects.columns.closed'), key: "closed", type: "badge"},
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
        {
          icon: "clipboard",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: this.$t('dashboard.projects.actions.copy'),
          action: "copy",
          stats: {
            projectId: "id",
          }
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
          title: this.$t('dashboard.projects.actions.edit'),
          action: "edit",
          stats: {
            projectId: "id",
          }
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
          title: this.$t('dashboard.projects.actions.delete'),
          action: "delete",
          stats: {
            projectId: "id",
          }
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
          title: this.$t('dashboard.projects.actions.share'),
          action: "publish",
          stats: {
            projectId: "id",
          }
        },
        {
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          title: this.$t('dashboard.projects.actions.export'),
          icon: "download",
          action: "export",
          stats: {
            projectId: "id",
          }
        }
      ];
      return buttons;
    },
    projects() {
      return this.$store.getters["table/project/getAll"]
        .map((d) => {
          let newD = {...d};
          if (newD.userId === null) {
            // Translate only system seed projects (e.g. the default project).
            newD.name = translateMaybeKey(newD.name);
            newD.description = translateMaybeKey(newD.description);
          }
          newD.published = {
            text: newD.public || newD.userId === null ? this.$t('common.yes') : this.$t('common.no'),
            class: newD.public || newD.userId === null ? "bg-success" : "bg-danger",
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

      this.$refs.deleteConf.open(
        this.$t('dashboard.projects.delete.title'),
        this.$t('dashboard.projects.delete.message'),
        warning,
        (val) => {
          if (val) {
            this.$socket.emit("appDataUpdate", {
              table: "project",
              data: {
                id: params.id,
                deleted: true
              }
            }, (result) => {
              if (!result.success) {
                this.eventBus.emit('toast', {
                  title: this.$t('dashboard.projects.toasts.deleteFailed'),
                  message: resolveApiMessage(result),
                  variant: "danger"
                });
              }
            });
          }
        }
      );
      this.$socket.emit("appSettingSet", { key: "projects.default", value: 1 });
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

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>