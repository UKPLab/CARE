<template>
  <span>
    <StudyModal ref="studyCoordinator"/>
    <StudySessionModal ref="studySessionModal"/>
    <Card title="Studies">
      <template #headerElements>
        <ButtonHeader
          class="btn-primary"
          title="Add"
          @click="add()"
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
import ButtonHeader from "@/basic/card/ButtonHeader.vue"

/**
 * Dashboard component for handling studies
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "DashboardStudy",
  components: {Card, BasicTable, StudyModal, StudySessionModal, ButtonHeader},
  props: {},
  fetchData: ['study'],
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
        {name: "Document", key: "documentName"},
        {name: "Start", key: "start", sortable: true},
        {name: "End", key: "end", sortable: true},
        {name: "Created", key: "createdAt", sortable: true},
        {name: "Time Limit", key: "timeLimit", sortable: true},
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
      return this.studies.filter(study => study.userId === this.userId)
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

            const doc = this.$store.getters["table/document/get"](study.documentId)
            study.documentName = doc ? doc.name : "-";

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
              }
            ];
            return study
          }
        );
    },
  },
  methods: {
    action(data) {
      if (data.action === "editStudy") {
        this.$socket.emit("stats", {action: "editStudy", data: {studyId: data.params.id}});

        this.studyCoordinator(data.params);
      } else if (data.action === "deleteStudy") {
        this.$socket.emit("stats", {action: "studyDelete", data: {studyId: data.params.id}});

        this.$socket.emit("studyDelete", {studyId: data.params.id})
      } else if (data.action === "openStudy") {
        this.$router.push("/study/" + data.params.hash);
      } else if (data.action === "linkStudy") {
        this.$socket.emit("stats", {action: "copyStudyLink", data: {studyId: data.params.id}});

        this.copyLink(data.params.id);
      } else if (data.action === "inspectSessions") {
        this.$socket.emit("stats", {action: "inspectSessions", data: {studyId: data.params.id}});

        this.$refs.studySessionModal.open(data.params.id);
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
    studyCoordinator(row, linkOnly = false) {
      this.$refs.studyCoordinator.open(row.id, null, linkOnly);
    }
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>