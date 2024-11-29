<template>
  <EditReviewerModal ref="editReviewerModal"/>
  <BasicModal
    ref="studySessionModal"
    :props="{studyId: studyId}"
    lg
    name="studySessionModal"
    remove-close
    @hide=""
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
        <BasicButton
          class="btn btn-secondary"
          @click="close"
          title="Close"
        />
      </span>
      <BasicButton
          class="btn btn-primary"
          @click="add"
          title="Add"
        />
    </template>
  </BasicModal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import DTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import EditReviewerModal from "./EditReviewerModal.vue";
import BasicModal from "@/basic/Modal.vue";
import { computed } from "vue";

/**
 * Details of study session for a given study in a modal
 *
 * Modal including the details of existing study sessions for a study.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "StudySessionModal",
  components: {Modal, DTable, BasicButton, EditReviewerModal, BasicModal},
  provide() {
    return {
      mainModal: computed(() => this.$refs.studySessionModal)
    }
  },
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
    }
  },
  computed: {
    study() {
      return this.studyId ? this.$store.getters["table/study/get"](this.studyId) : null;
    },
    columns(){ 
      let cols = [
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

    if (this.canReadPrivateInformation) {
        cols.splice(1, 0, {name: "FirstName", key: "firstName"});
        cols.splice(2, 0, {name: "LastName", key: "lastName"});
      }
      return cols;
    },
    studySessions() {
      if (!this.study) {
        return [];
      }
      return this.$store.getters['table/study_session/getByKey']("studyId", this.studyId)
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
            
          ];
          if (this.$store.getters["auth/getUserId"] === this.study.createdByUserId || this.$store.getters["auth/isAdmin"]) {
            session.manage.push({
              icon: "trash",
              options: {
                iconOnly: true,
                specifiers: {
                  "btn-outline-danger": true,
                  "btn-sm": true,
                }
              },
              title: "Delete session",
              action: "deleteStudySession",
            });
          }
          if (this.canReadPrivateInformation) {
            const user = this.$store.getters["admin/user/get"](this.study.userId);
            if (user) {
              session.firstName = user.firstName;
              session.lastName = user.lastName;
            }
          }
          return session;
        });
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
  },
  methods: { 
    open(studyId) {
      this.studyId = studyId;
      this.load();
      this.$socket.emit("studySessionSubscribe", {studyId: studyId});
      this.$refs.studySessionModal.open();
    },
    close() {
      this.$socket.emit("studySessionUnsubscribe", {studyId: this.studyId});
      this.$refs.studySessionModal.close();
    },
    add() {
      this.$refs.editReviewerModal.open(this.studyId, this.$refs.studySessionModal);
    },
    load() {
      if (!this.study) {
        this.$socket.emit("studyGetById", {studyId: this.studyId});
      }
    },
    action(data) { 
      switch (data.action) {
        case "openStudySession":
          this.$router.push("/review/" + data.params.hash);
          break;
        case "copyStudySessionLink":
          this.copyURL(data.params.hash);
          break;
        case "deleteStudySession":
          this.$socket.emit("studySessionUpdate", {sessionId: data.params.id, deleted: true});
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