<template>
  <div>
    <ApplySkillSetupStepper
      v-if="!isProcessingActive"
      ref="applySkillSetupStepper"
      @start-preprocessing="startPreprocessing"
    />

    <ApplySkillProcessStepper
      v-else
      ref="processStepper"
      title="Preprocess Grading"
      :preprocess="preprocess"
      :input-files="inputFiles"
      :current-step="currentStep"
      :show-close="true"
      cancel-next-text="Cancel Preprocess"
      @cancel="cancelProcessing"
    />
  </div>
</template>

<script>
import ApplySkillSetupStepper from "@/basic/modal/ApplySkillSetupStepper.vue";
import ApplySkillProcessStepper from "@/basic/modal/ApplySkillProcessStepper.vue";

export default {
  name: "ApplySkillModal",
  components: { ApplySkillSetupStepper, ApplySkillProcessStepper },
  subscribeTable: ["document","submission", "document_data", "user"],
  emits: ["submit"],
  data() {
    return {
      currentStep: 1,
    };
  },
  computed: {
    preprocess() {
      const bgTask = this.$store.getters["service/get"]("BackgroundTaskService", "backgroundTaskUpdate") || {};
      return bgTask.preprocess || {};
    },
    inputFiles() {
      return (this.submissions || []).map(submission => ({
        id: submission.id,
        name: submission.name || `Submission ${submission.id}`,
        group: submission.group,
        userName: submission.userName,
        data_existing: (submission.data_existing || false) ? 'Yes' : 'No',
      }));
    },
    submissions(){
        return this.$store.getters["table/submission/getAll"].map(submission => {
            const documents = this.$store.getters["table/document/getByKey"]('submissionId', submission.id);
            const docIds = documents.map(d => d.id);
            const dataExists = docIds.some(docId => this.$store.getters["table/document_data/getByKey"]('documentId', docId).length > 0);
            const user = this.$store.getters["table/user/get"](submission.userId);
            return {
                ...submission,
                userName: user ? user.userName : "N/A",
                data_existing: dataExists
            }
        });
    },
    isProcessingActive() {
      return (
        this.preprocess &&
        this.preprocess.requests &&
        typeof this.preprocess.requests === 'object' &&
        Object.keys(this.preprocess.requests).length > 0
      );
    },
  },
  created() {
    this.fetchBackgroundTaskState();
  },
  mounted() {
    this.fetchBackgroundTaskState();
  },
  methods: {
    fetchBackgroundTaskState() {
      return new Promise((resolve) => {
        this.$socket.emit("serviceCommand", {
          service: "BackgroundTaskService",
          command: "getBackgroundTask",
          data: {}
        }, () => {
          this.$nextTick(() => {
            resolve();
          });
        });
      });
    },
    async open() {
      await this.fetchBackgroundTaskState();
      
      if (!this.isProcessingActive) {
        this.$refs.applySkillSetupStepper.open();
      } else {
        this.$refs.processStepper.open();
      }
    },
    close() {
      this.stopPolling();
      this.isAutoOpened = false;
      this.isWaitingForData = false;
      
      if (!this.isProcessingActive) {
        this.$refs.applySkillSetupStepper.close();
      } else {
        this.$refs.processStepper.close();
      }
    },
    goToStep(step) {
      this.currentStep = step;
    },
    cancelProcessing() {
      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "cancelPreprocessing",
        data: {}
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Cancelled",
            message: "Grading process has been cancelled.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Cancellation Failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    async startPreprocessing(preprocessingData) {
      this.$refs.applySkillSetupStepper.close();
      
      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "startPreprocessing",
        data: preprocessingData
      });
      
      this.$refs.processStepper.open();
    },
  },
};
</script> 

<style scoped>
</style>