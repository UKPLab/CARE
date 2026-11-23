<template>
    <!-- Error state -->
  <StudyErrorPage v-if="studyError" :error="studyError"/>
  <StudyModal
      v-else-if="studySessionId === 0 || (studySession && studySession.start === null)"
      ref="studyModal"
      :study-id="studyId"
      :study-closed="studyClosed"
      :study-session-id="studySessionId"
      @finish="finalFinish"
      @start="start"
  />
  <StudyInstructions
      v-if="studySession && studySession.start"
      :study-id="studyId"
      :study-closed="studyClosed"
      :study-session-id="studySessionId"
      :show-button="!!study?.description"
  />
  <FinishModal
      v-if="!studyError"
      ref="studyFinishModal"
      :study-session-id="studySessionId"
      :show-time-up="timeUp"
      @finish="finalFinish({ studySessionId: studySessionId })"
  />
  <ReadOnlyBadge :show="readOnlyComputed"/>
  <StudyWorkspace
      :study="study"
      :study-session="studySession"
      :study-steps="studySteps"
      :current-study-step-id="currentStudyStepId"
      :read-only-view="readOnly"
      :time-left="timeLeft"
      :show-steps="studySessionId !== 0 && !studyError"
      @update-step="updateStep"
      @finish="finish"
      @loading-error="setStudyError($event.message, $event.code)"
      @error="$refs.studyModal?.close()"
  />
</template>

<script>
/**
 * Document view in study mode
 *
 * Loads a document in study mode; if a study session is provided, the session is loaded instead. Otherwise,
 * the user is prompted to start a study (or resume an existing session). This view owns the session: starting
 * and finishing it, its time limit, whether it is read-only and which step is current; the steps themselves are
 * shown by StudyWorkspace.
 *
 * @author Dennis Zyska, Manu Sundar Raj Nandyal, Linyin Huang
 */
