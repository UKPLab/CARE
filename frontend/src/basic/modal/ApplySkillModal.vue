<template>
  <div>
    <ApplySkillSetupStepper
      v-if="!isProcessingActive"
      ref="applySkillSetupStepper"
    />

    <ApplySkillProcessStepper
      v-else
      ref="processStepper"
      title="Preprocess Grading"
      :preprocess="preprocess"
      :input-files="inputFiles"
      :current-step="currentStep"
      :show-close="true"
      :force-processing-active="forceProcessingActive"
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
      forceProcessingActive: false,
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
      if (this.forceProcessingActive) return true;
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
    onSkillsApplied() {
      this.forceProcessingActive = true;
      this.fetchBackgroundTaskState();
    },
    fetchBackgroundTaskState() {
      return new Promise((resolve) => {
        this.$socket.emit("serviceCommand", {
          service: "BackgroundTaskService",
          command: "getBackgroundTask",
          data: {}
        }, () => {
          this.$nextTick(() => {
            if (!(this.preprocess && this.preprocess.requests && Object.keys(this.preprocess.requests).length > 0)) {
              this.forceProcessingActive = false;
            }
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
  },
};
</script> 

<style scoped>
</style>