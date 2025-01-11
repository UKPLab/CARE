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
          class="feedback-container p-3"
          :style="{ color: studyStep?.configuration?.textColor || '' }"
        >
          <p v-if="!documentText">
            No content available for this step.
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


/**
 * Providing information from the NLP Model
 *
 * @author: Juliane Bechert, Manu Sundar Raj Nandyal
 */
  export default {
  name: "Modal",
  components: { BasicButton, BasicModal },
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
      default: null // Allows for null if not in a study session
    },
    userId: {
      type: Number,
      required: false,
      default: null
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false, // Default to false if not provided
    },
  },
  data() { 
    return {
      loadingConfig: true, 
      data: {},
      documentText: null, // Holds the parsed content of the delta document
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
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