import StudyModal from "@/components/study/StudyModal.vue";
import FinishModal from "./study/FinishModal.vue";
import StudyInstructions from "@/components/study/StudyInstructions.vue";
import StudyErrorPage from "@/components/study/StudyErrorPage.vue";
import ReadOnlyBadge from "@/components/study/ReadOnlyBadge.vue";
import StudyWorkspace from "@/components/study/StudyWorkspace.vue";
import {computed} from "vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "StudyRoute",
  components: {FinishModal, StudyModal, StudyInstructions, StudyErrorPage, ReadOnlyBadge, StudyWorkspace},
  inject: ["setStatsContext"],
  provide() {
    return {
      studySessionId: computed(() => this.studySessionId),
      readOnly: computed(() => this.readOnlyComputed),
      studySessionFinished: computed(() => this.studySessionFinished),
      currentStudyStep: computed(() => this.currentStep),
    };
  },
  // TODO: Only subscribe relevant entries (like current study session and steps)
  subscribeTable: ["study_step", "study_session", "workflow", "workflow_step", "annotation"],
  props: {
    studyHash: {type: String, required: false, default: null},
    initStudySessionId: {type: Number, required: false, default: 0},
    readOnly: {type: Boolean, required: false, default: false},
  },
  data() {
    return {
      studySessionId: 0,
      timeLeft: 0,
      timerInterval: null,
      localStudyStepId: 0,
      studyError: null,
    };
  },
  computed: {
    currentStep() {
      return this.studySteps.find((step) => step.id === this.currentStudyStepId) || {};
    },
    studySession() {
      if (this.studySessionId !== 0) {
        return this.$store.getters["table/study_session/get"](this.studySessionId);
      }
      return null;
    },
    study() {
      if (this.studySession) {
        return this.$store.getters["table/study/get"](this.studySession.studyId);
      }
      if (this.studyHash) {
        return this.$store.getters["table/study/getByHash"](this.studyHash);
      }
      return null;
    },
    studySteps() {
      if (this.studyId !== 0) {
        return this.$store.getters["table/study_step/getByKey"]("studyId", this.studyId);
      } else {
        return [];
      }
    },
    firstStep() {
      return this.studySteps ? this.studySteps.find((step) => step.studyStepPrevious === null) : null;
    },
    studyId() {
      return this.study ? this.study.id : 0;
    },
    timeUp() {
      return !!(this.study && this.study.timeLimit > 0 && this.timeLeft < 0);
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    studyStatsContext() {
      // studySessionId is 0 until the session loads; send null so it is left out of the stats
      return {studySessionId: this.studySessionId || null, currentStudyStepId: this.currentStudyStepId};
    },
    currentStudyStepId() {
      if (this.readOnlyComputed && this.firstStep) {
        return this.localStudyStepId === 0 ? this.firstStep.id : this.localStudyStepId;
      }
      if (this.studySession && this.studySession.studyStepId) {
        return this.studySession.studyStepId;
      }
      return null;
    },
    studySessionFinished() {
      return !!(this.studySession && this.studySession.end);
    },
    studyClosed() {
      if (this.study) {
        if(this.studySession?.parentStudySessionId !== null && this.studySession?.end === null){
          return false;
        }
        if (this.study.closed) {
          return true;
        }
        if (!this.study.multipleSubmit && this.study.end && new Date(this.study.end) < Date.now()) {
          return true;
        }
      }
      return false;
    },
    readOnlyComputed() {
      if (this.readOnly) {
        return this.readOnly;
      }
      if (this.studySession && this.studySession.userId !== this.userId) {
        return true;
      }
      if (this.studyClosed || this.timeUp) {
        return true;
      }
      return !!(this.studySession && this.studySession.end && !this.study.multipleSubmit);
    },
  },
  watch: {
    studyStatsContext: {
      handler(context) {
        this.setStatsContext(context);
      },
      immediate: true,
    },
    studySession() {
      if (this.study && this.study.timeLimit > 0 && this.studySession) {
        //studySession required, otherwise not all data may be there yet
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        this.calcTimeLeft();
        if (!this.studyClosed) {
          this.timerInterval = setInterval(this.calcTimeLeft, 1000);
        }
      }
    }
  },
  async mounted() {
    this.studySessionId = this.initStudySessionId;
    this.getStudyData();
  },
  beforeUnmount() {
    this.setStatsContext({studySessionId: null, currentStudyStepId: null});
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  },
  methods: {
    setStudyError(message, errorCode) {
      const titleMap = {
        NOT_FOUND: this.$t('components.studyRoute.errors.studyNotFoundTitle'),
        ACCESS_DENIED: this.$t('components.studyRoute.errors.accessDeniedTitle'),
        FILE_MISSING: this.$t('components.studyRoute.errors.filesMissingTitle'),
        DOCUMENT_NOT_FOUND: this.$t('components.studyRoute.errors.documentNotFoundTitle'),
      };

      this.studyError = {
        title: titleMap[errorCode] || this.$t('errors.permission.accessError'),
        message: message ? resolveApiMessage({ success: false, message }) : this.$t('components.studyRoute.errors.unexpectedError')
      };
    },
    /** Opens the start dialog unless the session has started; a session of someone else that has not started is refused. */
    getStudyData() {
      const notStarted = () => this.studySessionId === 0 || (this.studySession && this.studySession.start === null);
      if (this.studyHash) {
        this.$socket.emit("appDataByHash", {table: "study", hash: this.studyHash},
            (response) => {
              if (!response.success) {
                this.setStudyError(response.message, response.code);
              } else if (notStarted()) {
                this.openStudyModal();
              }
            }
        );
      } else if (this.studySession && this.studySession.start === null && this.studySession.userId !== this.userId) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.permission.accessError'),
          message: this.$t('components.studyRoute.errors.foreignUnstartedSession'),
          variant: "danger",
        });
        this.$router.push("/");
      } else if (notStarted()) {
        this.openStudyModal();
      }
    },
    start(data) {
      this.studySessionId = data.studySessionId;
    },
    /**
     * The start modal is rendered only for a session that has not started, and the
     * socket reply can arrive in the same turn that makes that true. Wait for the
     * render; skip the call if the view is already gone.
     */
    openStudyModal() {
      this.$nextTick(() => {
        this.$refs.studyModal?.open();
      });
    },
    calcTimeLeft() {
      if (this.studySession.start) {
        const timeSinceStart = (Date.now() - new Date(this.studySession.start)) / 1000;
        this.timeLeft = this.study.timeLimit * 60 - timeSinceStart;

        if (this.timeLeft < 0 && !this.studySessionFinished) {
          this.finish();
        }
      }
    },
    finalFinish(data) {
      this.$socket.emit("studySessionFinish", {studySessionId: data.studySessionId},
          (result) => {
            if (result.success) {
              this.eventBus.emit("toast", {
                title: this.$t('studies.messages.sessionFinished'),
                message: this.$t('studies.messages.sessionFinishedMessage'),
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('errors.studies.sessionNotFinished'),
                message: resolveApiMessage(result),
                variant: "danger",
              });
            }
          }
      );
      this.$refs.studyFinishModal.close();
    },
    finish() {
      if (this.studySessionFinished) {
        return;
      }
      // Prevent finishing if study is closed
      if (this.studyClosed) {
        this.eventBus.emit("toast", {
          title: this.$t('studies.messages.cannotFinishSession'),
          message: this.$t('studies.messages.studyClosedAutoTerminated'),
          variant: "warning",
        });
        return;
      }
      this.$refs.studyFinishModal.open();
    },
    updateStep(step) {
      // A read-only session is only browsed locally; otherwise the session moves on
      if (this.readOnlyComputed) {
        this.localStudyStepId = step;
      } else {
        this.$socket.emit("appDataUpdate", {
              table: "study_session", data: {id: this.studySessionId, studyStepId: step},
            },
            (result) => {
              if (!result.success) {
                this.eventBus.emit("toast", {
                  title: this.$t('errors.studies.stepUpdateFailed'),
                  message: resolveApiMessage(result),
                  variant: "danger",
                });
              }
            }
        );
      }
    },
  },
};
</script>
