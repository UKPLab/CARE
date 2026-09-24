<template>
  <div>
    <ApplySkillSetupStepper
        v-if="!showProcessStepper"
        ref="applySkillSetupStepper"
        @start-preprocessing="startPreprocessing"
    />

    <ApplySkillProcessStepper
        v-else
        ref="processStepper"
        :title="$t('nlp.preprocessing.title')"
        :preprocess="preprocess"
        :input-files="inputFiles"
        :current-step="currentStep"
        :show-close="true"
        :cancel-next-text="$t('nlp.preprocessing.cancelButton')"
        @cancel="cancelProcessing"
        @confirm="confirmCompletion"
    />
  </div>
</template>

<script>
import ApplySkillSetupStepper from "@/basic/modal/ApplySkillSetupStepper.vue";
import ApplySkillProcessStepper from "@/basic/modal/ApplySkillProcessStepper.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "ApplySkillModal",
  components: {ApplySkillSetupStepper, ApplySkillProcessStepper},
  subscribeTable: ["document", "submission", "document_data", "user"],
  emits: ["submit"],
  data() {
    return {
      currentStep: 1,
      isAutoOpened: false,
      isWaitingForData: false,
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
        name: submission.name || this.$t('nlp.preprocessing.submissionName', { id: submission.id }),
        group: submission.group,
        userName: submission.userName,
        data_existing: (submission.data_existing || false) ? this.$t('common.yes') : this.$t('common.no'),
      }));
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"].map(submission => {
        const documents = this.$store.getters["table/document/getByKey"]('submissionId', submission.id);
        const docIds = documents.map(d => d.id);
        const dataExists = docIds.some(docId => this.$store.getters["table/document_data/getByKey"]('documentId', docId).length > 0);
        const user = this.$store.getters["table/user/get"](submission.userId);
        return {
          ...submission,
          userName: user ? user.userName : this.$t('common.na'),
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
    isCompleted() {
      return this.preprocess && this.preprocess.completed === true;
    },
    showProcessStepper() {
      return this.isProcessingActive || this.isCompleted;
    },
  },
  watch: {
    isProcessingActive: {
      handler(newVal, oldVal) {
        if (newVal && !oldVal && this.isWaitingForData) {
          this.isWaitingForData = false;
          this.autoOpenProcessStepper();
        }
      },
      immediate: true
    },
  },
  mounted() {
    this.$socket.emit("serviceCommand", {
      service: "BackgroundTaskService",
      command: "subscribeBackgroundTaskUpdates",
      data: {}
    });
  },
  unmounted() {
    this.$socket.emit("serviceCommand", {
      service: "BackgroundTaskService",
      command: "unsubscribeBackgroundTaskUpdates",
      data: {}
    });
  },
  methods: {
    async open() {
      if (!this.showProcessStepper) {
        this.$refs.applySkillSetupStepper.open();
      } else {
        this.eventBus.emit("toast", {
          title: this.isCompleted
              ? this.$t('nlp.preprocessing.toasts.completeTitle')
              : this.$t('nlp.preprocessing.toasts.inProgressTitle'),
          message: this.isCompleted
              ? this.$t('nlp.preprocessing.toasts.completeMsg')
              : this.$t('nlp.preprocessing.toasts.inProgressMsg'),
          variant: "info",
        });
        this.$refs.processStepper.open();
      }
    },
    close() {
      this.isAutoOpened = false;
      this.isWaitingForData = false;

      if (!this.showProcessStepper) {
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
            title: this.$t('nlp.preprocessing.toasts.cancelledTitle'),
            message: this.$t('nlp.preprocessing.toasts.cancelledMsg'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('nlp.preprocessing.toasts.cancellationFailedTitle'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    async startPreprocessing(preprocessingData) {
      this.$refs.applySkillSetupStepper.close();

      this.isWaitingForData = true;

      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "startPreprocessing",
        data: preprocessingData
      });

      this.eventBus.emit("toast", {
        title: this.$t('nlp.preprocessing.toasts.startedTitle'),
        message: this.$t('nlp.preprocessing.toasts.startedMsg'),
        variant: "info",
        autohide: true,
        delay: 5000
      });

      setTimeout(() => {
        this.checkAndOpenProcessStepper();
      }, 1000);
    },

    async checkAndOpenProcessStepper() {
      if (this.isProcessingActive) {
        this.autoOpenProcessStepper();
      } else if (this.isWaitingForData) {
        setTimeout(() => {
          this.checkAndOpenProcessStepper();
        }, 2000);
      }
    },

    autoOpenProcessStepper() {
      this.isAutoOpened = true;
      this.$refs.processStepper.open();

      this.eventBus.emit("toast", {
        title: this.$t('nlp.preprocessing.toasts.inProgressTitle'),
        message: this.$t('nlp.preprocessing.toasts.nowRunningMsg'),
        variant: "success",
      });
    },

    openProcessStepperIfActive() {
      if (this.isProcessingActive && !this.isAutoOpened) {
        this.autoOpenProcessStepper();
      }
    },

    confirmCompletion() {
      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "confirmCompletion",
        data: {}
      }, (res) => {
        if (res.success) {
          this.isAutoOpened = false;
          this.$refs.processStepper.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('nlp.preprocessing.toasts.confirmationFailedTitle'),
            message: resolveApiMessage(res),
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