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
            <div v-for="(chart, index) in charts" :key="'chart-' + index" class="chart-container mb-5">
              <h5>{{ chart.title }}</h5>
              <p>{{ chart.explanation }}</p>
              <Chart :chartInput="chart.input" :id="'chart' + index"/>
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
      if (this.studyStep.studyId !== 0) {
        return this.$store.getters["table/study_step/getByKey"]("studyId", this.studyStep.studyId);
      } else {
        return [];
      }
    },
    configuration() {
      return this.studyStep && this.studyStep.configuration ? this.studyStep.configuration : null;
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
  },
  watch: {
    nlpResults: function (results) {
      for (let requestId in this.requests) {
        if (requestId in results) {
          //TODO: Recheck this part
          this.$emit("documentDataSave", {
            userId: this.userId,
            documentId: this.studyStep.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: this.requests[requestId].uniqueId,
            value: this.nlpResults[this.requestId]
          });
          console.log("NLP Results: ", this.nlpResults[requestId]);
          console.log("modalData: ", this.modalData);
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
        documentId: this.studyStep && this.studyStep.documentId ? this.studyStep.documentId : 0,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
      },
      (response) => {
        if (response && response.success && response.data && response.data.deltas) {
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
            
      for (let i = 0; i < this.configuration["services"].length; i++) {
        let service = this.configuration["services"][i];

        if (service.type === "nlpRequest") {
          let skill = service["skill"];
          let dataSource = service["inputs"];
          this.request(skill, dataSource, ("service_" + service["name"] + "_classes"));
        }
      }
      
      console.log("services length: ", this.configuration["services"].length);
      console.log("modalData in mounted: ", this.modalData);
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
      this.requests[requestId] = {
        skill: skill,
        dataSource: dataSource,
        input: "",
        result: "",
        uniqueId: uniqueId
      };

      let input;
      if(Object.keys(dataSource).includes("v1") && Object.keys(dataSource).includes("v2")){
        let v1StepIndex = this.studySteps.findIndex(step => step.id === dataSource.v1["stepId"]) + 1; // +1 because studySteps is an array and studyData is an object
        let v2StepIndex = this.studySteps.findIndex(step => step.id === dataSource.v2["stepId"]) + 1;
        let v1Input = v1StepIndex > -1 ? this.studyData[v1StepIndex][dataSource.v1["dataSource"]] : "";
        let v2Input = v2StepIndex > -1 ? this.studyData[v2StepIndex][dataSource.v2["dataSource"]] : "";
        input = {"v1": v1Input, "v2": v2Input};
      }
      else{
        let index = this.studySteps.findIndex(step => step.id === dataSource["stepId"]);;
        input = index > -1 ? this.studyData[index][dataSource["dataSource"]] : "";
      }
      this.requests[requestId]["input"] = input; 
      // TODO: Should documentDataSave be done for each of these requests?

      if (!(this.documentData["studyStepId"] === this.studyStepId && this.documentData["key"] === uniqueId)) {
        await this.$socket.emit("serviceRequest",
          {
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
  },
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