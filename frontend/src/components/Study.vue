<template>
  <StudyModal
      v-if="studySessionId === 0 || (studySession && studySession.start === null)"
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
      @finish="finalFinish({ studySessionId: studySessionId })"
  />

  <Teleport to="#topbarCustomPlaceholder">
    <div class="d-flex justify-content-between align-items-center w-100">
      <TopBarButton
          v-if="
          currentStudyStep &&
          currentStudyStep.allowBackward &&
          currentStudyStep &&
          currentStudyStep.studyStepPrevious !== null
        "
          class="btn btn-outline-primary me-3"
          title="Previous"
          @click="updateStep(currentStudyStep.studyStepPrevious)"
      >
        Previous
      </TopBarButton>

      <TopBarButton
          v-if="
          !readOnlyComputed &&
          studySession &&
          lastStep &&
          currentStudyStep &&
          currentStudyStep.stepType !== 3 &&
          studySession.studyStepId === lastStep.id
        "
          class="btn btn-outline-secondary mx-3"
          :disabled="!isCurrentStepReady"
          :title="studySession.end ? 'Finish Study Again' : 'Finish Study'"
          @click="finishWithNlpGuard()"
      >
        {{ studySession.end ? "Finish Study Again" : "Finish Study" }}
      </TopBarButton>

      <TopBarButton
          v-if="currentStudyStep && lastStep && currentStudyStep.id !== lastStep.id"
          :disabled="!isCurrentStepReady"
          class="btn btn-outline-primary ms-3"
          title="Next"
          @click="nextWithNlpGuard()"
      >
        Next
      </TopBarButton>

      <TopBarButton
          v-if="timeLeft > 0"
          class="btn mb-1"
      >
        <LoadIcon
            :size="21"
            class="me-1 mb-1 middle"
            icon-name="stopwatch"
        />
        <span
            :class="{ 'text-danger': timeLeft < 5 * 60 }"
            class="middle"
        ><b>Time Left:</b> {{ timeLeftHuman }}</span
        >
      </TopBarButton>
    </div>
  </Teleport>

  <div
      v-if="studySessionId !== 0"
      class="study-container"
  >
    <Annotator
        v-if="currentStep.stepType === 1 && (studyTrajectory.includes(currentStep.id) || readOnly)"
        ref="annotator"
        :document-id="currentStep.documentId"
        :study-step-id="currentStep.id"
        @error="error"
        @update:data="studyData[studySteps.findIndex(step => step.id === currentStep.id) + 1] = $event"
    >
      <template v-if="studyStepHasAssessment" #additionalSidebars>
        <SidebarTemplate icon="list-check" title="Assessment">
          <template #content>
            <Assessment
                ref="assessmentAnnotator"
                @assessment-ready-changed="isCurrentStepReady = $event"
                @state-changed="onAssessmentStateChanged"
                @update:data="onNlpDataUpdate($event)"/>
          </template>
        </SidebarTemplate>
      </template>
    </Annotator>
    <Editor
        v-if="currentStep.stepType === 2 && (studyTrajectory.includes(currentStep.id) || readOnly)"
        :document-id="currentStep.documentId"
        :study-step-id="currentStep.id"
        :without-history="true"
        @update:data="studyData[studySteps.findIndex(step => step.id === currentStep.id) + 1] = $event"
    >
      <template v-if="studyStepHasAssessment" #additionalSidebars>
        <SidebarTemplate icon="list-check" title="Assessment">
          <template #content>
            <Assessment
                ref="assessmentEditor"
                @assessment-ready-changed="isCurrentStepReady = $event"
                @can-proceed-changed="canProceed = $event"
                @update:data="onNlpDataUpdate($event)"
            />
          </template>
        </SidebarTemplate>
      </template>
    </Editor>
    <NlpModal
        v-if="currentStep.stepType !== 3 && hasNlpForCurrentStep && (studyTrajectory.includes(currentStep.id) || currentStep.id === currentStudyStepId || readOnlyComputed)"
        :key="currentStep.id + '-nlp'"
        ref="nlpModal"
        :study-step-id="currentStep.id"
        @close="onNlpModalClose"
        @update:data="onNlpDataUpdate($event)"
    />
    <StepModal
        v-if="currentStep.stepType === 3 && studyTrajectory.includes(currentStep.id)"
        :study-step-id="currentStep.id"
        :is-last-step="currentStep.id === lastStep.id"
        @close="handleModalClose"
        @update:data="studyData[studySteps.findIndex(step => step.id === currentStep.id) + 1] = $event"
    />
  </div>
