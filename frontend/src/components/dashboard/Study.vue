<template>
  <span>
    <StudyModal ref="studyCoordinator"/>
    <StudySessionModal ref="studySessionModal"/>
    <ConfirmModal ref="deleteConf"/>
    <ConfirmModal ref="confirmModal"/>
    <BulkAssignmentsModal ref="bulkAssignmentsModal"/>
    <SingleAssignmentModal ref="singleAssignmentModal"/>
    <InformationModal ref="informationModal"/>
    <Card title="Studies">
      <template #headerElements>
        <BasicButton
          v-if="canCloseStudies"
          class="btn-secondary btn-sm me-1"
          title="Close All Studies"
          @click="closeStudies"
        />
        <BasicButton
          v-if="canAddBulkAssignments"
          class="btn-secondary btn-sm me-1"
          title="Add Bulk Assignments"
          @click="addBulkAssignment"
        />
        <BasicButton
          v-if="canAddSingleAssignments"
          class="btn-secondary btn-sm me-1"
          title="Add Single Assignment"
          @click="addSingleAssignment"
        />
        <BasicButton
          class="btn btn-primary btn-sm"
          title="Add"
          @click="add"
        />

      </template>
      <template #body>
        <BasicTable
          :columns="columns"
          :data="studs"
          :options="options"
          :buttons="buttons"
          @action="action"
        />
      </template>
    </Card>
  </span>
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/Table.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
import StudySessionModal from "@/components/dashboard/study/StudySessionModal.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BulkAssignmentsModal from "./study/BulkAssignmentModal.vue";
import SingleAssignmentModal from "./study/SingleAssignmentModal.vue";
import InformationModal from "@/basic/modal/InformationModal.vue";

/**
 * Dashboard component for handling studies
 *
 * @author: Dennis Zyska, Nils Dycke, Manu Sundar Raj Nandyal
 */
