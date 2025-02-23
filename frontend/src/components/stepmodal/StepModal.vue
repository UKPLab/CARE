<template>
  <Loader v-if="loadingConfig" :loading="true" class="pageLoader"/>
  <span v-else>
    <BasicModal
      ref="modal"
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
          <BasicButton
            v-if="isLastStep"
            :title="studyStep?.configuration?.finishButtonText || 'Finish Study'"
            :class="studyStep?.configuration?.finishButtonClass || 'btn btn-danger'"
            @click="closeModal({ endStudy: true })"
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

/**
 * A Modal as per the configuration of the study step
 * Also includes the NLP service to get the output of the skill
 *
 * @author: Juliane Bechert, Manu Sundar Raj Nandyal
 */
export default {
  name: "StepModal",
  components: {BasicButton, BasicModal},
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
      documentText: null, // Holds the parsed content of the delta document
      waiting: false, // Holds the status of the NLP service which is waiting for the response
      requests: {},
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
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
          //TODO: Should the nlp results be sent individually or as a whole?
          // this.$emit("response", this.nlpResults[this.requestId]);
          this.$emit("documentDataSave", {
            userId: this.userId,
            documentId: this.studyStep.documentId, //TODO: Recheck which documentId to be saved
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: this.requests[requestId].uniqueId,
            value: this.nlpResults[this.requestId]
          });
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

    if (this.configuration && 'fields' in this.configuration && Array.isArray(this.configuration.fields)) {
      this.waiting = true;
      for (let i = 0; i < this.configuration.fields.length; i++) {
        let field = this.configuration.fields[i];

        if (field.function === "nlp") {
          let skill = field.fields.find(f => f.name === "skillName");
          let dataSource = field.fields.find(f => f.name === "dataSource");
          let output = field.fields.find(f => f.name === "output");
          this.request(skill, dataSource, output, (field.type + "_" + field)); //TODO: Check if the configuration is always having the same order of fields
          /*
          CONFIGURATION IN THE STUDY STEP LOOKS LIKE THIS:
          configuration: {
          fields: [
            {
              type: "placeholder",
              pattern: "/~nlp\[(\d+)\]~/g",
              required: true,
              function: "nlp", 
              fields: [
                {........
          */
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
    async request(skill, dataSource, output, uniqueId) {
      const requestId = uuid();
      this.requests[requestId] = {
        skill: skill,
        dataSource: dataSource,
        output: output,
        input: "",
        result: "",
        uniqueId: uniqueId
      };

      // TODO: Save the value of below directly in the this.requests[requestId]// TODO : Recheck what the dataSource holds? Ans.{v1 and v2}
      
      let input = Object.keys(dataSource).includes("v2") ? 
        {v1: this.studyData[this.studyStep.previousStepId][dataSource.v1], v2: this.studyData[this.studyStepId][dataSource.v2]} : 
          {v1: this.studyData[this.studyStepId][dataSource.v1]};
      this.requests[requestId]["input"] = input;
      // TODO: Should documentDataSave be done for each of these requests?

      if (this.documentData["studyStepId"] === this.studyStepId && this.documentData["key"] === uniqueId) {
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
          if (requestId) {
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