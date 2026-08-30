<template>
  <Modal
      ref="modal"
      :props="$props"
      disable-keyboard
      lg
      name="studyStart"
      :remove-close="!studyClosed"
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
        <BasicTable
            :columns="sessionTableColumns"
            :data="studySessions"
            :options="sessionTableOptions"
            :buttons="buttons"
            :max-table-height="'60vh'"
            @action="sessionAction"
        />
      </span>
      <span v-else>
        <div
            v-if="foreignUnstartedSession"
            class="text-xxl-center text-danger fs-5">
          {{ $t('studies.foreignUnstartedSession') }}
          <br>
          {{ $t('studies.cannotResumeSession') }}
        </div>
        <div
            v-else-if="!started"
            class="text-xxl-center text-secondary fs-5">
          {{ $t('studies.notStartedYet') }} <br>
          {{ $t('studies.messages.studyStartDate', { date: formatLocalizedDateTime(study.start) }) }}</div>
        <div
            v-else-if="studyClosed"
            class="text-xxl-center text-danger fs-5">
          {{ $t('studies.messages.studyFinished', { date: studyEnd }) }}</div>
        <div
            v-else-if="!sessionsAvailable && studySessionId === 0"
            class="text-xxl-center text-danger fs-5">
          {{ $t('studies.noMoreSessions') }}
        </div>
        <span v-else>
          <Editor
              v-if="study.description"
              v-model="study.description"
              :read-only="true"
              class="ql-snow ql-container border"
          />
          <div v-else>
            {{ $t('studies.clickToStart') }}
          </div>
          <div v-if="study.timeLimit > 0 || study.collab">
            <hr>
          </div>
          <div
              v-if="study.timeLimit > 0"
              class="mt-1"
          >
            {{ $t('studies.messages.timeLimitNote', { minutes: study.timeLimit }) }}
          </div>
          <div
              v-if="study.collab"
              class="mt-1"
          >
            <i18n-t keypath="studies.collaborativeNote" tag="span">
              <template #collaborative>
                <b>{{ $t('studies.collaborativeEmphasis') }}</b>
              </template>
            </i18n-t>
          </div>
          <div
              v-if="studySessionId === 0 && study.limitSessionsPerUser > 0"
              class="mt-1"
          >
            <i18n-t keypath="studies.messages.sessionsLeft" tag="span">
              <template #sessions>
                <b>{{ $t('studies.messages.sessionsLeftEmphasis', { count: study.limitSessionsPerUser - totalNumberOfOpenedSessions }) }}</b>
              </template>
            </i18n-t>
          </div>
        </span>
      </span>
    </template>
    <template #footer>
      <BasicButton
          class="btn btn-outline-secondary"
          :text="$t('studies.returnToDashboard')"
          @click="$router.push('/dashboard')"
      />
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
import BasicTable from "@/basic/Table.vue";
import Editor from "@/basic/editor/Editor.vue";
import { resolveApiMessage, formatLocalizedDateTime } from "@/assets/utils";
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
  components: {Loader, BasicTable, Modal, Editor, BasicButton},
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
    }
  },
  emits: ["start", "finish"],
  data() {
    return {
      hash: null,
      documentId: 0,
      showSessions: false,
      sessionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true
      }
    }
  },
  computed: {
    sessionTableColumns() {
      return [
        {name: this.$t('studies.columns.started'), key: "startParsed"},
        {
          name: this.$t('studies.columns.finished'),
          key: "finished",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: this.$t('studies.columns.resumable'),
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        }
      ];
    },
    study() {
      if (this.studyId !== 0) {
        return this.$store.getters['table/study/get'](this.studyId)
      }
      return null;
    },
    studyEnd() {
      if (this.study) {
        if (this.study.closed) {
          return formatLocalizedDateTime(this.study.closed)
        }
        if (this.study.end) {
          return formatLocalizedDateTime(this.study.end)
        }
      }
      return "";
    },
    studySession() {
      if (this.studySessionId !== 0) {
        return this.$store.getters['table/study_session/get'](this.studySessionId);
      }
      return null;
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
          filter: [
            {key: "showResumeButton", value: true},
          ],
          title: this.$t('studies.resumeSession'),
          action: "resumeStudySession",
        },
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "showStartButton", value: true}
          ],
          title: this.$t('studies.startSession'),
          action: "startStudySession",
          stats: {
            studySessionId: "id",
          }
        },
        {
          icon: "x-octagon",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "finished", value: false}
          ],
          title: this.$t('studies.finishSession'),
          action: "finishSession",
          stats: {
            studySessionId: "id",
          }
        }
      ]
    },
    studySessions() {
      if (this.studyId) {
        return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId)
            .filter(s => this.study && this.study.multipleSubmit ? (!this.study.closed) : s.end === null)
            .map(s => {
              let session = {...s}
              session.resumable = this.study.resumable;
              session.startParsed = session.start ? formatLocalizedDateTime(session.start) : this.$t('studies.sessionNotStarted');
              session.finished = session.end !== null
              session.showResumeButton = session.resumable && session.start && !this.studyClosed;
              session.showStartButton = !session.start && !this.studyClosed;

              return session;
            });
      }
      return [];
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
    formatLocalizedDateTime,
    open() {
      this.$refs.modal?.open();
    },
    close() {
      this.$refs.modal?.close();
    },
    startStudy(studyId = null, studySessionId) {

      this.$socket.emit("studySessionStart",
          {studyId: studyId, studySessionId: studySessionId}, (response) => {
            if (response.success) {
              // Close before emitting: the parent may unmount this modal in response to "start".
              this.$refs.modal?.close();
              this.$emit("start", {studySessionId: response.data.id});
              this.eventBus.emit('toast', {
                title: this.$t('studies.messages.studyStarted'),
                message: this.$t('studies.messages.enjoy'),
                variant: "success"
              });
            } else {
              this.eventBus.emit('toast', {
                title: this.$t('errors.studies.studyCannotStart'),
                message: resolveApiMessage(response),
                variant: "danger"
              });
            }
          });
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