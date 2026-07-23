<template>
  <BasicTable
    :columns="tableColumns"
    :data="studySessions"
    :options="tableOptions"
    :buttons="buttons"
    @action="action"
  />
  <ConfirmModal ref="deleteConf" />
  <AssignUserModal ref="assignUserModal"/>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AssignUserModal from "@/components/dashboard/study/AssignUserStudySessionModal.vue";

/**
 * Table of study session with management buttons
 *
 * Table of study sessions included in the study session dashboard component.
 *
 * @author: Nils Dycke, Linyin Huang
 */
export default {
  name: "StudySessionTable",
  subscribeTable: ["user", "study_session"],
  components: { BasicTable, ConfirmModal, AssignUserModal },
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
    showClosed: {
      type: Boolean,
      default: false,
      description: "If true, shows only closed sessions for the current user",
    },
    showAll: {
      type: Boolean,
      default: false,
      description: "If true, shows all sessions",
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
          name: this.$t('common.id'),
          key: "id",
        },
        {
          name: this.$t('studies.columns.started'),
          key: "startParsed",
        },
        {
          name: this.$t('studies.columns.finished'),
          key: "finished",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t('common.yes'), false: this.$t('common.no') },
            classMapping: { true: "bg-success", false: "bg-danger" },
          },
        }
      ];

      if (this.hasCopiedSessions) {
        columns.push({
          name: this.$t('studies.columns.parentSessionId'),
          key: "parentStudySessionId",
        });
      }

      if (this.currentUserOnly) {
        columns.push({
          name: this.$t('studies.columns.resumable'),
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t('common.yes'), false: this.$t('common.no') },
            classMapping: { true: "bg-success", false: "bg-danger" },
          },
        });
      }

      if (!this.currentUserOnly) {
        columns.unshift({
          name: this.$t('common.user'),
          key: "creator_name",
        });

        if (this.canReadPrivateInformation) {
          columns.splice(1, 0, { name: this.$t('common.firstName'), key: "firstName" }, { name: this.$t('common.lastName'), key: "lastName" });
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
          title: this.currentUserOnly ? this.$t('studies.resumeSession') : this.$t('dashboard.study.openSession'),
          action: "openSession",
          stats:{
            studySessionId: "id",
          }
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
          title: this.$t('studies.startSession'),
          action: "startStudySession",
          stats:{
            studySessionId: "id",
          }
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
          filter: [{ key: "showInspectButton", value: true }],
          title: this.$t('dashboard.study.inspectSession'),
          action: "reviewSession",
          stats:{
            studySessionId: "id",
          } 
        }
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
          title: this.$t('dashboard.study.copySessionLink'),
          action: "copyStudySessionLink",
          stats:{
            studySessionId: "id",
          }
        });
      }
      buttons.push(
        {
          icon: "copy",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: this.$t('dashboard.study.copySession'),
          action: "copySession",
          stats:{
            studySessionId: "id",
          }     
        },
        {
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
        title: this.$t('dashboard.study.deleteSession'),
        action: "deleteStudySession",
        stats:{
            studySessionId: "id",
          }
      });

      return buttons;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    study() {
      return this.studyId ? this.$store.getters["table/study/get"](this.studyId) : null;
    },
    hasCopiedSessions() {
      if (!this.study) return false;

      return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId).some(
        (session) => session.parentStudySessionId !== null
      );
    },
    studySessions() {
      if (!this.study) return [];
      if(this.showAll) {
        return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId).map((s) => this.processSession(s));
      }

      if (this.studyClosed && !this.showClosed) return [];

      

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
    studyResumable() {
      return this.study ? this.study.resumable : false;
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
      processedSession.parentStudySessionId = session.parentStudySessionId ?? "-";
      if (this.currentUserOnly) {

        // True only when study is closed, session is not finished, and was copied from a parent session
        const canResumeOrStart = this.studyClosed && session.end === null && session.parentStudySessionId !== null;
        processedSession.resumable = this.studyResumable;

        processedSession.showResumeButton = (this.studyResumable && session.start !== undefined && session.start !== null && !this.studyClosed) || (this.studyResumable && session.start !== undefined && session.start !== null && canResumeOrStart);
        processedSession.showDeleteButton = this.userId === this.study.createdByUserId && this.userId !== this.study.userId;
        processedSession.showStartButton = (!session.start && !this.studyClosed) || (!session.start && canResumeOrStart);
        processedSession.showInspectButton = this.showClosed && !canResumeOrStart;
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
      return date ? new Date(date).toLocaleString() : this.$t('dashboard.study.notYet');
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
        case "startStudySession":
          this.$router.push("/session/" + data.params.hash);
          break;
        case "reviewSession":
          this.$router.push("/review/" + data.params.hash);
          break;
        case "copyStudySessionLink":
          this.copyURL(data.params.hash);
          break;
        case "deleteStudySession":
          this.confirmDelete(data.params);
          break;
        case "copySession":
          this.copySession(data.params);
          break;
      }
    },
    confirmDelete(params) {
      this.$refs.deleteConf.open(
        this.$t('dashboard.study.deleteSession'),
        this.$t('dashboard.study.deleteSessionNote'),
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
            this.showSuccessToast(this.$t('dashboard.study.studySessionDeleted'), this.$t('dashboard.study.studySessionHasBeenDeleted'));
            this.$emit("session-deleted", sessionId);
          } else {
            this.showErrorToast(this.$t('dashboard.study.studySessionNotDeleted'), result.message);
          }
        }
      );
    },
    async copyURL(hash) {
      const link = `${window.location.origin}/review/${hash}`;
      try {
        await navigator.clipboard.writeText(link);
        this.showSuccessToast(this.$t('studies.messages.linkCopied'), this.$t('dashboard.study.studySessionCopiedMessage'));
      } catch (_error) {
        this.showErrorToast(this.$t('errors.clipboard.linkNotCopied'), this.$t('errors.clipboard.couldNotCopyStudySession'));
      }
    },
    async copySession(params) {
      this.$refs.assignUserModal.open(params);
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
