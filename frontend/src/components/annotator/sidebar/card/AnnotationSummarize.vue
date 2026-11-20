<template>
  <NLPService
      v-if="summarizationAvailable && comment.userId === userId && !readOnly"
      :data="summarizationRequestData"
      :skill="summarizationSkillName"
      icon-name="file-text"
      :title="$t('common.summarize')"
      type="button"
      @response="summarizeResponse"
  />
</template>

<script>
import NLPService from "@/basic/service/NLPService.vue";
import { resolveApiMessage } from "@/assets/utils";

/** NLP summarize-to-reply
 *
 * Renders the summarize action for an annotation and posts the NLP result as a new reply
 * comment. Extracted from AnnoCard.vue; emits 'summarized' so the parent can reveal the
 * new reply the same way the original inline implementation did.
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnotationSummarize",
  components: {NLPService},
  inject: {
    documentId: {
      type: Number,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  props: {
    'annotationId': {
      type: Number,
      required: false,
      default: null,
    },
    'commentId': {
      type: Number,
      required: true,
    },
  },
  emits: ['summarized'],
  computed: {
    comment() {
      return this.$store.getters['table/comment/get'](this.commentId);
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    annotation() {
      return this.$store.getters['table/annotation/get'](this.annotationId);
    },
    summarizationMinLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.minLength'));
    },
    summarizationMaxLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.maxLength'));
    },
    summarizationRequestData() {
      return {
        text: this.annotation.text,
        params: {
          min_length: this.summarizationMinLength,
          max_length: this.summarizationMaxLength
        }
      }
    },
    summarizationMinAnnoLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.annoLength'));
    },
    summarizationActivated() {
      return this.$store.getters["settings/getValue"]('annotator.nlp.summarization.activated') === "true";
    },
    summarizationSkillName() {
      return this.$store.getters["settings/getValue"]('annotator.nlp.summarization.skillName');
    },
    nlpEnabled() {
      return this.$store.getters["settings/getValue"]("service.nlp.enabled") === "true";
    },
    summarizationAvailable() {
      if (!this.nlpEnabled)
        return false;
      if (this.annotation)
        return this.annotation.text !== null && this.annotation.text.length >= this.summarizationMinAnnoLength
            && this.summarizationActivated;
      return null;
    },
  },
  methods: {
    summarizeResponse(data) {
      this.$socket.emit('commentUpdate', {
        "documentId": this.documentId,
        "parentCommentId": this.commentId,
        "studySessionId": this.studySessionId,
        "studyStepId": this.studyStepId,
        "text": "Summarization: " + data[0]['summary_text'],
        "userId": "Bot"
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.commentNotUpdated'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
      this.$emit('summarized');
    },
  }
}
</script>
