<template>
  <Modal
      ref="modal"
      :props="$props"
      :disable-keyboard="!infoOnly"
      :size="showSessions ? 'lg' : 'md'"
      :name="infoOnly ? 'studyInfo' : 'studyStart'"
      :remove-close="!studyClosed && !infoOnly"
  >
    <template #title>
      <span v-if="showSessions">
        {{ $t('studies.openSessionsForStudy', { name: study.name }) }}
      </span>
      <span v-else-if="studyId !== 0">
        <span>{{ $t('studies.study') }}:</span> {{ study.name }}
      </span>
    </template>
    <template #body>
      <Loader
          v-if="studyId === 0"
          :loading="true"
      />
      <span v-else-if="showSessions">
        <StudySessionPicker
            :sessions="studySessions"
            :study="study"
            :study-closed="studyClosed"
            @action="sessionAction"
        />
      </span>
      <StudyParticipationDetails
          v-else
          :study="study"
          :study-closed="studyClosed"
          :started="started"
          :sessions-available="sessionsAvailable"
          :foreign-unstarted-session="Boolean(foreignUnstartedSession)"
          :study-session-id="studySessionId"
          :total-number-of-opened-sessions="totalNumberOfOpenedSessions"
      />
    </template>
    <template v-if="!infoOnly" #footer>
      <div class="btn-group">
      <BasicButton
          class="btn btn-outline-secondary"
          :text="$t('studies.returnToDashboard')"
          @click="returnToDashboard"
      />
      </div>
      <vr/>
      <div
          v-if="showSessions"
          class="btn-group"
      >
        <BasicButton
            class="btn btn-primary"
            :text="$t('common.back')"
            @click="showSessions=!showSessions"
        />
      </div>
      <div
          v-else
          class="btn-group"
      >
        <BasicButton
            v-if="studySessions.length > 0 && !studyClosed && studySessionId === 0"
            class="btn btn-secondary position-relative"
            @click="showSessions=!showSessions"
        >
          <span class="position-absolute top-0 start-0 translate-middle badge rounded-pill bg-dark">
            {{ studySessions.length }}
            <span class="visually-hidden">{{ $t('studies.openSessionsSmall') }}</span>
          </span>
          {{ $t('studies.openSessionsBig') }}
        </BasicButton>
        <BasicButton
            v-if="studyId !== 0 && !foreignUnstartedSession"
            :disabled="!available"
            class="btn btn-primary"
            :text="study.collab ? $t('studies.joinStudy') : $t('studies.startStudy')"
            @click="start"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Loader from "@/basic/Loading.vue";
import StudySessionPicker from "./StudySessionPicker.vue";
import StudyParticipationDetails from "./StudyParticipationDetails.vue";
import { resolveApiMessage, returnToDashboard as returnToDashboardHelper } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal for accessing a study
 *
 * This modal provides the option to either start a study or load an existing session.
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "StudyModal",
  subscribeTable: ["study_session"],
  components: {Loader, StudySessionPicker, Modal, StudyParticipationDetails, BasicButton},
  inject: {
    acceptStats: {default: () => false},
  },
  props: {
    studyId: {
      type: Number,
      required: true,
    },
    studyClosed: {
      type: Boolean,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: 0,
    },
    infoOnly: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  emits: ["start", "finish"],
  data() {
    return {
      hash: null,
      documentId: 0,
      showSessions: false,

    }
  },
  computed: {

    study() {
      if (this.studyId !== 0) {
        return this.$store.getters['table/study/get'](this.studyId)
      }
      return null;
    },

    studySession() {
      if (this.studySessionId !== 0) {
        return this.$store.getters['table/study_session/get'](this.studySessionId);
      }
      return null;
    },

    studySessions() {
      if (!this.studyId) return [];
      return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId)
          .filter(s => this.study && this.study.multipleSubmit ? (!this.study.closed) : s.end === null);
    },
    totalNumberOfOpenedSessions() {
      return (this.study.totalNumberOfOpenedSessions) ? this.study.totalNumberOfOpenedSessions : 0;
    },
    numberOfOpenedSessionsPerUser() {
      return this.$store.getters["table/study_session/getByKey"]("userId", this.userId)
          .filter(s => s.studyId === this.studyId).length;
    },
    started() {
      if (this.study && this.study.start !== null) {
        return (new Date(this.study.start) < new Date());
      }
      return true;
    },
    available() {
      return (
          (this.started && !this.studyClosed && this.sessionsAvailable) ||
          (this.studySessionId !== 0 && !this.studyClosed)
      ) && !this.foreignUnstartedSession;
    },
    sessionsAvailable() {
      if (this.study) {
        if (this.study.limitSessions !== null && this.study.limitSessions > 0) {
          return this.totalNumberOfOpenedSessions < this.study.limitSessions;
        }
        if (this.study.limitSessionsPerUser !== null && this.study.limitSessionsPerUser > 0) {
          return this.numberOfOpenedSessionsPerUser < this.study.limitSessionsPerUser;
        }
      }
      return true;
    },
    link() {
      return window.location.origin + "/study/" + this.hash;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    foreignUnstartedSession() {
      return (
          this.studySession &&
          this.studySession.start === null &&
          this.studySession.userId !== this.userId
      );
    },
  },
  methods: {
    open() {
      this.$refs.modal?.open();
    },
    close() {
      this.$refs.modal?.close();
    },
    /**
     * Starts a study session and reports the result of the server with a toast.
     *
     * The session update can reach the parent before the acknowledgement and unmount this modal, which also
     * removes $t from it. So the toasts only rely on values captured here, while Vue clears the ref to the
     * modal and ignores the emit of an unmounted component.
     * @param {number|null} studyId The study to start a session for, null to start an existing session
     * @param {number} studySessionId The existing session to start, 0 to start a new one
     */
    startStudy(studyId = null, studySessionId) {
      const eventBus = this.eventBus;
      const startedToast = {
        title: this.$t('studies.messages.studyStarted'),
        message: this.$t('studies.messages.enjoy'),
        variant: "success"
      };
      const errorTitle = this.$t('errors.studies.studyCannotStart');
      this.$socket.emit("studySessionStart",
          {studyId: studyId, studySessionId: studySessionId}, (response) => {
            if (response.success) {
              // Close before emitting: the parent may unmount this modal in response to "start".
              this.$refs.modal?.close();
              this.$emit("start", {studySessionId: response.data.id});
              eventBus.emit('toast', startedToast);
            } else {
              eventBus.emit('toast', {
                title: errorTitle,
                message: resolveApiMessage(response),
                variant: "danger"
              });
            }
          });
    },
    async returnToDashboard() {
      await returnToDashboardHelper(this.$router);
    },
    start() {
      this.startStudy(this.studyId, this.studySessionId);
    },
    sessionAction(data) {
      if (data.action === "finishSession") {
        this.$emit("finish", {studySessionId: data.params.id});
      }
      if (data.action === "resumeStudySession") {
        this.$emit("start", {studySessionId: data.params.id});
        this.$refs.modal.close();
      }
      if (data.action === "startStudySession") {
        this.startStudy(null, data.params.id);
      }
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "clickStudySessionButton",
          data: {
            action: data.action,
            ...(data.params.id ? {studySessionId: data.params.id} : {}),
          }
        });
      }
    }
  }
}
</script>

<style scoped>
</style>
