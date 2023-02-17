<template>
    <Table :columns="columns" :data="studySessions" :options="options" @action="action"></Table>
    <ConfirmModal ref="confirmModal" ></ConfirmModal>
</template>

<script>
import Table from "@/basic/table/Table.vue";
import ConfirmModal from "@/basic/ConfirmModal.vue";

export default {
  name: "StudySessionTable.vue",
  components: {Table, ConfirmModal},
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
  mounted() {
    this.load();
  },
  computed: {
    study() {
      return this.$store.getters["study/getStudyById"](this.studyId);
    },
    studySessions() {
      if (!this.study) {
        return [];
      }

      return this.$store.getters['study_session/getStudySessionsByStudyId'](this.studyId)
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