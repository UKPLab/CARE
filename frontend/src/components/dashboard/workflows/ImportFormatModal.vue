<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValid"
    size="lg"
    @submit="importWorkflows"
    @hide="reset"
  >
    <template #title>
      <h5 class="modal-title">{{ $t("workflow.importFormatModal.title") }}</h5>
    </template>

    <!-- Step 1: File picker -->
    <template #step-1>
      <div class="form-field d-flex flex-column">
        <label class="form-label w-100 text-start mb-2">
          {{ $t("workflow.importFormatModal.selectWorkflowFile") }}
        </label>

        <div class="w-100">
          <input
            ref="fileInput"
            class="form-control"
            type="file"
            accept=".json,.yaml,.yml,application/json,text/yaml,text/x-yaml,application/x-yaml"
            @change="handleFileSelect"
          />
        </div>
      </div>
      <div v-if="selectedFile" class="mt-2">
        <small class="text-muted">{{ $t("workflow.importFormatModal.selectedFile", { file: selectedFile.name }) }}</small>
      </div>
      <div v-if="parseError" class="mt-2 text-danger">
        <small>{{ parseError }}</small>
      </div>
    </template>

    <!-- Step 2: Workflow selection -->
    <template #step-2>
      <p class="text-muted mb-2">
        {{ $t("workflow.importFormatModal.selectWorkflowsPrefix") }}
        <strong>{{ selectedFile && selectedFile.name }}</strong>:
      </p>
      <BasicTable
        v-model="selectedWorkflows"
        :columns="tableColumns"
        :data="tableData"
        :options="tableOptions"
        :max-table-height="400"
      />
    </template>

    <!-- Step 3: Confirmation -->
    <template #step-3>
      <p>{{ $t("workflow.importFormatModal.confirmQuestion") }}</p>
      <ul>
        <li v-for="wf in selectedWorkflows" :key="wf._idx">
          <strong>{{ wf.name }}</strong> — {{ $t("workflow.importFormatModal.stepCount", { count: wf.stepCount }) }}
        </li>
      </ul>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import yaml from "js-yaml";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Import Format Modal Component
 *
 * Allows users to import workflows from a JSON or YAML file using a stepper
 * with a selectable table to choose which workflows to import.
 *
 * @author Karim Ouf
 */
