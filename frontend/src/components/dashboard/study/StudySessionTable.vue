<template>
  <BasicTable
    :columns="columns"
    :data="studySessions"
    :options="options"
    :buttons="buttons"
    @action="action"
  />
  <ConfirmModal ref="deleteConf"/>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

/**
 * Table of study session with management buttons
 *
 * Table of study sessions included in the studysession dashboard component.
 *
 * @author: Nils Dycke
 */
export default {
  name: "StudySessionTable",
  components: {BasicTable, ConfirmModal},
  props: {
    studyId: {
      type: Number,
      required: true,
    },
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
    }
  },
  computed: {
    study() {
      return this.$store.getters["table/study/get"](this.studyId);
    },
    columns() {
      let cols = [
        {name: "Started", key: "startParsed"},
        {
          name: "Finished",
          key: "finished",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
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
      ];
      return cols;
    },
    buttons() {
      return [
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "showResumeButton", value: true},
          ],
          title: "Resume session",
          action: "resumeSession",
        },
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "showStartButton", value: true},
          ],
          title: "Start session",
          action: "startSession",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "showDeleteButton", value: true},
          ],
          title: "Delete session",
          action: "deleteSession",
        }

      ];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    studySessions() {
      if (!this.study || this.studyClosed) {
        return [];
      }

      return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId)
        .filter((studySession) => studySession.userId === this.userId)
        .map(s => {
          let session = {...s};

          session.resumable = this.study.resumable;
          session.startParsed = session.start ? new Date(session.start).toLocaleString() : 'Session has not started yet';
          session.finished = session.end !== null;

          session.showResumeButton = session.resumable && session.start && !this.studyClosed;
          session.showDeleteButton = (this.userId === this.study.createdByUserId && this.userId !== this.study.userId)
          session.showStartButton = !session.start && !this.studyClosed;

          return session;
        });
    },
    studyClosed() {
      if (this.study) {
        if (this.study.closed) {
          return true;
        }
        if (!this.study.multipleSubmit && this.study.end && new Date(this.study.end) < Date.now()) {
          return true;
        }
      }
      return false;
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    load() {
      if (!this.study) {
        this.$socket.emit("studyGetById", {studyId: this.studyId});
      }
    },
    action(data) {
      switch (data.action) {
        case "resumeSession":
          this.$router.push("/session/" + data.params.hash);
          break;
        case "startSession":
          this.$router.push("/session/" + data.params.hash);
          break;
        case "deleteSession":
          this.$refs.deleteConf.open(
            "Delete Session",
            "You are about to delete a session; if you just want to finish the session, please access the session and abort the delete.",
            null,
            function (res) {
              if (res) {
                this.$socket.emit("appDataUpdate", {
                  table: "study_session",
                  data: {
                    id: data.params.id,
                    deleted: true
                  }
                }, (result) => {
                  if (result.success) {
                    this.eventBus.emit('toast', {
                      title: "Study Session deleted",
                      message: "Study session has been deleted",
                      variant: "success"
                    });
                  } else {
                    this.eventBus.emit('toast', {
                      title: "Study Session not deleted",
                      message: result.message,
                      variant: "danger"
                    });
                  }
                });
              }
            }
          );
          break;
      }
    }
  }
}
</script>

<style scoped>

</style>