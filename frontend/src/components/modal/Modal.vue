<template>
  <Loader
      v-if="documentId && documentId === 0"
      :loading="true"
      class="pageLoader"
  />
  <span v-else>
    <BasicModal ref="modal" 
    name="Modal">
      <template #title>
        <h5 class="modal-title text-primary">Feedback</h5>
      </template>
      <template #body>
        <div class="feedback-container p-3">
          <p v-if="!data.length && !Object.keys(data).length">No feedback available.</p>
          <dl v-else>
            <dt v-for="(value, key) in data" :key="key">{{ key }}</dt>
            <dd>{{ value }}</dd>
          </dl>
        </div>
      </template>
      <template #footer>
        <!-- "Next" Button for Non-Last Steps -->
        <BasicButton
          v-if="!isLastStep"
          @click="closeModal({ nextStep: true })"
          title="Next"
        />
        <!-- "Finish Study" Button for Last Step -->
        <BasicButton
          v-if="isLastStep"
          @click="closeModal({ endStudy: true })"
          title="Finish Study"
          class="btn btn-danger"
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
      studyStepId: { type: Number, required: true },
      isLastStep: { type: Boolean, default: false },
    },
    data() {
      return {
        data: {}, 
      };
    },
    mounted() {
      this.$refs.modal.open();
    },
    computed:{
      studyStep(){
        return this.studyStepId && this.studyStepId !== 0 ? this.$store.getters["table/studyStep/get"](this.studyStepId) : null;
      },
      workflowStep(){
        return this.studyStep && this.studyStep.workflowStepId ? this.$store.getters["table/workflow_step/get"](this.studyStep.workflowStepId) : null;
      },
      configuration(){
        return this.workflowStep && this.workflowStep.configuration ? this.$store.getters["table/workflow_step/get"](this.workflowStep.configuration) : null;
      },
      
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