export default {
  name: "ImportFormatModal",
  components: { StepperModal, BasicTable },
  data() {
    return {
      selectedFile: null,
      workflowData: null,
      selectedWorkflows: [],
      parseError: null,
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    steps() {
      return [
        { title: this.$t("workflow.importFormatModal.steps.fileSelection") },
        { title: this.$t("workflow.importFormatModal.steps.workflowSelection") },
        { title: this.$t("workflow.importFormatModal.steps.confirmation") },
      ];
    },
    stepValid() {
      return [
        !!this.workflowData,
        this.selectedWorkflows.length > 0,
        true,
      ];
    },
    tableData() {
      if (!this.workflowData) return [];
      return this.workflowData.map((wf, idx) => ({
        _idx: idx,
        name: wf.name,
        stepCount: (wf.steps || []).length,
        hidden: {
          text: wf.hideInFrontend ? this.$t("common.yes") : this.$t("common.no"),
          class: wf.hideInFrontend ? "bg-warning" : "bg-success",
        },
      }));
    },
    tableColumns() {
      return [
        { name: this.$t("common.name"), key: "name", sortable: true },
        { name: this.$t("workflow.importFormatModal.table.steps"), key: "stepCount", sortable: true },
        { name: this.$t("workflow.importFormatModal.table.hidden"), key: "hidden", type: "badge" },
      ];
    },
    tableOptions() {
      return {
        striped: true,
        hover: true,
        selectableRows: true,
        scrollY: true,
        search: true,
      };
    },
  },
  methods: {
    open() {
      this.reset();
      this.$refs.stepper.open();
    },
    close() {
      this.$refs.stepper.close();
    },
    reset() {
      this.selectedFile = null;
      this.workflowData = null;
      this.selectedWorkflows = [];
      this.parseError = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      this.workflowData = null;
      this.selectedWorkflows = [];
      this.parseError = null;
      this.processFile(file);
    },
    async processFile(file) {
      try {
        const content = await this.readFile(file);
        const isYaml =
          file.name.toLowerCase().endsWith(".yaml") ||
          file.name.toLowerCase().endsWith(".yml");

        let parsed = isYaml ? yaml.load(content) : JSON.parse(content);

        if (parsed && !Array.isArray(parsed)) {
          parsed = [parsed];
        }

        this.workflowData = parsed;
        // Pre-select all rows
        this.selectedWorkflows = this.tableData.slice();
      } catch (error) {
        console.error("Error processing file:", error);
        this.parseError = this.$t("workflow.importFormatModal.errors.parseFileFailed", { message: error.message });
        this.selectedFile = null;
        this.workflowData = null;
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(this.$t("workflow.importFormatModal.errors.readFileFailed")));
        reader.readAsText(file);
      });
    },
    async createWorkflowSteps(workflowId, steps) {
      let previousStepId = null;
      for (const [idx, step] of steps.entries()) {
        const stepResult = await new Promise((resolve) => {
          this.$socket.emit(
            "appDataUpdate",
            {
              table: "workflow_step",
              data: {
                name: step.name || step.stepType + " Step " + (idx + 1),
                stepNumber: idx + 1,
                workflowId,
                stepType: step.stepType,
                configuration: step.configuration || {},
                allowBackward: step.allowBackward || false,
                workflowStepDocument:
                  step.workflowStepDocument != null && step.workflowStepDocument !== ""
                    ? step.workflowStepDocument
                    : null,
                workflowStepPrevious: previousStepId,
              },
            },
            (r) => resolve(r)
          );
        });

        if (stepResult.success) {
          previousStepId = stepResult.data;
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("workflow.importFormatModal.errors.importError"),
            message: this.$t("workflow.importFormatModal.errors.importStepFailed", {
              step: step.name,
              message: resolveApiMessage(stepResult),
            }),
            variant: "danger",
          });
        }
      }
    },
    async importWorkflows() {
      if (!this.workflowData || this.selectedWorkflows.length === 0) return;
      this.$refs.stepper.setWaiting(true);

      const toImport = this.selectedWorkflows.map((row) => this.workflowData[row._idx]);

      for (const workflow of toImport) {
        const workflowResult = await new Promise((resolve) => {
          this.$socket.emit(
            "appDataUpdate",
            {
              table: "workflow",
              data: {
                name: workflow.name,
                userId: this.userId,
                description: workflow.description || "",
                parentWorkflowId: null,
                hideInFrontend: workflow.hideInFrontend || false,
              },
            },
            (r) => resolve(r)
          );
        });

        if (workflowResult.success) {
          await this.createWorkflowSteps(workflowResult.data, workflow.steps || []);
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("workflow.importFormatModal.errors.importError"),
            message: this.$t("workflow.importFormatModal.errors.importWorkflowFailed", {
              workflow: workflow.name,
              message: resolveApiMessage(workflowResult),
            }),
            variant: "danger",
          });
        }
      }

      this.$refs.stepper.setWaiting(false);
      this.eventBus.emit("toast", {
        title: this.$t("workflow.importFormatModal.success.title"),
        message: toImport.length === 1
          ? this.$t("workflow.importFormatModal.success.single", { count: toImport.length })
          : this.$t("workflow.importFormatModal.success.multiple", { count: toImport.length }),
        variant: "success",
      });
      this.close();
    },
  },
};
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 15px 0;
}

.form-field .form-label {
  flex-shrink: 0;
  margin-bottom: 0;
  margin-right: 0.5rem;
  min-width: 160px;
}
</style>
