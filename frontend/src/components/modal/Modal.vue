<template>
  <Loader v-if="loadingConfig" :loading="true" class="pageLoader" />
  <span v-else>
    <NLPService ref="nlp" :data="data.data" :skill="skill" @response="response" :disabled="true" hidden />
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
      </template>
      <template #footer>
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
      </template>
    </BasicModal>
  </span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Quill from "quill";
import NLPService from "@/basic/NLPService.vue";

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
    data: {
      type: Object,
      required: false,
      default: {},
    }
  },
  data() { 
    return {
      loadingConfig: true, 
      data: {
        data: "" // This input data is also wrong, because the data should contain everything from the configuration and not just the input for the NLP service
      }, 
      skill: "skill_eic", // to be read from the configuration
      documentText: null, // Holds the parsed content of the delta document
      output: null, // Holds the output from the NLP service
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },    
    configuration() {
      return this.studyStep && this.studyStep.configuration ? this.studyStep.configuration : null;
    }
  },
  created() {
    if(this.configuration){
      this.data = this.configuration;
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
    if(this.configuration && "functionality" in this.configuration){
      // this.skill = "skillName" in this.configuration.firstOpen? this.configuration.firstOpen.skillName : this.skill;
      // TODO: if functionality, check for nlp pattern and should be possible for multiple nlp calls
      this.$refs.nlp.request();
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
    response(response) {
      this.output = response;
    }
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