<template>
  <div>
    <h6 class="text-secondary">Target Workflow Selection</h6>
    <div class="mb-3">
      <label class="form-label"><strong>Select Target Workflow:</strong></label>
      <FormSelect v-model="targetWorkflowId" :options="workflowOptions" />
    </div>
    <div v-if="targetWorkflowId && targetWorkflowSteps.length > 0">
      <h6 class="text-secondary mt-4">Workflow Step Mapping</h6>
      <p class="text-muted">Map each source workflow step (from template) to a target workflow step:</p>
      <div v-for="(templateStep, index) in workflowSteps" :key="templateStep.id" class="mb-3">
        <label class="form-label">
          <strong>Source Step {{ index + 1 }} ({{ getStepTypeName(templateStep.stepType) }}) → Target Step:</strong>
        </label>
        <FormSelect
            v-model="workflowMapping[templateStep.id]"
            :options="{ options: getTargetStepOptions(templateStep.stepType, templateStep.id) }"
        />
      </div>
    </div>
    <div v-if="bulk" class="mt-4">
      <h6 class="text-secondary">New Study Owner</h6>
      <div class="form-check">
        <input id="owner-session" v-model="newStudyOwner" type="radio" class="form-check-input" value="session_owner" />
        <label class="form-check-label" for="owner-session">User of the study session</label>
      </div>
      <div class="form-check">
        <input id="owner-current-user" v-model="newStudyOwner" type="radio" class="form-check-input" value="study_owner" />
        <label class="form-check-label" for="owner-current-user">Owner of the study</label>
      </div>
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "WorkflowMappingStep",
  components: { FormSelect },
  props: {
    workflowSteps: {
      type: Array,
      default: () => [],
    },
    bulk: {
      type: Boolean,
      default: true,
    },
    modalValue: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      targetWorkflowId: null,
      workflowMapping: {},
      newStudyOwner: 'session_owner',
    };
  },
  computed: {
    workflowOptions() {
      return {
        options: this.$store.getters["table/workflow/getAll"].map(workflow => ({
          name: workflow.name,
          value: workflow.id,
        })),
      };
    },
    targetWorkflowSteps() {
      if (!this.targetWorkflowId) return [];
      return this.$store.getters["table/workflow_step/getFiltered"](
          item => item.workflowId === this.targetWorkflowId
      ) || [];
    },
    isWorkflowMappingComplete() {
      if (!this.targetWorkflowId) return false;
      return this.workflowSteps.every(step => {
        return this.workflowMapping[step.id] !== undefined && this.workflowMapping[step.id] !== null;
      });
    },
    isValid() {
      return !!this.targetWorkflowId && this.isWorkflowMappingComplete;
    },
  },
  watch: {
    targetWorkflowId(val) {
      this.$emit('update:modalValue', { targetWorkflowId: val, workflowMapping: this.workflowMapping, newStudyOwner: this.newStudyOwner });
    },
    workflowMapping: {
      handler(val) {
        this.$emit('update:modalValue', { targetWorkflowId: this.targetWorkflowId, workflowMapping: val, newStudyOwner: this.newStudyOwner });
        this.$emit('update:isWorkflowMappingComplete', this.isWorkflowMappingComplete);
      },
      deep: true,
    },
    newStudyOwner(val) {
      this.$emit('update:modalValue', { targetWorkflowId: this.targetWorkflowId, workflowMapping: this.workflowMapping, newStudyOwner: val });
    },
    isWorkflowMappingComplete(val) {
      this.$emit('update:isWorkflowMappingComplete', val);
    },
    isValid(val) {
      console.log('[WorkflowMappingStep] isValid emit:', val);
      this.$emit('update:isValid', val);
    },
  },
  mounted() {
    if (this.modalValue) {
      if (this.modalValue.targetWorkflowId !== undefined) this.targetWorkflowId = this.modalValue.targetWorkflowId;
      if (this.modalValue.workflowMapping) this.workflowMapping = { ...this.modalValue.workflowMapping };
      if (this.modalValue.newStudyOwner) this.newStudyOwner = this.modalValue.newStudyOwner;
    }
    console.log('[WorkflowMappingStep] mounted isValid:', this.isValid);
    this.$emit('update:isValid', this.isValid);
  },
  methods: {
    getStepTypeName(stepType) {
      switch (stepType) {
        case 1: return 'Annotator';
        case 2: return 'Editor';
        default: return 'Unknown';
      }
    },
    getTargetStepOptions(stepType, currentStepId) {
      const orderedSteps = [];
      const stepPositionMap = new Map();
      const nextMap = new Map(this.targetWorkflowSteps.map(s => [s.workflowStepPrevious, s]));
      let current = this.targetWorkflowSteps.find(s => s.workflowStepPrevious === null);
      let position = 1;
      while (current) {
        orderedSteps.push(current);
        stepPositionMap.set(current.id, position);
        current = nextMap.get(current.id);
        position++;
      }
      const options = orderedSteps
          .filter(step => step.stepType === stepType)
          .map(step => ({
            name: `<Workflow> Step ${stepPositionMap.get(step.id)} (${this.getStepTypeName(step.stepType)})`,
            value: step.id,
          }));
      if (stepType === 1 && currentStepId) {
        const currentSourceStep = this.workflowSteps.find(s => s.id === currentStepId);
        if (currentSourceStep && currentSourceStep.workflowStepPrevious) {
          const previousSourceStep = this.workflowSteps.find(
              s => s.id === currentSourceStep.workflowStepPrevious
          );
          if (previousSourceStep && previousSourceStep.stepType === 1) {
            options.unshift({ name: '<Document> Revised Document', value: 'previousSubmission' });
          }
        }
      }
      return options;
    },
    getSubmission(studyId) {
      const studySteps = this.$store.getters["table/study_step/getFiltered"](
          s => s.studyId === studyId
      ) || [];
      for (const step of studySteps) {
        if (step.stepType === 1 && step.documentId !== null) {
          let document = this.$store.getters["table/document/get"](step.documentId);
          while (document && document.parentDocumentId !== null) {
            document = this.$store.getters["table/document/get"](document.parentDocumentId);
          }
          if (document && document.submissionId) {
            const submission = this.$store.getters["table/submission/get"](document.submissionId);
            if (submission) return submission;
          }
        }
      }
      return null;
    },
    reset() {
      this.targetWorkflowId = null;
      this.workflowMapping = {};
      this.newStudyOwner = 'session_owner';
    },
  },
};
</script>
