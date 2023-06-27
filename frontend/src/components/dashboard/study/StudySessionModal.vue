<template>
  <Modal
    ref="studySessionModal"
    lg
    remove-close
    name="studySessionModal"
    :props="{studyId: studyId}"
  >
    <template #title>
      <span>
        Study Sessions of {{ study ? study.name : "unknown" }}
      </span>
    </template>
    <template #body>
      <DTable
        :columns="columns"
        :data="studySessions"
        :options="options"
        @action="action"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <button
          class="btn btn-secondary"
          @click="close"
        >Close</button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import DTable from "@/basic/table/Table.vue";

/* StudySessionModal.vue - details of study session for a given study in a modal

Modal including the details of existing study sessions for a study.

Author: Nils Dycke
Source: -
*/
export default {
  name: "StudySessionModal",
  components: {Modal, DTable},
  data() {
    return {
      studyId: 0,
      showFinished: true,
      hash: null,
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
        {name: "Manage", key: "manage", type: "button-group"},
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
            session.manage = [
                {
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
              },
                {
                icon: "link-45deg",
                options: {
                  iconOnly: true,
                  specifiers: {
                    "btn-outline-secondary": true,
                    "btn-sm": true,
                  }
                },
                title: "Copy session link",
                action: "copyStudySessionLink",
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
                title: "Delete Study Session",
                action: "deleteStudySession",
              },
            ];

            return session;
          });
    },
  },
  methods: {
    open(studyId) {
      this.studyId = studyId;
      this.load();
      // TODO: subscribe to room study
      this.$refs.studySessionModal.openModal();
    },
    close() {
      // TODO: unsubscribe from room study
      this.$refs.studySessionModal.close();
    },
    load() {
      if (!this.study) {
        this.$socket.emit("studyGetById", {studyId: this.studyId});
      }
    },
    action(data) {
      switch(data.action) {
        case "openStudySession":
          this.$router.push("/review/" + data.params.hash);
          break;
        case "copyStudySessionLink":
          this.copyURL(data.params.hash);
          break;
        case "deleteStudySession":
          this.$socket.emit("studySessionUpdate", {sessionId: data.params.id, deleted:true});
          break;
      }
    },
    async copyURL(hash) {
      const link = window.location.origin + "/review/" + hash;

      try {
        await navigator.clipboard.writeText(link);
        this.eventBus.emit('toast', {
          title: "Link copied",
          message: "Study session link copied to clipboard!",
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy study session link to clipboard!",
          variant: "danger"
        });
      }
    }
  }
}
</script>

<style scoped>

</style>