</template>

<script>
/**
 * Document view in study mode
 *
 * Loads a document in study mode; if a study session is provided, the session is loaded instead. Otherwise,
 * the user is prompted to start a study (or resume an existing session).
 *
 * @author Dennis Zyska, Manu Sundar Raj Nandyal, Linyin Huang
 */
import StudyModal from "@/components/study/StudyModal.vue";
import Annotator from "./annotator/Annotator.vue";
import Editor from "./editor/Editor.vue";
import FinishModal from "./study/FinishModal.vue";
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import {computed, nextTick} from "vue";
import StepModal from "./stepmodal/StepModal.vue";
import NlpModal from "./stepmodal/NlpModal.vue";
import Assessment from "@/components/study/Assessment.vue";
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";

export default {
  name: "StudyRoute",
  components: {
    SidebarTemplate,
    Assessment,
    LoadIcon,
    FinishModal,
    StudyModal,
    Annotator,
    Editor,
    TopBarButton,
    StepModal,
    NlpModal
  },
  provide() {
    return {
      studySessionId: computed(() => this.studySessionId),
      readOnly: computed(() => this.readOnlyComputed),
      studyData: computed(() => this.studyData),
      currentStudyStep: computed(() => this.currentStep),
    };
  },
  props: {
    studyHash: {
      type: String,
      required: false,
      default: null,
    },
    initStudySessionId: {
      type: Number,
      required: false,
      default: 0,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      studySessionId: 0,
      timeLeft: 0,
      timerInterval: null,
      localStudyStepId: 0,
      studyData: [], // Data from all the study steps
      isCurrentStepReady: true,
      pendingFinishAfterNlp: false,
      nlpModalStepId: null,
      openNlpOnStepEnter: false
    };
  },
  computed: {
    currentStep() {
      return this.studySteps.find((step) => step.id === this.currentStudyStepId) || {};
    },
    hasNlpForCurrentStep() {
      const services = this.currentStep?.configuration?.services;
      if (!Array.isArray(services)) return false;
      return services.some(s => s && s.type === 'nlpRequest');
    },
    studyStepHasAssessment() {
      return !!this.currentStep.configuration.configurationId;
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
    nextStudyStep() {
      if (this.currentStudyStep) {
        // Find the next step by looking for a step where `studyStepPrevious` matches `currentStudyStep.id`
        return this.studySteps.find((step) => step.studyStepPrevious === this.currentStudyStep.id);
      }
      return null;
    },
    lastStep() {
      const previousStepIds = this.studySteps.map((step) => step.studyStepPrevious).filter((id) => id !== null); // Excluding null to avoid the first step
      return this.studySteps.find((step) => !previousStepIds.includes(step.id));
    },
    firstStep() {
      return this.studySteps ? this.studySteps.find((step) => step.studyStepPrevious === null) : null;
    },
    studyTrajectory() {
      if (!this.studySession) return [];
      let studyTrajectory = [];
      let studyStep = this.$store.getters["table/study_step/get"](this.studySession.studyStepIdMax);
      while (studyStep) {
        studyTrajectory.push(studyStep.id);
        studyStep = studyStep.studyStepPrevious
            ? this.$store.getters["table/study_step/get"](studyStep.studyStepPrevious)
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
      return "<" + Math.ceil(this.timeLeft / 60) + "min";
    },
    currentStudyStep() {
      return this.currentStudyStepId ? this.$store.getters["table/study_step/get"](this.currentStudyStepId) : null;
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
    },
    
  },
  watch: {
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
    },
    currentStep(oldStep, newStep) {
      if (oldStep && newStep && oldStep.id !== newStep.id) {
        this.isCurrentStepReady = true;
      }
    },
    studyHash() {
      this.getStudyData();
    },
    async studySteps(newSteps) {
      if (newSteps.length > 0) {
        await nextTick();
        this.populateStudyData();
      }
    },
  },
  async mounted() {
    this.studySessionId = this.initStudySessionId;
    this.getStudyData();
    await nextTick();
    this.populateStudyData();
  },
  sockets: {
    studyError: function (data) {
      if (data.studyHash === this.studyHash) {
        this.eventBus.emit("toast", {
          title: "Study Error",
          message: data.message,
          variant: "danger",
        });
        this.error();
        this.$router.push("/");
      }
    },
  },
  methods: {
    onNlpDataUpdate(entries) {
      try {
        const idx = this.studySteps.findIndex(step => step.id === (this.nlpModalStepId || this.currentStep.id));
        const bucketIndex = idx + 1;
        if (!this.studyData[bucketIndex]) this.studyData[bucketIndex] = {};
        const bucket = this.studyData[bucketIndex];
        if (Array.isArray(entries)) {
          entries.forEach(entry => {
            if (entry && entry.key) {
              bucket[entry.key] = entry.value;
            }
          });
        }
        this.$forceUpdate();
      } catch (e) {
        // ignore
      }
    },
    populateStudyData() {
      if (this.studySteps.length > 0 && Object.keys(this.studyData).length === 0) {
        this.studyData = this.studySteps.reduce((acc, step, index) => {
          acc[index + 1] = {};
          return acc;
        }, {});
      }
    },
    nextWithNlpGuard() {
      const nextStep = this.nextStudyStep;
      if (!nextStep) return;
      this.updateStep(nextStep.id);
    },
    onNlpModalClose() {
      this.nlpModalStepId = null;
      this.nlpModalReason = null;
    },
    getStudyData() {
      if (this.studyHash) {
        this.$socket.emit(
            "appDataByHash",
            {
              table: "study",
              hash: this.studyHash,
            },
            (response) => {
              if (!response.success) {
                this.eventBus.emit("toast", {
                  title: "Access Error!",
                  message: response.message,
                  variant: "danger",
                });
                this.$router.push("/");
              } else {
                if (
                    this.studySessionId === 0 ||
                    (this.studySession && this.studySession.start === null && this.studySession.userId === this.userId)
                ) {
                  this.$refs.studyModal.open();
                }
              }
            }
        );
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
      this.$socket.emit(
          "appDataUpdate",
          {
            table: "study_session",
            data: {
              id: data.studySessionId,
              end: Date.now(),
            },
          },
          (result) => {
            if (result.success) {
              this.eventBus.emit("toast", {
                title: "Study Session finished",
                message: "Study session has been finished",
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: "Study Session not finished",
                message: result.message,
                variant: "danger",
              });
            }
          }
      );
      this.$refs.studyFinishModal.close();
    },
    finish() {
      this.$refs.studyFinishModal.open();
    },
    finishWithNlpGuard() {
      this.finish();
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
        const previousStep = this.studySteps.find((step) => step.id === this.currentStudyStep.studyStepPrevious);
        if (previousStep) {
          this.updateStep(previousStep.id);
        }
      }
    },
    updateStep(step) {
      // Check if assessment allows proceeding (if current step has assessment)
      // if (this.studyStepHasAssessment) {
      //   this.eventBus.emit("toast", {
      //     title: "Cannot proceed",
      //     message: "Please complete the assessment before proceeding to the next step.",
      //     variant: "danger",
      //   });
      //   return;
      // }
      if (this.readOnlyComputed) {
        this.localStudyStepId = step;
      } else {
        this.$socket.emit(
            "appDataUpdate",
            {
              table: "study_session",
              data: {
                id: this.studySessionId,
                studyStepId: step,
              },
            },
            (result) => {
              if (!result.success) {
                this.eventBus.emit("toast", {
                  title: "Study Step update failed",
                  message: result.message,
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