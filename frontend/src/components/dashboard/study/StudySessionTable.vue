<template>
  <BasicTable
    :columns="tableColumns"
    :data="studySessions"
    :options="tableOptions"
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
 * Table of study sessions included in the study session dashboard component.
 *
 * @author: Nils Dycke, Linyin Huang
 */
export default {
  name: "StudySessionTable",
  components: { BasicTable, ConfirmModal },
  props: {
    studyId: {
      type: Number,
      required: true,
    },
    currentUserOnly: {
      type: Boolean,
      default: false,
      description: "If true, only shows sessions for the current user",
    },
  },
  emits: ["update", "session-deleted", "session-opened"],
  data() {
    return {
      showFinished: true,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
    };
  },
  computed: {
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    tableColumns() {
      const columns = [
        {
          name: "Started",
          key: "startParsed",
        },
        {
          name: "Finished",
          key: "finished",
          type: "badge",
          typeOptions: {
            keyMapping: { true: "Yes", false: "No" },
            classMapping: { true: "bg-success", false: "bg-danger" },
          },
        },
      ];

      if (this.currentUserOnly) {
        columns.push({
          name: "Resumable",
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: { true: "Yes", false: "No" },
            classMapping: { true: "bg-success", false: "bg-danger" },
          },
        });
      }

      if (!this.currentUserOnly) {
        columns.unshift({
          name: "User",
          key: "creator_name",
        });

        if (this.canReadPrivateInformation) {
          columns.splice(1, 0, { name: "FirstName", key: "firstName" }, { name: "LastName", key: "lastName" });
        }
      }

      return columns;
    },
    buttons() {
      const buttons = [
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          filter: this.currentUserOnly ? [{ key: "showResumeButton", value: true }] : [],
          title: this.currentUserOnly ? "Resume session" : "Open session",
          action: "openSession",
        },
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          filter: [{ key: "showStartButton", value: true }],
          title: "Start session",
          action: "startSession",
        },
      ];
      if (!this.currentUserOnly) {
        buttons.push({
          icon: "link-45deg",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: "Copy session link",
          action: "copyStudySessionLink",
        });
      }
      buttons.push({
        icon: "trash",
        options: {
          iconOnly: true,
          specifiers: {
            "btn-outline-danger": true,
            "btn-sm": true,
          },
        },
        filter: [
          {
            key: "showDeleteButton",
            value: true,
          },
        ],
        title: "Delete session",
        action: "deleteStudySession",
      });

      return buttons;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    study() {
      return this.studyId ? this.$store.getters["table/study/get"](this.studyId) : null;
    },
    studySessions() {
      if (!this.study) return [];

      // TODO: Need to clarify what this line means.Since there is no function that updates the value of `this.showFinished`,
      // `this.showFinished` will always be true, which means the filter function won't filter anything.
      let sessions = this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId).filter(
        (s) => this.showFinished || s.end === null
      );

      if (this.currentUserOnly) {
        sessions = sessions.filter((s) => s.userId === this.userId);
      }

      return sessions.map((s) => this.processSession(s));
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
        this.$socket.emit("studyGetById", { studyId: this.studyId });
      }
    },
    processSession(session) {
      const processedSession = { ...session };

      processedSession.startParsed = this.formatDate(session.start);
      processedSession.finished = session.end !== null;

      if (this.currentUserOnly) {
        processedSession.resumable = this.study.resumable;
        processedSession.showResumeButton = session.resumable && session.start && !this.studyClosed;
        processedSession.showDeleteButton =
          this.userId === this.study.createdByUserId && this.userId !== this.study.userId;
        processedSession.showStartButton = !session.start && !this.studyClosed;
      } else {
        processedSession.showDeleteButton =
          this.$store.getters["auth/getUserId"] === this.study.createdByUserId || this.$store.getters["auth/isAdmin"];
        if (this.canReadPrivateInformation) {
          this.addUserInfo(processedSession);
        }
      }

      return processedSession;
    },
    formatDate(date) {
      return date ? new Date(date).toLocaleString() : "not yet";
    },
    addUserInfo(session) {
      const user = this.$store.getters["table/user/get"](session.userId);
      if (user) {
        session.firstName = user.firstName;
        session.lastName = user.lastName;
      }
    },
    action(data) {
      switch (data.action) {
        case "openSession": {
          const prefix = this.currentUserOnly ? "session" : "review";
          this.$router.push(`/${prefix}/${data.params.hash}`);
          this.$emit("session-opened", data.params);
          break;
        }
        case "startSession":
          this.$router.push("/session/" + data.params.hash);
          break;
        case "copyStudySessionLink":
          this.copyURL(data.params.hash);
          break;
        case "deleteStudySession":
          this.confirmDelete(data.params);
          break;
      }
    },
    confirmDelete(params) {
      this.$refs.deleteConf.open(
        "Delete Session",
        "You are about to delete a session; if you just want to finish the session, please access the session and abort the delete.",
        null,
        (confirmed) => {
          if (confirmed) {
            this.deleteSession(params.id);
          }
        }
      );
    },
    deleteSession(sessionId) {
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "study_session",
          data: {
            id: sessionId,
            deleted: true,
          },
        },
        (result) => {
          if (result.success) {
            this.showSuccessToast("Study Session deleted", "Study session has been deleted");
            this.$emit("session-deleted", sessionId);
          } else {
            this.showErrorToast("Study Session not deleted", result.message);
          }
        }
      );
    },
    async copyURL(hash) {
      const link = `${window.location.origin}/review/${hash}`;
      try {
        await navigator.clipboard.writeText(link);
        this.showSuccessToast("Link copied", "Study session link copied to clipboard!");
      } catch (error) {
        this.showErrorToast("Link not copied", "Could not copy study session link to clipboard!");
      }
    },
    showSuccessToast(title, message) {
      this.eventBus.emit("toast", {
        title,
        message,
        variant: "success",
      });
    },
    showErrorToast(title, message) {
      this.eventBus.emit("toast", {
        title,
        message,
        variant: "danger",
      });
    },
  },
};
</script>

<style scoped></style>
