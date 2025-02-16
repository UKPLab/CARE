<template>
  <Loader v-if="loadingConfig" :loading="true" class="pageLoader" />
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
            Output of the {{skill}}: {{ output }}
          </p>
            <div v-else v-html="documentText"></div>
          </div>
        </div>      
      </template>
      <template #footer>
        <div v-if="!waiting">
          <BasicButton
            v-if="!isLastStep"
            @click="closeModal({ nextStep: true })"
            :title="studyStep?.configuration?.nextButtonText || 'Next'"
          />
          <BasicButton
            v-if="isLastStep"
            @click="closeModal({ endStudy: true })"
            :title="studyStep?.configuration?.finishButtonText || 'Finish Study'"
            :class="studyStep?.configuration?.finishButtonClass || 'btn btn-danger'"
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
import NLPService from "@/basic/NLPService.vue";
import {v4 as uuid} from "uuid";

/**
 * A Modal as per the configuration of the study step
 * Also includes the NLP service to get the output of the skill
 *
 * @author: Juliane Bechert, Manu Sundar Raj Nandyal
 */
  export default {
  name: "Modal",
  components: { BasicButton, BasicModal, NLPService },
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
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    },
    dataFromStudy: {
      type: Array,
      required: false,
      default: [],
    }
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
  },
  watch: {
    nlpResults: function (results) {
      for (let requestId in this.requests) {
          if (requestId in results) {
            //TODO: Should the nlp results be sent individually or as a whole?
            // this.$emit("response", this.nlpResults[this.requestId]);
            this.$emit("documentDataSave", {
              userId: this.userId,
              documentId: this.requests[requestId].output, //TODO: Recheck what the output holds
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,            
              key: "placeholder_/~nlp\[(\d+)\]~/g_" + this.requests[requestId].skill, // Example: placeholder_/~nlp\[(\d+)\]~/g_skill_eic
              value: this.nlpResults[this.requestId]
            });
            this.$store.commit("service/removeResults", {
              service: "NLPService", 
              requestId: requestId 
            });
            delete this.requests[requestId]; 
          }                
      }
      if(Object.keys(this.requests).length === 0){
        this.waiting = false;
      }
    },
  },
  created() {
    if(this.configuration){
      this.loadingConfig = false;
    }
    // Delete this after the configuration is implemented
    else{
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

    if(this.configuration && 'fields' in this.configuration && Array.isArray(this.configuration.fields)){
      this.waiting = true;
      for (let i = 0; i < this.configuration.fields.length; i++) {
        let field = this.configuration.fields[i];

        if (field.function === "nlp") {
          let skill = field.fields.find(f => f.name === "skillName") ;
          let dataSource = field.fields.find(f => f.name === "dataSource");
          let output = field.fields.find(f => f.name === "output");
          this.request(skill, dataSource, output);          
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
    async request(skill, dataSource, output) {
      const requestId = uuid();
      this.requests[requestId] = {
        skill: "",
        dataSource: "",
        output: "",
        input: "",
        result: ""
      };

      // TODO: Save the value of below directly in the this.requests[requestId]
      let dataSourceDoc = this.$store.getters["table/document/get"](dataSource); // TODO : Recheck what the dataSource holds
      // TODO: Should documentGet be done for each of these requests?
      let data = ""; // TODO : Recheck how to get the data
      let outputDoc = this.$store.getters["table/document/get"](output); // TODO : Recheck what the output holds
      // TODO: Should documentDataSave be done for each of these requests?
      await this.$socket.emit("serviceRequest",
            {
              service: "NLPService",
              data: {
                id: requestId,
                name: skill,
                data: data
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