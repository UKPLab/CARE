<template>
  <StudyModal
      v-if="studySessionId === 0"
      ref="studyModal"
      :study-id="studyId"
      :study-closed="studyClosed"
      @finish="finish"
      @start="start"
  />
  <FinishModal
      ref="studyFinishModal"
      :closeable="!timeUp && !studyClosed"
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
          v-if="!readonlyComputed && studySession && lastStep && currentWorkflowStep && currentWorkflowStep.stepType !== 3 && studySession.studyStepId === lastStep.id"
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
    <div v-if="studySessionId !== 0">
    <div v-for="(s, index) in studySteps" :key="index">
      <div v-show="s.id === currentStudyStepId">
        <Annotator v-if="workflowSteps[index].stepType === 1 && studyTrajectory.includes(s.id)" :document-id = "s.documentId" :study-step-id="s.id"/>
      </div>
      <div v-show="s.id === currentStudyStepId">
        <Editor v-if="workflowSteps[index].stepType === 2 && studyTrajectory.includes(s.id)" :document-id = "s.documentId" :study-step-id="s.id"/>
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
 * @author Dennis Zyska, Manu Sundar Raj Nandyal
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
      studySessionId: computed(() => this.studySessionId),
      readonly: computed(() => this.readonlyComputed),
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
      localStudyStepId: 0,
      readonlyTimer: false,
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

    nextStudyStep() {
      if (this.currentStudyStep) {
        // Find the next step by looking for a step where `studyStepPrevious` matches `currentStudyStep.id`
        const nextStep = this.studySteps.find(step => step.studyStepPrevious === this.currentStudyStep.id);
        return nextStep;
      }
    },
    currentWorkflowStep() { // TODO think about what will happen if we have af one_step workflow
      return this.currentStudyStep && this.currentStudyStep.workflowStepId
            ? this.$store.getters['table/workflow_step/get'](this.currentStudyStep.workflowStepId)
            : null
    },
    lastStep() {
      const previousStepIds = this.studySteps
            .map(step => step.studyStepPrevious)
            .filter(id => id !== null); // Excluding null to avoid the first step
        const lastStep = this.studySteps.find(step => !previousStepIds.includes(step.id));
        return lastStep;
    },
    firstStep() {
      return (this.studySteps) ? this.studySteps.find(step => step.studyStepPrevious === null) : null;
    },
    workflowSteps() {
      const steps = this.studySteps.length > 0
            ? this.studySteps.map(studyStep => this.$store.getters['table/workflow_step/get'](studyStep.workflowStepId))
            : [];
      return steps;
    },
    studyTrajectory() {
      if (!this.studySession) return [];
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
    },
    currentStudyStep() {
      return (this.currentStudyStepId)
            ? this.$store.getters['table/study_step/get'](this.currentStudyStepId)
            : null;
    },
    currentStudyStepId(){
      if(this.readonlyComputed && this.firstStep){
        return this.localStudyStepId === 0 ? this.firstStep.id : this.localStudyStepId;
      }      
      if (this.studySession && this.studySession.studyStepId) {
        return this.studySession.studyStepId;
      }
    },
    studyClosed() {
      if(this.study) {
        if (this.study.closed) {
          return true;
        }
        if (!this.study.multipleSubmit && this.study.end && this.study.end < Date.now()) {
          return true;
        }
      }
      return false;
    },
    readonlyComputed(){
      if (this.readonly) {
        return this.readonly;
      }
      if (this.studyClosed || this.readonlyTimer) {
        return true;
      }
      if (this.studySession && this.studySession.end && !this.study.multipleSubmit) {
        return true;
      }
      return false;
    }
  },
  watch: {
    studySession(newVal) {
      if (this.study.timeLimit > 0 && this.studySession) {  //studySession required, otherwise not all data may be there yet
        this.readonlyTimer = false;
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        this.calcTimeLeft();
        if (!newVal.end) {
          this.timerInterval = setInterval(this.calcTimeLeft, 1000);
        }else{
          this.readonlyTimer = true;
        }
      }
    },
  },
  mounted() {
    this.$socket.emit("studyGetByHash", {studyHash: this.studyHash});
    this.studySessionId = this.initStudySessionId;
    console.log("Studysessionid", this.studySessionId);
    if (this.studySessionId === 0) {
      console.log("StudyRoute studyId before rendering StudyModal:", this.studyId);
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
        end: Date.now()
      });
      this.$refs.studyFinishModal.close();
    },
    finish() {
      this.$refs.studyFinishModal.open();
    },
    updateStep(step) {
      if(this.readonlyComputed){
        this.localStudyStepId = step;
      } else {   
      this.$socket.emit("appDataUpdate", {
          table: "study_session",
          data: {
            id: this.studySessionId,
            studyStepId: step 
          },
        });
      }  
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