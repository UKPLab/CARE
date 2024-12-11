<template>
  <AddAssignmentModal ref="addAssignmentModal" name="addAssignmentModal"/>
  <BasicModal
    ref="studySessionModal"
    :props="{studyId: studyId}"
    lg
    name="studySessionModal"
    remove-close
  >
    <template #title>
      <span>
        Study Sessions of {{ studyName }}

      </span>
    </template>
    <template #body>
      <DTable
        :columns="columns"
        :data="studySessions"
        :options="options"
        :buttons="buttons"
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
        v-if="isAdmin"
        class="btn btn-primary"
        @click="addSingleAssignment"
        title="Add"
      />
    </template>
  </BasicModal>
  <ConfirmModal ref="deleteConf"/>
</template>

<script>
import DTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import AddAssignmentModal from "./AddAssignmentModal.vue";
import BasicModal from "@/basic/Modal.vue";
import {computed} from "vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

/**
 * Details of study session for a given study in a modal
 *
 * Modal including the details of existing study sessions for a study.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "StudySessionModal",
  components: {ConfirmModal, DTable, BasicButton, AddAssignmentModal, BasicModal},
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
    studyName() {
      return this.study ? this.study.name : "unknown";
    },
    canAddSingleAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addSingleAssignments");
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    columns() {
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
      ]

      if (this.canReadPrivateInformation) {
        cols.splice(1, 0, {name: "FirstName", key: "firstName"});
        cols.splice(2, 0, {name: "LastName", key: "lastName"});
      }
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
              "btn-outline-danger": true,
              "btn-sm": true,
            }
          },
          filter: [{
            key: "showDeleteButton",
            value: true
          }],
          title: "Delete session",
          action: "deleteStudySession",
        }
      ]
    },
    studySessions() {
      if (!this.study) {
        return [];
      }
      return this.$store.getters['table/study_session/getByKey']("studyId", this.studyId)
        .filter(s => this.showFinished || s.end === null)
        .map(s => {
          let session = {...s};
          session.startParsed = (session.start) ? new Date(session.start).toLocaleString() : "not yet";
          session.finished = session.end !== null;
          session.showDeleteButton = this.$store.getters["auth/getUserId"] === this.study.createdByUserId || this.$store.getters["auth/isAdmin"];
          if (this.canReadPrivateInformation) {
            const user = this.$store.getters["table/user/get"](session.userId);
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
    addSingleAssignment() {
      this.$refs.addAssignmentModal.open(this.studyId);
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