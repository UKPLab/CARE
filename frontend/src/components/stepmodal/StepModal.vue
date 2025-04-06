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

            <!-- TODO: Remove check for output once the configuration is fixed-->
            <p v-if="output">
              Output of the {{ skill }}: {{ output }}
            </p>
            <div v-else v-html="documentText"></div>

            <div v-for="(entry, index) in matchedPlaceholderContent" :key="'placeholder-' + index" class="mb-4">
              <template v-if="entry.type === 'text'">
                <p>{{ entry.value }}</p>
              </template>
              <template v-else-if="entry.type === 'chart'">
                <Chart :chartInput="entry.value" :id="'chart' + index"/>
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
import Chart from "./Chart.vue";

/**
 * A Modal as per the configuration of the study step
 * Also includes the NLP service to get the output of the skill
 *
 * @author: Juliane Bechert, Manu Sundar Raj Nandyal
 */
export default {
  name: "StepModal",
  components: { BasicButton, BasicModal, Chart },
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
      modalData: {},
      charts: [
        {
          title: "Horizontal bar chart",
          explanation: "Horizontal bar chart",
          input:{            
            type: "bar",
            data: {
              labels: ["A", "B", "C", "D", "E", "F", "H"],
              datasets: [
                {
                  label: "Frequency",
                  data: [65, 59, 80, 81, 56, 55, 40],
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
                  text: "Frequency",
                },
              },
              indexAxis: "y"
            },
          }
        },
        {
          title: "Stacked horizontal bar chart",
          explanation: "Stacked horizontal bar chart",
          input:{            
            type: "bar",
            data: {
              labels: ["A", "B", "C", "D", "E", "F", "H"],
              datasets: [
                {
                  label: 'Dataset 1',
                  data: [65, 59, 80, 81, 56, 55, 40],
                  backgroundColor: 'rgba(255, 99, 132, 0.5)',
                },
                {
                  label: 'Dataset 2',
                  data: [28, 48, 40, 19, 86, 27, 90],
                  backgroundColor: 'rgba(54, 162, 235, 0.5)',
                }
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
                  text: "Frequency",
                },
              },
              indexAxis: "y",
              scales: {
                x: {
                  stacked: true,
                },
                y: {
                  stacked: true,
                },
              }, 
            },
          }
        },
        {
          title: "Grouped horizontal bar chart",
          explanation: "Grouped horizontal bar chart",
          input:{            
            type: "bar",
            data: {
              labels: ["A", "B", "C", "D", "E", "F", "H"],
              datasets: [
                {
                  label: 'Dataset 1',
                  data: [65, 59, 80, 81, 56, 55, 40],
                  backgroundColor: 'rgba(255, 99, 132, 0.5)',
                },
                {
                  label: 'Dataset 2',
                  data: [28, 48, 40, 19, 86, 27, 90],
                  backgroundColor: 'rgba(54, 162, 235, 0.5)',
                }
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
                  text: "Frequency",
                },
              },
              indexAxis: "y",
            },
          }
        },
      ],
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
    matchedPlaceholderContent() {
      const result = [];
      if (!this.placeholders || !this.documentText) return result;

      const matches = this.matchKeys();

      for (const { key, index } of matches) {
        const placeholderArr = this.placeholders[key];
        if (!placeholderArr || placeholderArr.length <= index) continue;

        const entry = placeholderArr[index];

        if (key === "text") {
          const { stepId, dataSource } = entry;
          const docEntry = this.documentData.find(d => d.studyStepId === stepId && d.key === dataSource);
          if (docEntry?.value) {
            result.push({ type: "text", value: docEntry.value });
          }

        } else if (key === "chart") {
          const { stepId, dataSource } = entry;
          const docEntry = this.documentData.find(d => d.studyStepId === stepId && d.key === dataSource);

          if (docEntry?.value && typeof docEntry.value === "object") {
            const baseChart = JSON.parse(JSON.stringify(this.charts[0])); // Horizontal bar chart
            baseChart.data.title = "";
            baseChart.data.labels = Object.keys(docEntry.value);
            baseChart.data.datasets[0].data = Object.values(docEntry.value);
            result.push({ type: "chart", value: baseChart });
          }

        } else if (key === "comparison") {
          const inputs = entry.input;
          if (Array.isArray(inputs) && inputs.length === 2) {
            const input1 = this.documentData.find(d => d.studyStepId === inputs[0].stepId && d.key === inputs[0].dataSource);
            const input2 = this.documentData.find(d => d.studyStepId === inputs[1].stepId && d.key === inputs[1].dataSource);

            if (input1?.value && input2?.value && typeof input1.value === "object" && typeof input2.value === "object") {
              const baseChart = JSON.parse(JSON.stringify(this.charts[1])); // Stacked horizontal bar chart
              const labels = Object.keys(input1.value);
              baseChart.data.title = "";
              baseChart.data.labels = labels;
              baseChart.data.datasets[0].data = labels.map(label => input1.value[label] || 0);
              baseChart.data.datasets[1].data = labels.map(label => input2.value[label] || 0);
              result.push({ type: "chart", value: baseChart });
            }
          }
        }
      }

      return result;
    }

  },
  watch: {
    nlpResults: function (results) {
      for (let requestId in this.requests) {
        if (requestId in results) {
          this.$socket.emit("documentDataSave", {
            userId: this.userId,
            documentId: this.studyStep.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: this.requests[requestId].uniqueId,
            value: this.nlpResults[requestId]
          });
          this.modalData["dataSavings"][this.requests[requestId].uniqueId] = this.nlpResults[requestId];
          this.$emit("update:data", this.modalData);

          this.$store.commit("service/removeResults", {
            service: "NLPService",
            requestId: requestId
          });        
          delete this.requests[requestId];
        }
      }
      if (Object.keys(this.requests).length === 0) {
        this.waiting = false;
      }
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

      if(!("dataSavings" in this.modalData)){ 
        this.modalData["dataSavings"] = {};
      }

      for (const service of this.configuration.services) {
        if (service.type === "nlpRequest") {
          const { skill, inputs: dataSource, name } = service;
          this.request(skill, dataSource, ("service_" + name));
        }
      }

      this.$emit("update:data", this.modalData);
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
    async request(skill, dataSource, uniqueId) {
      const requestId = uuid();
      this.requests[requestId] = { skill, dataSource, input: "", result: "", uniqueId };

      let input;
      if("v1" in dataSource && "v2" in dataSource){
        const v1Index = this.studySteps.findIndex(step => step.id === dataSource.v1.stepId);
        const v2Index = this.studySteps.findIndex(step => step.id === dataSource.v2.stepId);
        const v1Input = v1Index > -1 ? this.studyData[v1Index + 1][dataSource.v1.dataSource] : ""; // +1 because studySteps is an array and studyData is an object
        const v2Input = v2Index > -1 ? this.studyData[v2Index + 1][dataSource.v2.dataSource] : "";
        input = { v1: v1Input, v2: v2Input };
      } else {
        const index = this.studySteps.findIndex(step => step.id === dataSource.stepId);
        input = index > -1 ? this.studyData[index][dataSource.dataSource] : "";
      }

      this.requests[requestId].input = input;

      if (!(this.documentData["studyStepId"] === this.studyStepId && this.documentData["key"] === uniqueId)) {
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
    matchKeys() {
      if (!this.placeholders || !this.documentText) return [];

      const placeholderKeys = Object.keys(this.placeholders);
      const pattern = new RegExp(`\\b(${placeholderKeys.join('|')})\\b`, 'g');
      const matches = [...this.documentText.matchAll(pattern)];

      const occurrenceCount = {};
      return matches.map(match => {
        const key = match[1];
        if (!occurrenceCount[key]) occurrenceCount[key] = 0;
        else occurrenceCount[key]++;
        return { key, index: occurrenceCount[key] };
      });
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