export default {
  name: "DashboardStudy",
  components: {
    Card,
    BasicTable,
    StudyModal,
    StudySessionModal,
    BasicButton,
    ConfirmModal,
    BulkAssignmentsModal,
    SingleAssignmentModal,
    InformationModal
  },
  inject: {
    acceptStats: {
      default: () => false
    }
  },
  props: {},
  subscribeTable: [
    {
      table: 'study',
      include: [
        {table: "user", by: "userId"}
      ]
    },
    'document',
    'study_session', 'workflow', 'workflow_step', 'study_step'],
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
    }
  },
  computed: {
    studies() {
      return this.$store.getters["table/study/getAll"];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    showInformationButton() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.admin");
    },
    buttons() {
      const buttons = [
        {
          icon: "pencil-square",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Edit study",
          action: "editStudy",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Delete study",
          action: "deleteStudy",
        },
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Open study",
          action: "openStudy",
        },
        {
          icon: "link-45deg",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Copy link to study",
          action: "linkStudy",
        },
        {
          icon: "card-list",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Inspect sessions",
          action: "inspectSessions",
        },
        {
          icon: "x-octagon",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Close study",
          action: "closeStudy",
        },
        {
          icon: "save",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Save as Template",
          action: "saveAsTemplate",
        }

      ];
      if (this.showInformationButton) {
        buttons.push({
          icon: "arrows-angle-expand",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: "Show information",
          action: "showInformation",
        });
      }
      return buttons;
    },
    columns() {
      let cols = [
        {name: "Name", key: "name"},
        {
          name: "Status",
          key: "state",
          sortable: true,
          type: "badge",
          typeOptions: {
            keyMapping: {
              "not started": "Not started",
              "closed": "Closed",
              "running": "Running",
              "ended": "Ended",

            },
            classMapping: {
              "not started": "bg-warning",
              "closed": "bg-secondary",
              "running": "bg-success",
              "ended": "bg-danger",
            }
          }
        },
        {name: "Created", key: "createdAt", sortable: true},
        //{name: "Time Limit", key: "timeLimit", sortable: true},
        {name: "Sessions", key: "sessions", sortable: true},
        {name: "Session Limit", key: "limitSessions", sortable: true},
        {name: "Session Limit per User", key: "limitSessionsPerUser", sortable: true},
        {
          name: "Resumable",
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: "Collaborative",
          key: "collab",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: "Multiple Submissions",
          key: "multipleSubmit",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
      ];
      if (this.canReadPrivateInformation) {
        cols.splice(3, 0, {name: "FirstName", key: "firstName"});
        cols.splice(4, 0, {name: "LastName", key: "lastName"});
      }
      return cols;
    },
    studs() {
      return this.studies.filter(study => ((study.createdByUserId === null && study.userId === this.userId) || (study.createdByUserId === this.userId)) && study.template === false)
        .sort((s1, s2) => new Date(s1.createdAt) - new Date(s2.createdAt))
        .map(st => {
          let study = {...st};

          if (study.start !== null && new Date(study.start) > new Date()) {
            study.state = "not started";
          } else if (study.end !== null && new Date(study.end) < new Date()) {
            if (study.multipleSubmit) {
              study.state = study.closed ? "closed" : "running";
            } else {
              study.state = "ended";
            }
          } else {
            study.state = study.closed ? "closed" : "running";
          }

          if (this.canReadPrivateInformation) {
            const user = this.$store.getters["table/user/get"](study.userId);
            if (user) {
              study.firstName = user.firstName;
              study.lastName = user.lastName;
            }
          }

          study.createdAt = new Date(study.createdAt).toLocaleString()
          study.sessions = this.$store.getters["table/study_session/getFiltered"]((e) => e.studyId === study.id).length;
          return study;
        });
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    canAddBulkAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addBulkAssignments");
    },
    canAddSingleAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addSingleAssignments");
    },
    canCloseStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.closeAllStudies");
    },
    studiesProject() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.projectId === 1);
    }
  },
  methods: {
    action(data) {
      if (data.action === "editStudy") {
        this.$socket.emit("stats", {action: "editStudy", data: {studyId: data.params.id}});
        this.studyCoordinator(data.params);
      } else if (data.action === "deleteStudy") {
        this.deleteStudy(data.params);
      } else if (data.action === "openStudy") {
        this.$router.push("/study/" + data.params.hash);
      } else if (data.action === "linkStudy") {
        this.$socket.emit("stats", {action: "copyStudyLink", data: {studyId: data.params.id}});

        this.copyLink(data.params.id);
      } else if (data.action === "inspectSessions") {
        this.$socket.emit("stats", {action: "inspectSessions", data: {studyId: data.params.id}});

        this.$refs.studySessionModal.open(data.params.id);
      } else if (data.action === "closeStudy") {
        this.$socket.emit("stats", {action: "closeStudy", data: {studyId: data.params.id}});

        this.$socket.emit("appDataUpdate", {
          table: "study",
          data: {
            id: data.params.id,
            closed: true
          }
        }, (result) => {
          if (result.success) {
            this.eventBus.emit('toast', {
              title: "Study closed",
              message: "The study has been closed",
              variant: "success"
            });
          } else {
            this.eventBus.emit('toast', {
              title: "Study closing failed",
              message: result.message,
              variant: "danger"
            });
          }
        });
      } else if (data.action === "saveAsTemplate") {
        this.saveAsTemplate(data.params);
      } else if (data.action === "showInformation") {
        const {deletedAt, createdAt, firstName, lastName, updatedAt, manage, ...filteredParams} = data.params;
        this.$refs.informationModal.open(filteredParams);
      }
    },
    async copyLink(studyId) {
      const study = this.$store.getters["table/study/get"](studyId);
      if (!study) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Failed to retrieve URL. Try again later.",
          variant: "danger"
        });
        return;
      }

      const link = window.location.origin + "/study/" + study.hash;
      try {
        await navigator.clipboard.writeText(link);
        this.eventBus.emit('toast', {
          title: "Link copied",
          message: "Study link copied to clipboard!",
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy study link to clipboard!",
          variant: "danger"
        });
      }
    },
    add() {
      this.$refs.studyCoordinator.open(0);
    },
    addBulkAssignment() {
      this.$refs.bulkAssignmentsModal.open();
    },
    addSingleAssignment() {
      this.$refs.singleAssignmentModal.open();
    },
    studyCoordinator(row, linkOnly = false) {
      this.$refs.studyCoordinator.open(row.id, null, linkOnly);
    },
    closeStudies(){
      this.$refs.confirmModal.open(
        "Close all running studies",
        "Are you sure you want to close all open studies?",
        "This will close all studies!",
        (confirmed) => {
          if (confirmed) {
            this.studiesProject.forEach(study => {
              this.$socket.emit("appDataUpdate", {
                table: "study",
                data: {
                  id: study.id,
                  closed: true
                }
              }, (result) => {
                if(result.success){
                  this.eventBus.emit('toast', {
                    title: "Study closed",
                    message: "The study has been closed",
                    variant: "success"
                  });
                } else {
                  this.eventBus.emit('toast', {
                    title: "Study closing failed",
                    message: result.message + " Study: " + study.name,
                    variant: "danger"
                  });
                }
              });
            });
          }
        }
      );
      
    },
    async deleteStudy(row) {
      const studySessions = this.$store.getters["table/study_session/getFiltered"](
        (e) => e.studyId === row.id
      );
      let warning;
      if (studySessions && studySessions.length > 0) {
        warning = ` There ${studySessions.length !== 1 ? "are" : "is"} currently ${
          studySessions.length
        } ${studySessions.length !== 1 ? "study session" : "study sessions"}
         existing for this study. Deleting it will delete the ${
          studySessions.length !== 1 ? "study session" : "study sessions"
        }!`;
      } else {
        warning = "";
      }

      this.$refs.deleteConf.open(
        "Delete Study",
        "Are you sure you want to delete the study?",
        warning,
        function (val) {
          if (val) {
            this.$socket.emit("appDataUpdate", {
              table: "study",
              data: {
                id: row.id,
                deleted: true
              }
            }, (result) => {
              if (result.success) {
                this.eventBus.emit('toast', {
                  title: "Study deleted",
                  message: "The study has been deleted",
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: "Study delete failed",
                  message: result.message,
                  variant: "danger"
                });
              }
            });
          }
        }
      );
    },
    saveAsTemplate(study) {
      const warningMessage = "Document associations will not be saved in templates, as we do not create study steps.";

      this.$refs.confirmModal.open(
        "Save Study as Template",
        "Are you sure you want to save this study as a template?",
        warningMessage,
        (confirmed) => {
          if (confirmed) {
            this.$socket.emit("studySaveAsTemplate", {id: study.id}, (result) => {
              if (!result.success) {
                this.eventBus.emit('toast', {
                  title: "Template Save Failed",
                  message: result.message,
                  variant: "danger",
                });
              } else {
                this.eventBus.emit('toast', {
                  title: "Template Saved",
                  message: "This study has been saved as a template.",
                  variant: "success",
                });
              }
            });
          }
        }
      );
    },
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>