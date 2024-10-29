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
      :closeable="!timeUp && !studyClosed"
      :finished="finished"
      :study-session-id="studySessionId"
      @finish="finalFinish"
  />

  <Teleport to="#topbarCustomPlaceholder">
    <div class="d-flex justify-content-between align-items-center w-100">

      <TopBarButton
          v-if="currentWorkflowStep && currentWorkflowStep.allowBackward && currentStudyStep && currentStudyStep.studyStepPrevious !== null"
          class="btn btn-outline-primary me-3"
          title="Previous"
          @click="updateStep(currentStudyStep.studyStepPrevious)"
      >
        Previous
      </TopBarButton>

      <TopBarButton
          v-if="studySession && lastStep && currentWorkflowStep && currentWorkflowStep.stepType !== 3 && studySession.studyStepId === lastStep.id"
          class="btn btn-outline-secondary mx-3"
          title="Finish Study"
          @click="finish"
      >
        Finish Study
      </TopBarButton>

      <TopBarButton
          v-if="currentStudyStep && lastStep && currentStudyStep.id !== lastStep.id"
          class="btn btn-outline-primary ms-3"
          title="Next"
          @click="updateStep(nextStudyStep.id)"
      >
        Next
      </TopBarButton>

      <TopBarButton
          v-if="timeLeft > 0"
          class="btn mb-1"
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
      </TopBarButton>
    </div>
  </Teleport>
    <div v-if="studySessionId !== 0 && studySession.studyStepId">
    <div v-for="(s, index) in studySteps" :key="index">
      <div v-show="s.id === studySession.studyStepId">
        <Annotator v-if="workflowSteps[index].stepType === 1 && studyTrajectory.includes(s.id)"/>
      </div>
      <div v-show="s.id === studySession.studyStepId">
        <Editor v-if="workflowSteps[index].stepType === 2 && studyTrajectory.includes(s.id)"/>
      </div>
      <!-- TODO add stepType 3 Modal component and add Finish Button if we are in the last step -->
    </div>
  </div>
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
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import {computed} from "vue";

export default {
  name: "StudyRoute",
  components: {LoadIcon, FinishModal, StudyModal, Annotator, Editor, TopBarButton},
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
      currentStep: 0, //dummy code for allowNavigation
      maxSteps: 2, //dummy code for allowNavigation
      allowBackward: false
    };
  },
  computed: {
    allowNavigation() {
      return this.study ? this.study.allowNavigation : false;
    },
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
    studySteps() {
      if (this.studyId !== 0) {
        return this.$store.getters['table/study_step/getByKey']("studyId", this.studyId);
      } else {
        return [];
      }
    },
    currentStudyStep() {
      const step = this.studySession && this.studySession.studyStepId
            ? this.$store.getters['table/study_step/get'](this.studySession.studyStepId)
            : null;
        return step;
    },
    nextStudyStep(){
        const step = this.studySession && this.studySession.studyStepId
            ? this.$store.getters['table/study_step/get'](this.studySession.studyStepId)
            : null;
        return step;
    },
    currentWorkflowStep() {
      return this.currentStudyStep && this.currentStudyStep.workflowStepId
            ? this.$store.getters['table/workflow_step/get'](this.currentStudyStep.workflowStepId)
            : null
    },
    lastStep() {
      const previousStepIds = this.studySteps.map(step => step.studyStepPrevious);
      return this.studySteps.find(step => previousStepIds.includes(step.id));
    },
    workflowSteps() {
      const steps = this.studySteps.length > 0
            ? this.studySteps.map(studyStep => this.$store.getters['table/workflow_step/get'](studyStep.workflowStepId))
            : [];
      return steps;
    },
    studyTrajectory() {
      if (!this.studySession || !this.studySession.studyStepIdMax) return [];
        let studyTrajectory = [];
        let studyStep = this.$store.getters['table/study_step/get'](this.studySession.studyStepIdMax);
        while (studyStep) {
            studyTrajectory.push(studyStep.id);
            studyStep = studyStep.studyStepPrevious
                ? this.$store.getters['table/study_step/get'](studyStep.studyStepPrevious)
                : null;
        }
        return studyTrajectory;
    },
    studyId() {
      if (this.study) {
        return this.study.id;
      } else {
        return 0;
      }
    },
    finished() {
      if (this.studySession) {
        return this.studySession.end !== null;
      }

      if (this.study && this.study.end) {
        if (this.study.end !== null && this.study.end !== undefined) {
          if (!(this.study.end instanceof Date)) {
            throw new Error("Invalid type for study end date. Expected a Date object.");
          }
          return Date.now() > new Date(this.study.end);
        }
      }

      if (this.study && this.study.closed) {
        if (this.study.closed !== null && this.study.closed !== undefined) {
          if (!(this.study.closed instanceof Date)) {
            throw new Error("Invalid type for study close date. Expected a Date object.");
          }
          return Date.now() > new Date(this.study.closed);
        }
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
    studyClosed() {
      if (this.study && this.study.closed) {
        if (this.study["closed"] !== null && this.study["closed"] !== undefined) {
          if (!(this.study["closed"] instanceof Date)) {
            throw new Error("Invalid type for study close date. Expected a Date object.");
          }
          return Date.now > new Date(this.study.closed);
        }
      }

      if (this.study && this.study.end) {
        if (this.study.end !== null && this.study.end !== undefined) {
          if (!(this.study.end instanceof Date)) {
            throw new Error("Invalid type for study end date. Expected a Date object.");
          }
          return Date.now() > new Date(this.study.end);
        }
      }

      return false;
    },
    timeLeftHuman() {
      if (this.timeLeft < 60) {
        return Math.round(this.timeLeft) + "s";
      }
      return Math.round(this.timeLeft / 60) + "min";
    },
    allowBackward() {
      //in study step; to find the study steps related use workflowId and then in each of the studyStep Id the allowBackward is set
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
    }
  },
  mounted() {
    this.$socket.emit("studyGetByHash", {studyHash: this.studyHash});
    this.studySessionId = this.initStudySessionId;
    if (this.studySessionId === 0) {
      this.$refs.studyModal.open();
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
  },
  methods: {
    start(data) {
      this.studySessionId = data.studySessionId;
      this.documentId = this.currentStudyStep ? this.currentStudyStep.documentId : 0;
    },

    calcTimeLeft() {
      const timeSinceStart = (Date.now() - new Date(this.studySession.start)) / 1000;
      this.timeLeft = this.study.timeLimit * 60 - timeSinceStart;

      if (this.timeLeft < 0) {
        this.finish({studySessionId: this.studySessionId});
      }
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

      if (this.finished && !this.study.multipleSubmit) {
        this.$refs.studyFinishModal.open();
        return;
      }
    },
    updateStep(step) {
      this.$socket.emit("appDataUpdate", {
          id: this.studySessionId,
          table: "study_session",
          data: {
            studyStepId: step
          },
        });
    },
  }
};
</script>

<style scoped>
.d-flex {
  width: 100%;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.me-3 {
  margin-right: 1rem;
}

.ms-3 {
  margin-left: 1rem;
}
</style>