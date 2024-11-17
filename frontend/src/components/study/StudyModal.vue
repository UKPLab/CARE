<template>
  <Modal
    ref="modal"
    :props="$props"
    disable-keyboard
    lg
    name="studyStart"
    remove-close
  >
    <template #title>
      <span v-if="showSessions">
        Open Sessions for study: {{ study.name }}
      </span>
      <span v-else-if="studyId !== 0">
        <span>Study:</span> {{ study.name }}
      </span>
    </template>
    <template #body>
      <Loader
        v-if="studyId === 0"
        :loading="true"
      />
      <span v-else-if="showSessions">
        <DTable
          :columns="sessionTableColumns"
          :data="studySessions"
          :options="sessionTableOptions"
          @action="sessionAction"
        />
      </span>
      <span v-else>
        <div
          v-if="!started"
          class="text-xxl-center text-secondary fs-5">
          The study has not started yet! <br>
          Start: {{ new Date(study.start).toLocaleString() }}</div>
        <div
          v-else-if="studyClosed"
          class="text-xxl-center text-danger fs-5">
          This study has finished on
          {{ studyEnd }}</div>
        <div
          v-else-if="!sessionsAvailable"
          class="text-xxl-center text-danger fs-5">
          No more sessions available for this study.
        </div>
        <span v-else>
          <div
            v-if="study.description"
            v-html="study.description"
          />
          <div v-else>
            Click "Start User Study" to start the user study.
          </div>
          <div v-if="study.timeLimit > 0 || study.collab">
            <hr>
          </div>
          <div
            v-if="study.timeLimit > 0"
            class="mt-1"
          >
            Please note that there is a time limitation of {{ study.timeLimit }} min for this study!
          </div>
          <div
            v-if="study.collab"
            class="mt-1"
          >
            This is a <b>collaborative</b> user study, so everyone can join and proceed with this study simultaneously!
          </div>
        </span>
      </span>
    </template>
    <template #footer>
      <button
        class="btn btn-outline-secondary"
        type="button"
        @click="$router.push('/dashboard')"
      >
        <span>Return to dashboard</span>
      </button>
      <vr/>
      <div
        v-if="showSessions"
        class="btn-group"
      >
        <button
          class="btn btn-primary"
          type="button"
          @click="showSessions=!showSessions"
        >
          <span>Back</span>
        </button>
      </div>
      <div
        v-else
        class="btn-group"
      >
        <button
          v-if="studySessions.length > 0 && !studyClosed"
          class="btn btn-secondary"
          type="button"
          @click="showSessions=!showSessions"
        >
          <span class="position-absolute top-0 start-0 translate-middle badge rounded-pill bg-dark">
            {{ studySessions.length }}
            <span class="visually-hidden">open sessions</span>
          </span>
          <span>Open Sessions</span>
        </button>
        <button
          v-if="studyId !== 0"
          :disabled="!available"
          class="btn btn-primary"
          type="button"
          @click="start"
        >
          <span v-if="study.collab">Join Study</span>
          <span v-else>Start Study</span>
        </button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Loader from "@/basic/Loading.vue"
import DTable from "@/basic/table/Table.vue"

/**
 * Modal for accessing a study
 *
 * This modal provides the option to either start a study or load an existing session.
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "StudyModal",
  components: {Loader, DTable, Modal},
  props: {
    studyId: {
      type: Number,
      required: true,
    },
    studyClosed: {
      type: Boolean,
      required: true,
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
      },
      sessionTableColumns: [
        {name: "Started", key: "startParsed"},
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
          name: "Resumable",
          key: "resumable",
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
      if (this.studyId !== 0) {
        return this.$store.getters['table/study/get'](this.studyId)
      }
      return null;
    },
    studyEnd() {
      if (this.study) {
        if (this.study.closed) {
          return new Date(this.study.closed).toLocaleString()
        }
        if (this.study.end) {
          return new Date(this.study.end).toLocaleString()
        }
      }
      return "";
    },
    studySessions() {
      if (this.studyId) {
        return this.$store.getters["table/study_session/getByKey"]("studyId", this.studyId)
          .filter(s => s.end === null)
          .map(s => {
            let study = {...s}
            study.resumable = this.study.resumable;
            study.startParsed = new Date(study.start).toLocaleString();
            study.finished = study.end !== null
            study.manage = []
            if (!study.finished) {


              if (study.resumable) {
                study.manage.push({
                  icon: "box-arrow-in-right",
                  options: {
                    iconOnly: true,
                    specifiers: {
                      "btn-outline-secondary": true,
                      "btn-sm": true,
                    }
                  },
                  title: "Resume session",
                  action: "resumeSession",
                });
              }
              study.manage.push(
                {
                  icon: "x-octagon",
                  options: {
                    iconOnly: true,
                    specifiers: {
                      "btn-outline-secondary": true,
                      "btn-sm": true,
                    }
                  },
                  title: "Finish session",
                  action: "finishSession",
                })


            }
            return study;
          })
          ;
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
        if (!(this.study.start instanceof Date)) {
          throw new Error("Invalid type for study start date. Expected a Date object.");
        }
        return (new Date(this.study.start) < new Date());
      }
      return true;
    },
    available() {
      return (this.started && !this.studyClosed && this.sessionsAvailable);
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
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    start() {
      // needed, otherwise the ref in the callback can become null
      const modal = this.$refs.modal;

      if (this.studyClosed) {
        this.eventBus.emit('toast', {
          title: "Study cannot be started!",
          message: "The study is closed.",
          variant: "danger"
        });
        return;
      }

      if (!this.sessionsAvailable) {
        this.eventBus.emit('toast', {
          title: "Study cannot be started!",
          message: "The maximum number of sessions for this study has been reached.",
          variant: "danger"
        });
        return;
      }

      this.sockets.subscribe("studySessionStarted", (data) => {
        if (data.success) {
          this.$emit("start", {studySessionId: data.studySessionId});
          modal.waiting = false;
          modal.close();
          this.eventBus.emit('toast', {
            title: "Study started",
            message: "Enjoy!",
            variant: "success"
          });
        } else {
          modal.waiting = false;
          this.eventBus.emit('toast', {title: "Study cannot be started!", message: data.message, variant: "danger"});
        }
      });

      this.$socket.emit("studySessionStart", {studyId: this.studyId});
      modal.waiting = true;
    },
    sessionAction(data) {
      if (data.action === "finishSession") {
        this.$emit("finish", {studySessionId: data.params.id});
      }
      if (data.action === "resumeSession") {
        this.$emit("start", {studySessionId: data.params.id});
        this.$refs.modal.close();
      }
    }
  }
}
</script>

<style scoped>
</style>