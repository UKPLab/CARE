<template>
  <BasicTable
    :columns="columns"
    :data="studySessions"
    :options="options"
    @action="action"
  />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
import BasicTable from "@/basic/table/Table.vue";
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
        {name: "Manage", key: "manage", type: "button-group"},
      ]
    }
  },
  computed: {
    study() {
      return this.$store.getters["table/study/get"](this.studyId);
    },
    studySessions() {
      if (!this.study) {
        return [];
      }

      return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId)
          .filter(s => this.showFinished || s.end === null)
          .map(s => {
            let session = {...s};

            session.resumable = this.study.resumable;
            session.startParsed = new Date(session.start).toLocaleString();
            session.finished = session.end !== null
            session.manage = []

            if (!session.finished) {
              if (session.resumable) {
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
        case "deleteSession":
          this.$refs["confirmModal"].open(
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