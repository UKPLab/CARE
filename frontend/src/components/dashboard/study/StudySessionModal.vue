<template>
  <Modal ref="studySessionModal" lg remove-close name="studySessionModal"
         :props="{studyId: studyId}">
    <template v-slot:title>
      <span>
        Study Sessions of {{ study ? study.name : "unknown" }}
      </span>
    </template>
    <template v-slot:body>
      <Table :columns="columns" :data="studySessions" :options="options" @action="action"></Table>
    </template>
    <template v-slot:footer>
      <span class="btn-group">
        <button class="btn btn-secondary" @click="close">Close</button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Form from "@/basic/form/Form.vue";
import Table from "@/basic/table/Table.vue";

export default {
  name: "StudySessionModal.vue",
  components: {Modal, Form, Table},
  data() {
    return {
      studyId: 0,
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      columns: [
        {
          name: "User",
          key: "creator_name"
        },
        {
          name: "Started",
          key: "startParsed"
        },
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
          name: "Open",
          key: "open",
          type: "button",
          icon: "box-arrow-in-right",
          action: "openStudySession"
        },
      ]
    }
  },
  computed: {
    study() {
      return this.studyId ? this.$store.getters["study/getStudyById"](this.studyId) : null;
    },
    studySessions() {
      if (!this.study) {
        return [];
      }

      return this.$store.getters['study_session/getStudySessionsByStudyId'](this.studyId)
          .filter(s => this.showFinished || s.end === null)
          .map(s => {
            let session = {...s};

            session.startParsed = new Date(session.start).toLocaleString();
            session.finished = session.end !== null;
            session.open = {
                icon: "box-arrow-in-right",
                options: {
                  iconOnly: true,
                  specifiers: {
                    "btn-outline-secondary": true,
                    "btn-sm": true,
                  }
                },
                title: "Open session",
                action: "openStudySession",
            };
            return session;
          });
    },
  },
  methods: {
    open(studyId) {
      this.studyId = studyId;
      this.load();

      this.$refs.studySessionModal.openModal();
    },
    close() {
      this.$refs.studySessionModal.closeModal();
    },
    load() {
      if (!this.study) {
        this.$socket.emit("studyGetById", {studyId: this.studyId});
      }
    },
    action() {
      if (data.action === "openStudySession") {
        console.log("opening study session in readonly mode");
        //todo
      }
    }
  }
}
</script>

<style scoped>

</style>