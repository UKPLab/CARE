<template>
  <SidebarTemplate :icon="icon" :title="title">
    <template #content>
      <AiConversation
          :study-step-id="studyStepId"
          :document-id="documentId"
          :service="service"
          :read-only="readOnly"
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
 * AiConversation, so only per-step values are passed here.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiChatSidebar",
  components: {SidebarTemplate, AiConversation},
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
};
</script>
