<template>
  <StudyModal
    v-if="studySessionId === 0"
    ref="studyModal"
    :study-id="studyId"
    @finish="finish"
    @start="start"
  />
  <FinishModal
    ref="studyFinishModal"
    :closeable="!timeUp"
    :finished="finished"
    :study-session-id="studySessionId"
    @finish="finalFinish"
  />
  <Teleport to="#topbarCustomPlaceholder">
    <button
      class="btn btn-outline-secondary"
      type="button"
      @click="finish"
    >
      Finish Study
    </button>
    <button
      v-if="timeLeft > 0"
      class="btn mb-1"
      type="button"
    >
      <LoadIcon
        :size="21"
        class="me-1 middle"
        icon-name="stopwatch"
      />
      <span
        :class="{'text-danger':timeLeft < (5 * 60)}"
        class="middle"
      ><b>Time Left:</b> {{ timeLeftHuman }}</span>
    </button>
  </Teleport>
  <Annotator
    v-if="documentId !== 0 && documentType === 0 && studySessionId !== 0"
  />
  <Editor
    v-if="documentId !== 0 && documentType === 1 && studySessionId !== 0"
  />
</template>

<script>
/**
 * Document view in study mode
 *
 * Loads a document in study mode; if a study session is provided, the session is loaded instead. Otherwise,
 * the user is prompted to start a study (or resume an existing session).
 *
 * @author Dennis Zyska
 */
import StudyModal from "@/components/study/StudyModal.vue";
import Annotator from "./annotator/Annotator.vue";
import Editor from "./editor/Editor.vue";
import FinishModal from "./study/FinishModal.vue";
import LoadIcon from "@/basic/Icon.vue";
import { computed } from "vue";

export default {
  name: "StudyRoute",
  components: { LoadIcon, FinishModal, StudyModal, Annotator, Editor },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studySessionId: computed(() => this.studySessionId),
      readonly: this.readonly,
    };
  },
  props: {
    'studyHash': {
      type: String,
      required: false,
      default: null
    },
    'initStudySessionId': {
      type: Number,
      required: false,
      default: 0,
    },
    'readonly': {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  data() {
    return {
      studySessionId: 0,
      timeLeft: 0,
      timerInterval: null,
      documentId: 0,
      documentType: null,
    };
  },
  computed: {
    studySession() {
      if (this.studySessionId !== 0) {
        return this.$store.getters['table/study_session/get'](this.studySessionId);
      }
      return null;
    },
    study() {
      if (this.studySession) {
        return this.$store.getters['table/study/get'](this.studySession.studyId);
      }
      if (this.studyHash) {
        return this.$store.getters['table/study/getByHash'](this.studyHash);
      }
      return null;
    },
    studyId() {
      if (this.study) {
        return this.study.id;
      } else
        return 0;
    },
    finished() {
      if (this.studySession) {
        return this.studySession.end !== null;
      }
      return false;
    },
    timeUp() {
      if (this.study && this.study.timeLimit > 0) {
        if (this.timeLeft < 0) {
          return true;
        }
      }
      return false;
    },
    timeLeftHuman() {
      if (this.timeLeft < 60) {
        return Math.round(this.timeLeft) + "s";
      }
      return Math.round(this.timeLeft / 60) + "min";
    }
  },
  watch: {
    studySession(newVal) {
      if (this.study.timeLimit > 0 && this.studySession) {  //studySession required, otherwise not all data may be there yet
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        this.calcTimeLeft();
        if (!newVal.end) {
          this.timerInterval = setInterval(this.calcTimeLeft, 1000);
        }
      }
    },
    study(newVal) {
      if (newVal) {
        this.documentId = newVal.documentId;
        this.documentType = newVal.documentType; // Fetch document type when study changes
      } else {
        this.documentId = 0;
      }
    }
  },
  mounted() {
    this.studySessionId = this.initStudySessionId;
    if (this.studySessionId !== 0) {
      this.$socket.emit("studySessionGetById", { studySessionId });
    } else {
      this.$refs.studyModal.open();
      this.$socket.emit("studyGetByHash", { studyHash: this.studyHash });
    }
  },
  sockets: {
    studyError: function (data) {
      if (data.studyHash === this.studyHash) {
        this.eventBus.emit('toast', {
          title: "Study Error",
          message: data.message,
          variant: "danger"
        });
        this.$router.push("/");
      }
    },
    studyRefresh(data) {
      this.documentId = data.documentId;
      this.documentType = data.documentType;
    }
  },
  methods: {
    start(data) {
      this.studySessionId = data.studySessionId;
    },
    finalFinish(data) {
      this.$socket.emit("studySessionUpdate", {
        sessionId: this.studySessionId,
        comment: data.comment,
        end: Date.now()
      });
    },
    finish(data) {
      if (data.studySessionId) {
        this.studySessionId = data.studySessionId;
      }
      this.$refs.studyFinishModal.open();
    },
    calcTimeLeft() {
      const timeSinceStart = (Date.now() - new Date(this.studySession.start)) / 1000;
      this.timeLeft = this.study.timeLimit * 60 - timeSinceStart;

      if (this.timeLeft < 0) {
        this.finish({ studySessionId: this.studySessionId });
      }
    }
  }
};
</script>

<style scoped>
</style>