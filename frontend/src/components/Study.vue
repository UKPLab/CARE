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
          @click="finish()"
      >
        {{ studySession.end ? "Finish Study Again" : "Finish Study" }}
      </TopBarButton>

      <TopBarButton
          v-if="currentStudyStep && lastStep && currentStudyStep.id !== lastStep.id"
          :disabled="!isCurrentStepReady"
          class="btn btn-outline-primary ms-3"
          title="Next"
          @click="next()"
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
    <div v-for="step in orderedStudySteps" :key="'step_' + step.id">
      <div v-show="currentStudyStepId === step.id">
        <div v-if="studyTrajectory.includes(step.id) || readOnly">

          <div v-if="!(studySession && studySession.start === null)">
            <LoadingModal
                :study-step-id="step.id"
                :document-id="step.documentId"
                :config="step.configuration"
                :show="currentStudyStepId === step.id && !readOnly"
                :can-load="canLoadStepById[step.id]"
                @insert-nlp-response="handleInsertNlpResponse"
                @update:data="updateStudyData(step.id, 'data', $event)"
                @update:ready="loadingReady[step.id] = $event"
            />
          </div>
          <div v-if="isStepLoaded(step.id)">

            <Annotator
                v-if="step.stepType === 1"
                :document-id="step.documentId"
                :study-step-id="step.id"
                @error="error"
                @update:data="updateStudyData(step.id, 'annotator', $event)"
            >
              <template v-if="step.configuration?.settings?.configurationId" #additionalSidebars>
                <SidebarTemplate icon="list-check" title="Assessment">
                  <template #content>
                    <Assessment
                        :config="step.configuration"
                        :study-step-id="step.id"
                        @assessment-ready-changed="stepsReady[step.id] = $event"
                        @update:data="updateStudyData(step.id, 'assessment', $event)"
                    />
                  </template>
                </SidebarTemplate>
              </template>
            </Annotator>

            <Editor
                ref="editor"
                v-if="step.stepType === 2"
                :document-id="step.documentId"
                :study-step-id="step.id"
                :without-history="true"
                @update:data="updateStudyData(step.id, 'editor', $event)"
            >
              <template v-if="step.configuration?.settings?.configurationId" #additionalSidebars>
                <SidebarTemplate icon="list-check" title="Assessment">
                  <template #content>
                    <Assessment
                        :config="step.configuration"
                        @assessment-ready-changed="stepsReady[step.id] = $event"
                        @update:data="updateStudyData(step.id, 'assessment', $event)"
                    />
                  </template>
                </SidebarTemplate>
              </template>
            </Editor>

            <StepModal
                v-if="step.stepType === 3"
                :study-step-id="step.id"
                :is-last-step="step.id === lastStep.id"
                @close="handleModalClose"
                @update:data="updateStudyData(step.id, 'modal', $event)"
            />

          </div>
        </div>
      </div>
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
 * @author Dennis Zyska, Manu Sundar Raj Nandyal, Linyin Huang
 */
import StudyModal from "@/components/study/StudyModal.vue";
import Annotator from "./annotator/Annotator.vue";
import Editor from "./editor/Editor.vue";
import FinishModal from "./study/FinishModal.vue";
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import {computed} from "vue";
import StepModal from "./stepmodal/StepModal.vue";
import Assessment from "@/components/study/Assessment.vue";
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import LoadingModal from "@/components/study/LoadingModal.vue";

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
    LoadingModal
  },
  provide() {
    return {
      studySessionId: computed(() => this.studySessionId),
      readOnly: computed(() => this.readOnlyComputed),
      studyData: computed(() => this.studyData),
      currentStudyStep: computed(() => this.currentStep),
      orderedStudySteps: computed(() => this.orderedStudySteps),
      pendingNlpInsertion: computed(() => this.pendingNlpInsertion),
    };
  },
  // TODO: Only subscribe relevant entries (like current study session and steps)
  subscribeTable: ["study_step", "study_session"],
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
      studyData: {},
      stepsReady: {},
      loadingReady: {},
      pendingFinishAfterNlp: false,
      nlpModalStepId: null,
      pendingNlpInsertion: null,
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
    canLoadStepById() {
      return this.orderedStudySteps.reduce((acc, step, i, steps) => {
        if (i === 0) {
          acc[step.id] = true; // first step can always load
          return acc;
        }

        const prev = steps[i - 1];
        const prevLoaded = this.isStepLoaded(prev.id);
        const prevHasAssessment = !!prev.configuration?.settings?.configurationId;

        const readyMap = this.stepsReady || {};
        const hasEntry = Object.hasOwn(readyMap, prev.id);

        const prevReady = prevHasAssessment
            ? (hasEntry ? readyMap[prev.id] : false) // expect entry → default false
            : true;                                  // no assessment → always ready

        acc[step.id] = prevLoaded && prevReady;
        return acc;
      }, {});
    },
    orderedStudySteps() {
      const steps = this.studySteps || [];
      if (!steps.length) return [];

      // Map: previousId → step
      const next = new Map(steps.map(s => [s.studyStepPrevious, s]));

      // find first step
      let current = steps.find(s => s.studyStepPrevious == null);

      const ordered = [];
      while (current) {
        ordered.push(current);
        current = next.get(current.id); // go to the next in chain
      }

      return ordered;
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
    isCurrentStepReady() {
      if (this.currentStudyStepId in this.stepsReady) {
        return this.stepsReady[this.currentStudyStepId];
      }
      return true;
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
    }
  },
  async mounted() {
    this.studySessionId = this.initStudySessionId;
    this.getStudyData();
  },
  methods: {
    updateStudyData(stepId, data_type, data) {
      if (!this.studyData[stepId]) {
        this.studyData[stepId] = {};
      }
      this.studyData[stepId][data_type] = data;
    },
    handleInsertNlpResponse(nlpData) {
      const responseText = nlpData?.response;
      if (!responseText) {
        console.warn("[Study] Missing NLP response text", nlpData);
        return;
      }

      this.pendingNlpInsertion = responseText;
      console.log("[Study] Received NLP response", {
        responseLength: responseText.length,
        currentStepType: this.currentStudyStep?.stepType,
      });
    },
    next() {
      const nextStep = this.nextStudyStep;
      if (!nextStep) return;
      this.updateStep(nextStep.id);
    },
    isStepLoaded(stepId) {
      if (stepId in this.loadingReady) {
        return this.loadingReady[stepId];
      }
      return false;
    },
    getStudyData() {
      if (this.studyHash) {
        this.$socket.emit(
            "appDataByHash",
            {
              table: "study",
              hash: this.studyHash
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
    handleModalClose(event) {
      if (event.endStudy) {
        this.finish(); // End the study
      } else if (event.nextStep) {
        const nextStep = this.nextStudyStep;
        if (nextStep) {
          this.updateStep(nextStep.id);
        }
      } else if (event.previousStep && this.currentStep.allowBackward) {
        const previousStep = this.studySteps.find((step) => step.id === this.currentStudyStep.studyStepPrevious);
        if (previousStep) {
          this.updateStep(previousStep.id);
        }
      }
    },
    updateStep(step) {
      //check if the the step type is an editor and if set the dar
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