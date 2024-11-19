<template>
  <span>
    <StudyModal ref="studyCoordinator"/>
    <StudySessionModal ref="studySessionModal"/>
    <ConfirmModal ref="deleteConf"/>
    <ConfirmModal ref="confirmModal"/>
    <BulkCreateAssignmentsModal ref="bulkCreateAssignmentsModal"/>
    <CreateSingleAssignmentModal ref="createSingleAssignmentModal"/>
    <Card title="Studies">
      <template #headerElements>
        <BasicButton
          class="btn-primary btn-sm"
          title="Add"
          @click="add()"
        />
        <BasicButton
          v-if="canAddBulkAssignments"
          class="btn-secondary btn-sm"
          title="Add Bulk Assignments"
          :style="{ margin: '10px 10px' }"
          @click="addBulkAssignment()"
        />
        <BasicButton
          v-if="canAddBulkAssignments"
          class="btn-secondary btn-sm"
          title="Add Single Assignment"
          @click="addSingleAssignment()"
        />
      </template>
      <template #body>
        <BasicTable
          :columns="columns"
          :data="studs"
          :options="options"
          @action="action"
        />
      </template>
    </Card>
  </span>
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/table/Table.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
import StudySessionModal from "@/components/dashboard/study/StudySessionModal.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BulkCreateAssignmentsModal from "./study/BulkCreateAssignmentsModal.vue";
import CreateSingleAssignmentModal from "./study/CreateSingleAssignmentModal.vue";

/**
 * Dashboard component for handling studies
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "DashboardStudy",
  components: {Card, BasicTable, StudyModal, StudySessionModal, BasicButton, ConfirmModal, BulkCreateAssignmentsModal, CreateSingleAssignmentModal},
  inject: {
    acceptStats: {
      default: () => false
    }
  },
  props: {},
  fetchData: ['study','study_session','workflow','workflow_step','study_step'],
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
        {name: "Name", key: "name"},
        {name: "Start", key: "start", sortable: true},
        {name: "End", key: "end", sortable: true},
        {name: "Created", key: "createdAt", sortable: true},
        {name: "Time Limit", key: "timeLimit", sortable: true},
        {name: "Session Limit", key: "limitSessions", sortable: true},
        {name: "Session Limit per User", key: "limitSessionsPerUser", sortable: true},
        {
          name: "Status",
          key: "closed",
          type: "badge",
          typeOptions: {
            keyMapping: {null: "Open", true: "Closed"},
            classMapping: {null: "bg-warning", true: "bg-secondary"}
          }
        },
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
        {
          name: "Chosen Workflow",
          key: "workflowName",
        },
        {name: "Manage", key: "manage", type: "button-group"},
      ]

    }
  },
  computed: {
    studies() {
      return this.$store.getters["table/study/getAll"];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },  
    studs() {
      if (this.userRights.includes('frontend.dashboard.studies.view'))
    {
      return this.studies.filter(study => study.createdByUserId === this.userId && study.template === false)
        .sort((s1, s2) => new Date(s1.createdAt) - new Date(s2.createdAt))
        .map(st => {
          let study = {...st};
            // dates
            if (study.start === null) {
              study.start = "-"
            } else {
              study.start = new Date(study.start).toLocaleString()
            }

            if (study.end === null) {
              study.end = "-"
            } else {
              study.end = new Date(study.end).toLocaleString()
            }

            study.createdAt = new Date(study.createdAt).toLocaleString()

            study.closed = study.closed ? true : null;

            const workflow = this.$store.getters["table/workflow/get"](study.workflowId);
            study.workflowName = workflow ? workflow.name : "Unknown Workflow";

            study.manage = [
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
                icon:"x-octagon",
                options: {
                  iconOnly: true,
                  specifiers: {
                    "btn-outline-secondary": true,
                  }
                },
                title: "Close study",
                action: "closeStudy"
              }
            ];
            return study
          }
        );
    }
      
    },
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    userRights() {
      return this.$store.getters["auth/getUserRights"];
    },
    canAddBulkAssignments() {
      if (this.isAdmin) {
        return true;
      }
      return this.userRights.includes("frontend.dashboard.studies.addBulkAssignments")
    },
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

        this.$socket.emit("studyUpdate", {
          studyId: data.params.id,
          closed: true
        });
      } else if (data.action === "saveAsTemplate") {
        this.saveAsTemplate(data.params);
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
      this.$refs.bulkCreateAssignmentsModal.open();
    },
    addSingleAssignment() {
      this.$refs.createSingleAssignmentModal.open();
    },
    studyCoordinator(row, linkOnly = false) {
      this.$refs.studyCoordinator.open(row.id, null, linkOnly);
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
            this.$socket.emit("stats", {action: "studyDelete", data: {studyId: row.id}});

            this.$socket.emit("studyUpdate", {
              studyId: row.id,
              deleted: true
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
            this.$socket.emit("studySaveAsTemplate", { studyId: study.id });

            this.eventBus.emit('toast', {
              title: "Template Saved",
              message: "This study has been saved as a template.",
              variant: "success",
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