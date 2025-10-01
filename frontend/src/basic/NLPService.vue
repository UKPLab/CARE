<template>
  <span v-if="nlpEnabled && nlpActivated">
    <span v-if="type === 'button'">
      <button
        v-if="requestId === null"
        :title="nlpAvailable ? title : `${title} not available`"
        class="btn btn-sm"
        data-placement="top"
        data-toggle="tooltip"
        type="button"
        :disabled="!nlpAvailable"
        @click="request()"
      >
        <LoadIcon
          :icon-name="iconName"
          :size="iconSize"
        />
        <span class="visually-hidden">{{ skill }}</span>
      </button>
      <button
        v-else
        :disabled="true"
        class="btn btn-sm"
        type="button"
      >
        <IconLoading
          :loading="true"
          size="12"
        />
      </button>
    </span>
  </span>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import IconLoading from "@/basic/icons/IconLoading.vue";
import {v4 as uuid} from "uuid";

/**
 * NLP Utilities
 *
 * This module provides utilities for requesting, waiting and representing NLP results.
 *
 * Include, for instance as:
 *
 *   <NLPService ref="nlp" :data="Test string" skill="summarization"/>
 *   ...
 *   this.$refs.nlp.request();
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "NLPService",
  components: {
    LoadIcon, IconLoading
  },
  props: {
    type: {
      type: String,
      required: false,
      default: "button"
    },
    data: {
      type: Object,
      required: true
    },
    skill: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: false,
      default: "NLP Service"
    },
    iconName: {
      type: String,
      required: false,
      default: "robot"
    },
    iconSize: {
      type: Number,
      required: false,
      default: 16
    },
  },
  emits: ["response"],
  data: function () {
    return {
      requestId: null,
    }
  },
  computed: {
    nlpRequestTimeout() {
      const raw = this.$store.getters["settings/getValue"]('annotator.nlp.request.timeout');
      const parsed = parseInt(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        const ms = parsed < 1000 ? parsed * 60000 : parsed;
        return Math.max(ms, 600000);
      }
      return 600000;
    },
    nlpSkills() {
      return this.$store.getters["service/getSkills"]("NLPService");
    },
    nlpResults() {
      return this.$store.getters["service/getResults"]("NLPService");
    },
    nlpEnabled() {
      return this.$store.getters["settings/getValue"]("service.nlp.enabled") === "true" || this.nlpFallback;
    },
    nlpFallback() {
      return this.$store.getters["settings/getValue"]("service.nlp.test.fallback") === "true";
    },
    nlpActivated() {
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true";
    },
    nlpAvailable() {
      return this.nlpEnabled && this.nlpActivated && this.nlpSkills.includes(this.skill);
    },
  },
  watch: {
    nlpResults: function (results) {
      if (this.requestId && this.requestId in results) {
        this.$emit("response", this.nlpResults[this.requestId]);
        this.$store.commit("service/removeResults", {
          service: "NLPService", 
          requestId: this.requestId 
        });
        this.requestId = null;
      }
    },
  },
  methods: {
    async request() {
      this.requestId = uuid();

      await this.$socket.emit("serviceRequest",
            {
              service: "NLPService",
              data: {
                id: this.requestId,
                name: this.skill,
                data: this.data
              }
            },
            (ack) => {
              console.log('[NLP Ack] serviceRequest acknowledged for', this.skill, 'requestId:', this.requestId, 'ack:', ack);
            }
      );

      // No timeout: wait indefinitely for response, let user cancel manually if needed
    },
  },
}
</script>

<style scoped>
.btn[disabled] {
    pointer-events: auto;
    cursor: auto;
}
</style>