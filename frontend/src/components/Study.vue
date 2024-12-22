<template>
  <StudyModal
    v-if="studySessionId === 0 || (this.studySession && this.studySession.start === null)"
    ref="studyModal"
    :study-id="studyId"
    :study-closed="studyClosed"
    :study-session-id="studySessionId"
    @finish="finalFinish"
    @start="start"
  />
  <FinishModal
    ref="studyFinishModal"
    :study-session-id="studySessionId"
    :show-time-up="timeUp"
    @finish="finalFinish({studySessionId: this.studySessionId})"
  />

  <Teleport to="#topbarCustomPlaceholder">
    <div class="d-flex justify-content-between align-items-center w-100">

      <TopBarButton
        v-if="currentStudyStep && currentStudyStep.allowBackward && currentStudyStep && currentStudyStep.studyStepPrevious !== null"
        class="btn btn-outline-primary me-3"
        title="Previous"
        @click="updateStep(currentStudyStep.studyStepPrevious)"
      >
        Previous
      </TopBarButton>

      <TopBarButton
        v-if="!readOnlyComputed && studySession && lastStep && currentStudyStep && currentStudyStep.stepType !== 3 && studySession.studyStepId === lastStep.id"
        class="btn btn-outline-secondary mx-3"
        :title="(studySession.end) ? 'Finish Study Again' : 'Finish Study'"
        @click="finish"
      >
        {{ (studySession.end) ? 'Finish Study Again' : 'Finish Study' }}
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

  <Teleport to="#topbarCenterPlaceholder">
    <div
      v-show="readOnlyComputed"
      title="Read-only"
    >
      <span
        :style="{ color: '#800000', fontWeight: 'bold' }"
      >
        Read-only
      </span>
      <LoadIcon
        :size="22"
        :color="'#800000'"
        icon-name="lock-fill"
      />
    </div>
    
  </Teleport>
  <div v-if="studySessionId !== 0">
    <div v-for="(s, index) in studySteps" :key="index">
      <div v-show="s.id === currentStudyStepId">
        <Annotator v-if="s.stepType === 1 && (studyTrajectory.includes(s.id) || readOnly)"
                   :document-id="s.documentId" :study-step-id="s.id" @error="error" :active="activeComponents[index]"/>
      </div>
      <div v-show="s.id === currentStudyStepId">
        <div v-if="s.stepType === 2">Test {{ studyTrajectory }}</div>
        <Editor v-if="s.stepType === 2 && (studyTrajectory.includes(s.id) || readOnly)" :document-id="s.documentId"
                :study-step-id="s.id" :active="activeComponents[index]" v-model="currentData"/>
      </div>
      <div v-show="s.id === currentStudyStepId">
        <FeedbackModal
            v-if="s.stepType === 3 && studyTrajectory.includes(s.id)"
            :study-step-id="s.id" :is-last-step="s.id === lastStep.id"
            @close="handleModalClose"
          />
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
import Modal from "./modal/Modal.vue";

export default {
  name: "StudyRoute",
  components: {LoadIcon, FinishModal, StudyModal, Annotator, Editor, TopBarButton, Modal},
  provide() {
    return {
      studySessionId: computed(() => this.studySessionId),
      readonly: computed(() => this.readOnlyComputed),
      modalData: computed(() => this.currentData),
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
    'readOnly': {
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
      currentData: null, // The v-model information is yet to be implemented
    };
  },
  computed: {
    activeComponents() {
      return this.studySteps.map(step => step.id === this.currentStudyStepId);
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
        return this.studySteps.find(step => step.studyStepPrevious === this.currentStudyStep.id);
      }
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
    userId() {
      return this.$store.getters["auth/getUserId"];
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
    currentStudyStepId() {
      if (this.readOnlyComputed && this.firstStep) {
        return this.localStudyStepId === 0 ? this.firstStep.id : this.localStudyStepId;
      }
      if (this.studySession && this.studySession.studyStepId) {
        return this.studySession.studyStepId;
      }
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
    readOnlyComputed() {
      if (this.readOnly) {
        return this.readOnly;
      }
      if (this.studyClosed || this.timeUp) {
        return true;
      }
      if (this.studySession && this.studySession.end && !this.study.multipleSubmit) {
        return true;
      }
      return false;
    }
  },
  watch: {
    studySession() {
      if (this.study && this.study.timeLimit > 0 && this.studySession) {  //studySession required, otherwise not all data may be there yet
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        this.calcTimeLeft();
        if (!this.studyClosed) {
          this.timerInterval = setInterval(this.calcTimeLeft, 1000);
        }
      }
    },
    studyHash() {
      this.getStudyData();
    }
  },
  mounted() {
    this.studySessionId = this.initStudySessionId;
    this.getStudyData();
  },
  sockets: {
    studyError: function (data) {
      if (data.studyHash === this.studyHash) {
        this.eventBus.emit('toast', {
          title: "Study Error",
          message: data.message,
          variant: "danger"
        });
        this.error();
        this.$router.push("/");
      }
    },
  },
  methods: {
    getStudyData() {
      if (this.studyHash) {
        this.$socket.emit("appDataByHash", {
          table: "study",
          hash: this.studyHash
        }, (response) => {
          if (!response.success) {
            this.eventBus.emit('toast', {
              title: "Access Error!",
              message: response.message,
              variant: "danger"
            });
            this.$router.push("/");
          } else {
            if (this.studySessionId === 0 ||
              (this.studySession &&
                this.studySession.start === null &&
                this.studySession.userId === this.userId)) {
              this.$refs.studyModal.open();
            }
          }
        })
      }
    },
    start(data) {
      this.studySessionId = data.studySessionId;
    },
    error() {
      this.$refs.studyModal.close();
    },
    calcTimeLeft() {
      const timeSinceStart = (Date.now() - new Date(this.studySession.start)) / 1000;
      this.timeLeft = this.study.timeLimit * 60 - timeSinceStart;

      if (this.timeLeft < 0 && !this.studySession.end) {
        this.finish();
      }
    },
    finalFinish(data) {
      this.$socket.emit("appDataUpdate", {
        table: "study_session",
        data: {
          id: data.studySessionId,
          end: Date.now()
        }
      }, (result) => {
        if (result.success) {
          this.eventBus.emit('toast', {
            title: "Study Session finished",
            message: "Study session has been finished",
            variant: "success"
          });
        } else {
          this.eventBus.emit('toast', {
            title: "Study Session not finished",
            message: result.message,
            variant: "danger"
          });
        }
      });
      this.$refs.studyFinishModal.close();
    },
    finish() {
      this.$refs.studyFinishModal.open();
    },
    handleModalClose(event) {
        if (event.endStudy) {
            this.finish(); // End the study
        } else if (event.nextStep) {
            const nextStep = this.nextStudyStep;
            if (nextStep) {
                this.updateStep(nextStep.id);
            }
        } else if (event.previousStep && this.currentWorkflowStep.allowBackward) {
            const previousStep = this.studySteps.find(
                step => step.id === this.currentStudyStep.studyStepPrevious
            );
            if (previousStep) {
                this.updateStep(previousStep.id);
            }
        }
    },
    updateStep(step) {
      if (this.readOnlyComputed) {
        this.localStudyStepId = step;
      } else {
        this.$socket.emit("appDataUpdate", {
          table: "study_session",
          data: {
            id: this.studySessionId,
            studyStepId: step
          },
        }, (result) => {
          if (!result.success) {
            this.eventBus.emit('toast', {
              title: "Study Step update failed",
              message: result.message,
              variant: "danger"
            });
          }
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

.d-flex-justify-content-center {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
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