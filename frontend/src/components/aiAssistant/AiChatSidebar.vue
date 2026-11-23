<template>
  <SidebarTemplate :icon="icon" :title="title">
    <template #content>
      <AiConversation
          :key="`${studySessionId}:${studyStepId}`"
          :study-step-id="studyStepId"
          :document-id="documentId"
          :service="service"
          :read-only="readOnly"
          @stat="logStat"
      />
    </template>
  </SidebarTemplate>
</template>

<script>
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import AiConversation from "@/components/aiAssistant/AiConversation.vue";

/**
 * Study sidebar tab hosting the AI chat. Keeps the chat markup in one place
 * for the annotator and editor steps. Study-wide context is injected by
 * AiConversation, so only per-step values are passed here. The tab adds the
 * study context to the chat's behavior events and records them. Each conversation
 * instance belongs to one study context: a new session or step remounts it,
 * which aborts the open request and starts from a fresh snapshot.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiChatSidebar",
  components: {SidebarTemplate, AiConversation},
  inject: {
    studySessionId: {default: null},
    currentStudyStep: {default: null},
    acceptStats: {default: () => false},
  },
  props: {
    icon: {
      type: String,
      required: false,
      default: "chat-dots",
    },
    title: {
      type: String,
      required: true,
    },
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      required: true,
    },
    service: {
      type: Object,
      required: true,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  methods: {
    /**
     * Records one AI chat behavior event through CARE statistics.
     *
     * @param {string} action - Statistic action name.
     * @param {Object} data - Event metadata, including the conversation id.
     * @returns {void}
     */
    logStat(action, data) {
      if (!this.acceptStats) {
        return;
      }
      this.$socket.emit("stats", {
        action,
        data: {
          ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          documentId: this.documentId,
          ...data,
        },
      });
    },
  },
};
</script>
