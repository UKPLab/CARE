<template>
  <div>
    <ApplySkillSetupStepper
      v-if="!isProcessingActive"
      ref="setupStepper"
      title="Preprocess Grading"
      :skills-options="skillMap.options"
      :config-options="configOptions"
      :input-files="inputFiles"
      :columns="columns"
      :options="options"
      submit-text="Apply Skill"
      @submit="onSetupSubmit"
    />

    <ApplySkillProcessStepper
      v-else
      ref="processStepper"
      title="Preprocess Grading"
      :preprocess="preprocess"
      :input-files="inputFiles"
      :options="options"
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
  name: "GradingModal",
  components: { ApplySkillSetupStepper, ApplySkillProcessStepper },
  subscribeTable: ["document","submission", "document_data", "user"],
  emits: ["submit"],
  data() {
    return {
      
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      //preprocess: {}, // Use this for tests: {cancelled: false, requests: {{'f737b280-e11b-47ff-b56f-6320876a1633':{submissionId: 1, docIds: [1], skill: 'grading_expose'},  '30170c9c-233d-4e27-a07b-d70312971428':{submissionId: 2, docIds: [2], skill: 'grading_expose'}}, currentSubmissionsCount: 3}
      currentStep: 1,
      configOptions: [],
    };
  },
  watch: {
    jsonConfig: {
      handler() {
        this.fetchConfigOptions();
      },
      immediate: true,
      deep: true
    }
  },
  computed: {
    preprocess() {
      const bgTask = this.$store.getters["service/get"]("BackgroundTaskService", "backgroundTaskUpdate") || {};
      return bgTask.preprocess || {};
    },
    /**
     * Compute dynamic table columns and attach a filter to the GroupID column.
     * This adds a dropdown funnel button next to GroupID that allows selecting
     * one or more groups to filter the table rows.
     * @returns {Array<{key: string, name: string, filter?: Array<{key: string, name: string}>}>}
     */
    columns() {
      return [
        { key: 'id', name: 'ID' },
        { key: 'userName', name: 'User Name'},
        { key: 'name', name: 'Submission Name' },
        { key: 'group', name: 'GroupID', filter: this.groupFilterOptions },
        { key: 'data_existing', name: 'Data Existing', filter: this.dataExistingFilterOptions },
      ];
    },
    /**
     * Unique GroupIDs from current submissions as checkbox filter options.
     * @returns {Array<{key: string, name: string}>}
     */
    groupFilterOptions() {
      const groups = new Set();
      (this.submissions || []).forEach((s) => {
        if (s && s.group !== null && s.group !== undefined && s.group !== '') {
          groups.add(String(s.group));
        }
      });
      return Array.from(groups)
        .sort((a, b) => {
          const na = Number(a);
          const nb = Number(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        })
        .map((g) => ({ key: g, name: g }));
    },
    dataExistingFilterOptions() {
      const options = new Set();
      (this.inputFiles || []).forEach((s) => {
        options.add(String(s.data_existing));
      });
      return Array.from(options)
        .sort()
        .map((val) => ({ key: val, name: val }));
    },
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    skillMap() {
      return {
        options: this.nlpSkills.map((skill) => ({
          value: skill.name,
          name: skill.name,
        })),
      };
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
    jsonConfig(){
      return this.$store.getters["table/document/getByKey"]('type', 3);
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
  mounted() {
    this.fetchConfigOptions();
  },
  beforeUnmount() {
    
  },
  methods: {
    async fetchConfigOptions() {
      if (!Array.isArray(this.jsonConfig) || this.jsonConfig.length === 0) {
        return;
      }
      this.configOptions = await fetchJsonOptions(this.$socket, this.jsonConfig, "type", "assessment") || [];
    },
    open() {
      if (!this.isProcessingActive) {
        this.$refs.setupStepper.open();
      } else {
        this.$refs.processStepper.open();
      }
    },
    close() {
      if (!this.isProcessingActive) {
        this.$refs.setupStepper.close();
      } else {
        this.$refs.processStepper.close();
      }
    },
    goToStep(step) {
      this.currentStep = step;
    },
    onSetupSubmit(payload) {
      const filesToProcess = payload.inputRows || [];
      if (filesToProcess.length === 0) {
        this.eventBus.emit("toast", {
          title: "No Files to Process",
          message: "Please select at least one file to process.",
          variant: "warning",
        });
        return;
      }

      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "startPreprocessing",
        data: {
          skill: payload.skill,
          config: payload.config,
          inputFiles: payload.inputIds,
        } 
      });
      this.close();
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