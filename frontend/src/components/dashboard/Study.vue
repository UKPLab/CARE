<template>
  <span>
  <StudyModal ref="studyCoordinator"></StudyModal>
  <Card title="Studies">
    <template v-slot:headerElements>
      <button class="btn btn-sm me-1 btn-primary" title="Export" type="button" @click="add()">
        Add
      </button>
    </template>
    <template v-slot:body>
      <Table :columns="columns" :data="studies" :options="options" @action="action"></Table>
    </template>
  </Card>
  </span>
  <StudySessionModal ref="studySessionModal"></StudySessionModal>
</template>

<script>
/* Study.vue - dashboard component for handling studies

Author: Dennis Zyska
Source: -
*/

import Card from "@/basic/Card.vue";
import Table from "@/basic/table/Table.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import StudyModal from "@/components/dashboard/study/StudyModal.vue";
import StudySessionModal from "@/components/dashboard/study/StudySessionModal.vue";

export default {
  name: "Study.vue",
  components: {Card, Table, LoadIcon, StudyModal, StudySessionModal},
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
          {name: "Sessions", key: "sessions"},
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
  props: {},
  mounted() {
    this.load();
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    studies() {
      return this.$store.getters["study/getStudies"]
          .filter(study => study.userId === this.userId)
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

                study.documentName = this.$store.getters["document/getDocument"](study.documentId)['name'];

                study.sessions = this.$store.getters["study_session/getStudySessionsByStudyId"](study.id).length;


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
    async copyLink(studyId){
      const study = this.$store.getters["study/getStudyById"](studyId);
      if(!study){
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
          message: "Document link copied to clipboard!",
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy document link to clipboard!",
          variant: "danger"
        });
      }
    },
    add() {
      this.$refs.studyCoordinator.open(0);
    },
    load() {
      this.$socket.emit("studyGetAll", {userId: this.$store.getters["auth/getUserId"]});
      this.$socket.emit("studySessionGetAll", {userId: this.$store.getters["auth/getUserId"]});
    },
    studyCoordinator(row, linkOnly=false) {
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