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
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.request.timeout'));
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
            }
      );

      setTimeout(() => {
        if (this.requestId) {
          this.eventBus.emit('toast', {
            title: "NLP Service Request",
            message: "Timeout in request for skill " + this.skill + " - Request failed!",
            variant: "danger"
          });
          this.requestId = null;
        }
      }, this.nlpRequestTimeout);

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