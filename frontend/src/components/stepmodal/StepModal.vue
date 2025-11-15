<template>
  <span>
    <BasicModal
      ref="modal"
      :size="studyStep?.configuration?.settings?.modalSize"
      :name="studyStep?.configuration?.name || 'Modal'"
      :disable-keyboard="true"
      :remove-close="true"
    >
      <template #title>
        <h5
          class="modal-title"
          :class="studyStep?.configuration?.titleClass || 'text-primary'"
        >
          {{ studyStep?.configuration?.title || 'Feedback' }}
        </h5>
      </template>  
      <template #body>
        <div
          class="feedback-container p-3"
          :style="{ color: studyStep?.configuration?.textColor || '' }"
        >
          <p v-if="!documentText">
            No content available for this step.
          </p>

          <div v-else>
              <div v-for="(segment, index) in documentSegments" :key="'segment-' + index">
                <template v-if="segment.type === 'plainText'">
                  <span v-html="segment.value"></span>
                </template>                    <template v-else-if="segment.type === 'text'">
                  <TextPlaceholder :config="segment.config" />
                </template>
                <template v-else-if="segment.type === 'chart'">
                  <Chart :config="segment.config" />
                </template>
                <template v-else-if="segment.type === 'comparison'">
                  <Comparison :config="segment.config" />
                </template>
              </div>
          </div>
        </div>      
      </template>
      <template #footer>
        <div v-if="!waiting">
          <BasicButton
            v-if="!isLastStep"
            :title="studyStep?.configuration?.nextButtonText || 'Next'"
            @click="closeModal({ nextStep: true })"
          />
          <!-- Button for the last step -->
          <BasicButton
            v-if="isLastStep && !readOnly"
            :title="studyStep?.configuration?.finishButtonText || 'Finish Study'"
            :class="studyStep?.configuration?.finishButtonClass || 'btn btn-danger'"
            @click="closeModal({ endStudy: true })"
          />
          <!-- Button for the last step in read-only mode -->
          <BasicButton
            v-if="isAdmin && isLastStep && readOnly"
            title="Export Study Data"
            class="btn me-1 btn-outline-secondary"
            icon="cloud-arrow-down"
            @click="exportStudyData"
          />
          <!-- Button for returning to the dashboard when in read-only mode -->
          <BasicButton
            v-if="isLastStep && readOnly"
            :title="'Return to Studies'"
            :class="'btn btn-primary'"
            @click="$router.push('/dashboard/studies')"
          />
        </div>
      </template>
    </BasicModal>
  </span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Quill from "quill";
import TextPlaceholder from "./placeholders/Text.vue";
import Chart from "./placeholders/Chart.vue";
import Comparison from "./placeholders/Comparison.vue";
import {downloadObjectsAs} from "@/assets/utils";

/**
 * A Modal as per the configuration of the study step
 * Also includes the NLP service to get the output of the skill
 *
 * @author: Juliane Bechert, Manu Sundar Raj Nandyal
 */
export default {
  name: "StepModal",
  components: { BasicButton, BasicModal, TextPlaceholder, Chart, Comparison},
  subscribeTable: ["document", "document_data", "study_step", "configuration"],
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    userId: {
      type: Number,
      required: false,
      default: null
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    studyData: {
      type: Array,
      required: false,
      default: () => [],
    }
  },
  props: {
    studyStepId: {
      type: Number,
      required: true
    },
    isLastStep: {
      type: Boolean,
      default: false
    },
    autoCloseOnComplete: {
      type: Boolean,
      default: false
    },
  },  
  emits: ["update:data", "close"],
  data() {
    return {
      loadingConfig: true,
      documentText: null,
      waiting: false,
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);;
    },
    configuration() {
      return this.studyStep?.configuration || null;
    },
    documentData() {
      return this.$store.getters["table/document_data/getByKey"]("studySessionId", this.studySessionId);
    },
    placeholders(){
      return this.studyStep?.configuration?.placeholders || null;
    },    
    documentSegments() {
      if (!this.documentText) return [];
      
      if (!this.placeholders || Object.keys(this.placeholders).length === 0) {
        return [{ type: 'plainText', value: this.documentText }];
      }

      const segments = [];
      const regex = /~(.*?)~/g;
      let match;
      let lastIndex = 0;

      const placeholderCounters = Object.keys(this.placeholders).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});

      while ((match = regex.exec(this.documentText)) !== null) {
        const placeholderKey = match[1];

        if (match.index > lastIndex) {
          segments.push({ type: 'plainText', value: this.documentText.slice(lastIndex, match.index) });
        }

        if (this.placeholders[placeholderKey]) {
          const placeholderIndex = placeholderCounters[placeholderKey];
          const placeholderConfig = this.placeholders[placeholderKey][placeholderIndex];
          if (placeholderConfig) {
            const resolvedSegment = { type: placeholderKey, config: placeholderConfig };
            segments.push(resolvedSegment);
            placeholderCounters[placeholderKey] += 1;
          }
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < this.documentText.length) {
        segments.push({ type: 'plainText', value: this.documentText.slice(lastIndex) });
      }

      return segments;
    },
    specificDocumentData() {
      return this.documentData && this.studyStep?.documentId
        ? this.documentData.filter(d => d.documentId === this.studyStep.documentId)
        : [];
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
  },
  watch: {
    specificDocumentData: {
      handler() {
        this.$emit("update:data", this.specificDocumentData);
      },
      deep: true,
    },
    placeholders: {
      handler() {
          if ((this.placeholders == null || Object.keys(this.placeholders).length === 0) && !this.waiting) {   
            this.waiting = false;   
          }
        }
      },
      immediate: true
  },
  created() {
    if (this.configuration) {
      this.loadingConfig = false;
    }

      this.waiting = true;
      this.$socket.emit("documentGet",
        {
          documentId: this.studyStep?.documentId ? this.studyStep.documentId : 0,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
        },
        (response) => {
          if (response?.success && response.data?.deltas) {
            const quill = new Quill(document.createElement("div"));
            quill.setContents(response.data.deltas);
            this.documentText = quill.root.innerHTML;
          } else {
            this.documentText = "Failed to load the document content.";
          }
          this.waiting = false;
        }
      );

  },  
  async mounted() {
    // Inspect sessions update the specific document data sometimes before the modal opens and the watcher is not triggered
    if (this.readOnly){
      this.$emit("update:data", this.specificDocumentData); 
    }

    this.$refs.modal.open();
  },  
  methods: {
    // Opens the modal with provided data; input: data (any); output: void
    open(data) {
      this.data = data;
      this.$refs.modal.open();
    },
    // Closes the modal; input: event (object); output: void
    async closeModal(event) {
      this.$emit("close", event);
      this.$refs.modal.close();
    },

    async exportStudyData() {
      if (this.isAdmin){
        const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_study_data';
        downloadObjectsAs(this.studyData, filename, 'json');
      }
    }
  }
};
</script>
<style scoped>
.feedback-container {
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 0.5rem;
}

.row {
  margin-bottom: 1rem;
}

.modal-title {
  font-weight: bold;
  text-transform: uppercase;
}

.text-primary {
  color: #007bff !important;
}

.text-secondary {
  color: #6c757d !important;
}

.text-muted {
  color: #6c757d !important;
}

.fw-bold {
  font-weight: 700 !important;
}

.fw-semibold {
  font-weight: 600 !important;
}

.btn-outline-secondary {
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover {
  background-color: #6c757d;
  color: #fff;
}
</style>