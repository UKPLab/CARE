<template>
  <div v-show="visible">
    <div v-if="reachable">

      <div v-if="started">
        <LoadingModal
            v-if="step.stepType !== 4"
            :study-step-id="step.id"
            :document-id="step.documentId"
            :config="step.configuration"
            :show="showLoading"
            :can-load="canLoad"
            @insert-nlp-response="$emit('insert-nlp-response', $event)"
            @update:data="$emit('update:data', {type: 'data', data: $event})"
            @update:ready="$emit('loaded', $event)"
            @error="$emit('loading-error', $event)"
        />
      </div>
      <div v-if="loaded">

        <StepView
            v-if="[1, 2].includes(step.stepType)"
            :step="step"
            :pane-props="paneProps"
            :tabs="tabs"
            :labels="labels"
            @error="$emit('error')"
            @update:data="$emit('update:data', $event)"
            @assessment-ready-changed="$emit('assessment-ready-changed', $event)"
            @assessment-advance-past-end="$emit('assessment-advance-past-end', $event)"
        >
          <template v-if="aiChatService" #aiConversation>
            <AiChatSidebar
                icon="chat-dots"
                :title="$t('ai.chat.sidebarTitle')"
                :study-step-id="step.id"
                :document-id="step.documentId"
                :service="aiChatService"
                :read-only="readOnly || studySessionFinished"
            />
          </template>
        </StepView>

        <StepModal
            v-if="step.stepType === 3"
            :study-step-id="step.id"
            :is-last-step="isLastStep"
            @close="$emit('modal-close', $event)"
            @update:data="$emit('update:data', {type: 'modal', data: $event})"
        />

        <Dialogue
            v-if="step.stepType === 4"
            :is-shown="current"
            :study-description="studyDescription"
            :study-step-id="step.id"
            :document-id="step.documentId"
            :config="step.configuration"
            :read-only="readOnly"
            @update:ready="$emit('ready', $event)"
            @update:data="$emit('update:data', {type: 'dialogue', data: $event})"
        />

      </div>
    </div>
  </div>
</template>

<script>
/**
 * Content of one study step
 *
 * Loads the step's data (LoadingModal) and then shows it the way its type asks for: an Annotator or Editor
 * (StepView, with the AI chat if the step has one), a modal (StepModal) or a dialogue (Dialogue).
 * Data and readiness of the step go to Study.vue as events, tagged with their type.
 *
 * @author Dennis Zyska, Manu Sundar Raj Nandyal, Linyin Huang
 */
import StepView from "@/components/study/StepView.vue";
import StepModal from "@/components/stepmodal/StepModal.vue";
import LoadingModal from "@/components/study/LoadingModal.vue";
import AiChatSidebar from "@/components/aiAssistant/AiChatSidebar.vue";
import Dialogue from "@/components/dialogue/Dialogue.vue";

export default {
  name: "StudyStepContent",
  components: {StepView, StepModal, LoadingModal, AiChatSidebar, Dialogue},
  inject: {
    readOnly: {default: false},
    studySessionFinished: {default: false},
  },
  props: {
    step: {type: Object, required: true},
    // On screen: the current step, or the earlier step shown next to it
    visible: {type: Boolean, default: false},
    // Reached in this session, or the session is viewed read-only
    reachable: {type: Boolean, default: false},
    // The session has started
    started: {type: Boolean, default: false},
    current: {type: Boolean, default: false},
    showLoading: {type: Boolean, default: false},
    canLoad: {type: Boolean, default: true},
    loaded: {type: Boolean, default: false},
    paneProps: {type: Object, default: null},
    tabs: {type: Array, default: () => []},
    labels: {type: Object, required: true},
    isLastStep: {type: Boolean, default: false},
    studyDescription: {type: String, default: ""},
  },
  emits: [
    "insert-nlp-response", "update:data", "loaded", "loading-error", "ready", "error", "assessment-ready-changed",
    "assessment-advance-past-end", "modal-close",
  ],
  computed: {
    aiChatService() {
      return (this.step.configuration?.services || []).find(service => service.type === "aiChat") || null;
    },
  },
};
</script>
