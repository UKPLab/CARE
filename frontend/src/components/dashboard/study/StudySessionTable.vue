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
import { dashboardRowAction, confirmSoftDelete } from "@/basic/dashboard/actions.js";
import { DEFAULT_DASHBOARD_TABLE_OPTIONS } from "@/basic/dashboard/constants.js";

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
      tableOptions: { ...DEFAULT_DASHBOARD_TABLE_OPTIONS },
    };
  },
  computed: {
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    tableColumns() {
      const columns = [
        {
          name: "ID",
          key: "id",
        },
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
        }
      ];

      if (this.hasCopiedSessions) {
        columns.push({
          name: "Parent Session ID",
          key: "parentStudySessionId",
        });
      }

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
      const sm = { specifiers: { "btn-sm": true } };
      const buttons = [];

      if (this.currentUserOnly) {
        buttons.push(dashboardRowAction("resume", {
          options: sm,
          filter: [{ key: "showResumeButton", value: true }],
          title: "Resume session",
          action: "openSession",
          stats: {
            studySessionId: "id",
          },
        }));
      } else {
        buttons.push(dashboardRowAction("open", {
          options: sm,
          title: "Open session",
          action: "openSession",
          stats: {
            studySessionId: "id",
          },
        }));
      }

      buttons.push(
        dashboardRowAction("start", {
          options: sm,
          filter: [{ key: "showStartButton", value: true }],
          title: "Start session",
          action: "startStudySession",
          stats: {
            studySessionId: "id",
          },
        }),
        dashboardRowAction("inspect", {
          options: sm,
          filter: [{ key: "showInspectButton", value: true }],
          title: "Inspect session",
          action: "reviewSession",
          stats: {
            studySessionId: "id",
          },
        }),
      );
      if (!this.currentUserOnly) {
        buttons.push(dashboardRowAction("link", {
          options: sm,
          title: "Copy session link",
          action: "copyStudySessionLink",
          stats: {
            studySessionId: "id",
          },
        }));
      }
      buttons.push(
        dashboardRowAction("copy", {
          options: sm,
          title: "Copy session",
          action: "copySession",
          stats: {
            studySessionId: "id",
          },
        }),
        dashboardRowAction("delete", {
          options: sm,
          filter: [
            {
              key: "showDeleteButton",
              value: true,
            },
          ],
          title: "Delete session",
          action: "deleteStudySession",
          stats: {
            studySessionId: "id",
          },
        }),
      );

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
      confirmSoftDelete(
        {
          confirmRef: this.$refs.deleteConf,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "study_session",
          id: params.id,
          title: "Delete Session",
          message: "You are about to delete a session; if you just want to finish the session, please access the session and abort the delete.",
          failTitle: "Study Session not deleted",
          onSuccess: () => {
            this.showSuccessToast("Study Session deleted", "Study session has been deleted");
            this.$emit("session-deleted", params.id);
          },
        }
      );
    },
    async copyURL(hash) {
      const link = `${window.location.origin}/review/${hash}`;
      try {
        await navigator.clipboard.writeText(link);
        this.showSuccessToast("Link copied", "Study session link copied to clipboard!");
      } catch (_error) {
        this.showErrorToast("Link not copied", "Could not copy study session link to clipboard!");
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
