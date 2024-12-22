<template>
  <Loader v-if="loadingConfig" :loading="true" class="pageLoader" />
  <span v-else>
    <BasicModal
      ref="modal"
      :name="configuration?.name || 'Modal'"
      :class="modalClasses"
      :style="{ backgroundColor: configuration?.backgroundColor || '' }"
    >
      <template #title>
        <h5
          class="modal-title"
          :class="configuration?.titleClass || 'text-primary'"
        >
          {{ configuration?.title || 'Feedback' }}
        </h5>
      </template>
      <template #body>
        <div
          class="feedback-container p-3"
          :style="{ color: configuration?.textColor || '' }"
        >
          <p v-if="!data && !data.length && !Object.keys(data).length">
            No feedback available.
          </p>
          <dl v-else>
            <dt v-for="(value, key) in data" :key="key">{{ key }}</dt>
            <dd>{{ value }}</dd>
          </dl>
        </div>
      </template>
      <template #footer>
        <BasicButton
          v-if="!isLastStep"
          @click="closeModal({ nextStep: true })"
          :title="configuration?.nextButtonText || 'Next'"
        />
        <BasicButton
          v-if="isLastStep"
          @click="closeModal({ endStudy: true })"
          :title="configuration?.finishButtonText || 'Finish Study'"
          :class="configuration?.finishButtonClass || 'btn btn-danger'"
        />
      </template>
    </BasicModal>
  </span>
</template>
  
  <script>
  import BasicModal from "@/basic/Modal.vue";
  import BasicButton from "@/basic/Button.vue";
  
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
      };
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
      { documentId: this.studyStep && this.studyStep.documentId ? this.studyStep.documentId : 0 ,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId },
      (res) => {
          
        }
      );
    },
    mounted() {
      this.$refs.modal.open();
    },
    computed:{
      studyStep(){
        return this.studyStepId && this.studyStepId !== 0 ? this.$store.getters["table/studyStep/get"](this.studyStepId) : null;
      },
      workflowStep(){
        return this.studyStep?.workflowStepId ? this.$store.getters["table/workflow_step/get"](this.studyStep.workflowStepId) : null;
      },
      // this configuration is of type json, so it should be parsed
      configuration(){
        return this.workflowStep?.configuration? this.$store.getters["table/workflow_step/get"](this.workflowStep.configuration) : null;
      },
      modalClasses() {
        return [
          this.configuration?.size ? `modal-${this.configuration.size}` : "",
          this.configuration?.customClass || "",
        ].join(" ");
      },
      parseConfiguration(){
        return this.configuration? JSON.parse(this.configuration) : null;
      },
    },
    watch: {},
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