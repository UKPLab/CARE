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
</template>

<script>
/* Study.vue - dashboard component for handling studies

Author: Dennis Zyska
Source: -
*/

import Card from "@/basic/Card.vue";
import Table from "@/basic/table/Table.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import StudyModal from "./study/StudyModal.vue";

export default {
  name: "Study",
  components: {Card, Table, LoadIcon, StudyModal},
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
        {name: "Start", key: "start"},
        {name: "End", key: "end"},
        {name: "Created", key: "createdAt"},
        {name: "Levels", key: "levels"},
        {name: "Time Limit", key: "timeLimit"},
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


                    study.manage = [
                      {
                        icon: "pencil-square",
                        options: {
                          iconOnly: true,
                          specifiers: {
                            "btn-outline-secondary": true,
                          }
                        },
                        title: "Edit user study",
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
                        title: "Delete user study",
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
                        title: "Open user study",
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
                        title: "Copy link to user study",
                        action: "linkStudy",
                      }
                    ];
                console.log(study);
                return study
              }
          );
    },

  },
  methods: {
    action(data) {
      if (data.action === "editStudy") {
        this.studyCoordinator(data.params);
      }
    },
    add() {
      this.$refs.studyCoordinator.open(0);
    },
    load() {
      this.$socket.emit("studyGet");
    },
    studyCoordinator(row) {
      this.$refs.studyCoordinator.open(row.id);
    }

  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>