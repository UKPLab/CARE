<template>
  <Loader v-if="loadingConfig" :loading="true" class="pageLoader"/>
  <span v-else>
    <BasicModal
      ref="modal"
      studyStep?.configuration?.modalSize || lg
      :name="studyStep?.configuration?.name || 'Modal'"
      :class="modalClasses"
      :style="{ backgroundColor: studyStep?.configuration?.backgroundColor || '' }"
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
          v-if="waiting"
          class="justify-content-center flex-grow-1 d-flex"
          role="status"
        >
          <div class="spinner-border m-5">
            <span class="visually-hidden">Loading...</span>          
          </div>
        </div>
        <div v-else>
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
                </template>
                <template v-else-if="segment.type === 'text'">
                  <Text :input="segment.value" />
                </template>
                <template v-else-if="segment.type === 'chart'">
                  <Chart :chartInput="segment.value" />
                </template>
                <template v-else-if="segment.type === 'comparison'">
                  <Comparison :input="segment.value" />
                </template>
              </div>
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
import {v4 as uuid} from "uuid";
import Text from "./placeholders/Text.vue";
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
  components: { BasicButton, BasicModal, Text, Chart, Comparison },
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
  },
  data() {
    return {
      loadingConfig: true,
      documentText: null,
      waiting: false,
      requests: {},
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    studySteps() {
      return this.studyStep.studyId !== 0
        ? this.$store.getters["table/study_step/getByKey"]("studyId", this.studyStep.studyId)
        : [];
    },
    configuration() {
      return this.studyStep?.configuration || null;
    },
    nlpResults() {
      return this.$store.getters["service/getResults"]("NLPService");
    },
    nlpRequestTimeout() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.request.timeout'));
    },
    documentData() {
      return this.$store.getters["table/document_data/getByKey"]("studySessionId", this.studySessionId);
    },
    placeholders(){
      return this.studyStep?.configuration?.placeholders || null;
    },
    documentSegments() {
        if (!this.documentText || !this.placeholders) return [];

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
              const resolvedSegment = this.resolvePlaceholder(placeholderKey, placeholderConfig);
              if (resolvedSegment) {
                segments.push(resolvedSegment);
              }
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
      return this.$store.getters["table/document_data/getByKey"]("documentId", this.studyStep?.documentId);
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
  },
  watch: {
    nlpResults: function (results) {
      for (let requestId in this.requests) {
        if (requestId in results) {
          const result = this.nlpResults[requestId];
          const uniqueId = this.requests[requestId].uniqueId;

          for (const key in result) {
            if (result.hasOwnProperty(key)) {
              const keyName = uniqueId + "_" + key;
              const value = result[key];
              
              this.$socket.emit("documentDataSave", {
                documentId: this.studyStep?.documentId,
                studySessionId: this.studySessionId,
                studyStepId: this.studyStepId,
                key: keyName,
                value: value,
              });

            }
          }

          this.$store.commit("service/removeResults", {
            service: "NLPService",
            requestId: requestId,
          });
          delete this.requests[requestId];
        }
      }

      if (Object.keys(this.requests).length === 0) {
        this.waiting = false;
      }
    },
    specificDocumentData: {
      handler(newData) {
        this.$emit("update:data", this.specificDocumentData);
      },
      deep: true,
    },
  },
  created() {
    if (this.configuration) {
      this.loadingConfig = false;
    }
    // Delete this after the configuration is implemented
    else {
      this.data = {
        "Feedback": "This is a placeholder for the feedback. The configuration is not implemented yet.",
      };
      this.loadingConfig = false;
    }
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
      }
    );

  },
  mounted() {
    if (this.configuration && "services" in this.configuration && Array.isArray(this.configuration["services"])) {
      this.waiting = true;

      for (const service of this.configuration.services) {
        if (service.type === "nlpRequest") {
          const { skill, inputs: inputs, name } = service;
          this.request(skill, inputs, ("service_" + name));
        }
      }
    }

    this.$refs.modal.open();
  },
  methods: {
    open(data) {
      this.data = data;
      this.$refs.modal.open();
    },
    closeModal(event) {
      this.$emit("close", event);
      this.$refs.modal.close();
    },
    async request(skill, inputs, uniqueId) {
      const requestId = uuid();
      this.requests[requestId] = { skill, inputs, input: "", response: "", uniqueId };

      const input = Object.entries(inputs).reduce((acc, [entry, value]) => {
        acc[entry] = this.studyData[value.stepId][value.dataSource];
        return acc;
      }, {});

      this.requests[requestId].input = input;

      if (!Object.keys(this.documentData).some(key => this.documentData[key]["studySessionId"] === this.studySessionId && key.startsWith(uniqueId) && this.documentData[key]["studyStepId"] === this.studyStepId)) {
        await this.$socket.emit("serviceRequest", {
          service: "NLPService",
          data: { 
             id: requestId,
             name: skill,
             data: input
            }
        }
      );

        setTimeout(() => {
          if (this.requests[requestId]) {
            this.eventBus.emit('toast', {
              title: "NLP Service Request",
              message: "Timeout in request for skill " + skill + " - Request failed!",
              variant: "danger"
            });
          }
        }, this.nlpRequestTimeout);
      }
    },
    async exportStudyData() {
      if (this.isAdmin){
        const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_study_data';
        downloadObjectsAs(this.studyData, filename, 'json');
      }
    },
    resolvePlaceholder(placeholderKey, placeholderConfig) {

      switch (placeholderKey) {
        case 'text':
          const textStepId = placeholderConfig["input"]["stepId"];
          const textDataSource = placeholderConfig["input"]["dataSource"];
          const textElement = Object.values(this.studyData[textStepId]).find(item => item.key === textDataSource);
          return { type: 'text', value: textElement?.value || null };
          case 'chart':
          const chartStepId = placeholderConfig["input"]["stepId"];
          const chartDataSource = placeholderConfig["input"]["dataSource"];
          const chartElement = Object.values(this.studyData[chartStepId]).find(item => item.key === chartDataSource);
          let tempInput = {
            type: "bar",
            data: {
              labels: Object.keys(chartElement?.value),
              datasets: [
                {
                  label: " ",
                  data: Object.values(chartElement?.value),
                  backgroundColor: "rgba(255, 99, 132, 0.5)",
                },
              ],
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: "top",
                },
                title: {
                  display: true,
                  text: "",
                },
              },
              indexAxis: "y"
            },
          };
          return { type: 'chart', value: tempInput };
          case 'comparison':
          if (Array.isArray(placeholderConfig?.input)) {
            const comparisonData = placeholderConfig.input.map(({ stepId, dataSource }) => {
              const comparisonElement = Object.values(this.studyData[stepId]).find(item => item.key === dataSource);
              return comparisonElement?.value || null;
            });

            return { 
              type: 'comparison', 
              value: {
                data: comparisonData,
                title: placeholderConfig.title || 'Comparison Chart',
                labels: placeholderConfig.labels || null
              }
            };
          }
          break;

        default:
          this.eventBus.emit("toast", {
            title: "Placeholder Error",
            message: "Unhandled placeholder type:" + placeholderKey,
            variant: "danger",
          });
          break;
      }

      return null;
    },
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