<template>
  <BasicTable
    :columns="columns"
    :data="studySessions"
    :options="options"
    :buttons="buttons"
    @action="action"
  />
  <ConfirmModal ref="deleteConf" />
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
    showFinished: {
      type: Boolean,
      required: false,
      default: false,
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
      columns: [
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
      ]
    }
  },
  computed: {
    study() {
      return this.$store.getters["table/study/get"](this.studyId);
    },
    buttons() {
      return [];
    },
    studySessions() {
      if (!this.study) {
        return [];
      }

      return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId)
          .filter(s => this.showFinished || this.study && this.study.multipleSubmit? (!this.study.closed) : s.end === null)
          .map(s => {
            let session = {...s};

            session.resumable = this.study.resumable;
            session.startParsed = session.start? new Date(session.start).toLocaleString() : 'Session has not started yet';
            session.finished = session.end !== null;

            // TODO change buttons to computed "buttons"
            if (!session.finished) {
              if (session.resumable && session.start) {
                session.manage.push({
                  icon: "box-arrow-in-right",
                  options: {
                    iconOnly: true,
                    specifiers: {
                      "btn-outline-secondary": true,
                      "btn-sm": true,
                    }
                  },
                  title: "Resume session",
                  action: "resumeSession",
                });
              }
              if (!session.start) {
                session.manage.push({
                  icon: "box-arrow-in-right",
                  options: {
                    iconOnly: true,
                    specifiers: {
                      "btn-outline-secondary": true,
                      "btn-sm": true,
                    }
                  },
                  title: "Start session",
                  action: "startSession",
                });
              }
              if ((this.userId === this.study.createdByUserId && this.userId !== this.study.userId) || this.$store.getters["auth/isAdmin"] ) {
                session.manage.push(
                    {
                      icon: "trash",
                      options: {
                        iconOnly: true,
                        specifiers: {
                          "btn-outline-secondary": true,
                          "btn-sm": true,
                        }
                      },
                      title: "Delete session",
                      action: "deleteSession",
                    });
              }

            }  

            return session;
          });
    }
  },
  mounted() {
    this.load();
  },
  methods: {
    load(){
      if(!this.study) {
        this.$socket.emit("studyGetById", {studyId: this.studyId});
      }
    },
    action(data){
      switch(data.action){
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
                if(res){
                  this.$socket.emit("studySessionUpdate", {sessionId: data.params.id, deleted:true});
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