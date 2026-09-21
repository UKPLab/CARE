<template>
  <div>
    <h6 class="text-secondary">Target Workflow Selection</h6>
    <div class="mb-3">
      <label class="form-label"><strong>Select Target Workflow:</strong></label>
      <FormSelect v-model="targetWorkflowId" :options="workflowOptions" />
    </div>
    <div v-if="targetWorkflowId && targetWorkflowSteps.length > 0">
      <div class="mt-3">
        <label class="form-label" for="assignmentSourceCount">Previous sessions per assignment:</label>
        <input
            id="assignmentSourceCount"
            v-model.number="sourceSessionCount"
            type="number"
            min="1"
            :max="workflowSteps.length"
            step="1"
            class="form-control"
        />
      </div>
      <h6 class="text-secondary mt-4">Workflow Step Mapping</h6>
      <p class="text-muted">Map each source workflow step (from template) to a target workflow step:</p>
      <div v-for="(templateStep, index) in workflowSteps" :key="templateStep.id" class="mb-3">
        <label class="form-label">
          <strong>Source Step {{ index + 1 }} ({{ getStepTypeName(templateStep.stepType) }}) → Target Step:</strong>
        </label>
        <FormSelect
            :model-value="getSourceSelection(templateStep.id)"
            :options="{ options: getTargetStepOptions(templateStep.stepType, templateStep.id) }"
            :value-as-object="sourceSessionCount > 1"
            @update:model-value="setSourceSelection(templateStep.id, $event)"
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

/**
 * Step component for mapping source workflow steps (from the template) to steps in a
 * target workflow. Only shown in the study_session assignment flow. The user selects a
 * target workflow and then maps each annotator/editor step from the template to a
 * corresponding step in the target. Also allows choosing the new study owner (session
 * user vs. study owner) when creating bulk assignments.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf, Mohammed Rawhani
 */
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
      sourceSessionCount: 1,
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
    sourceSessionSlots() {
      if (!Number.isInteger(this.sourceSessionCount) || this.sourceSessionCount < 1
          || this.sourceSessionCount > this.workflowSteps.length) return [];
      return Array.from({length: this.sourceSessionCount}, (_, index) => index + 1);
    },
    isWorkflowMappingComplete() {
      if (!this.targetWorkflowId || !this.sourceSessionSlots.length) return false;
      const complete = this.workflowSteps.every(step =>
          Object.prototype.hasOwnProperty.call(this.workflowMapping, step.id)
          && this.getTargetStepOptions(step.stepType, step.id)
              .some(option => option.value === this.getSourceSelection(step.id))
      );
      const usedSlots = new Set(this.workflowSteps.map(step => this.workflowMapping[step.id])
          .filter(mapping => mapping != null)
          .map(mapping => typeof mapping === 'object' ? mapping.sourceSessionSlot : 1));
      return complete && this.sourceSessionSlots.every(slot => usedSlots.has(slot));
    },
    isValid() {
      return !!this.targetWorkflowId && this.isWorkflowMappingComplete;
    },
  },
  watch: {
    sourceSessionCount() {
      if (this.sourceSessionSlots.length) {
        for (const [stepId, mapping] of Object.entries(this.workflowMapping)) {
          if (mapping && typeof mapping === 'object') {
            if (!this.sourceSessionSlots.includes(mapping.sourceSessionSlot)) delete this.workflowMapping[stepId];
            else if (this.sourceSessionCount === 1) this.workflowMapping[stepId] = mapping.workflowStepId;
          }
        }
      }
      this.emitModalValue();
    },
    targetWorkflowId(val) {
      this.initializeEmptyDialogueMappings();
      this.emitModalValue(val);
    },
    workflowMapping: {
      handler(val) {
        this.emitModalValue(this.targetWorkflowId, val);
        this.$emit('update:isWorkflowMappingComplete', this.isWorkflowMappingComplete);
      },
      deep: true,
    },
    newStudyOwner(val) {
      this.emitModalValue(this.targetWorkflowId, this.workflowMapping, val);
    },
    isWorkflowMappingComplete(val) {
      this.$emit('update:isWorkflowMappingComplete', val);
    },
    isValid(val) {
      this.$emit('update:isValid', val);
    },
  },
  mounted() {
    if (this.modalValue) {
      this.sourceSessionCount = this.modalValue.sourceSessionSlots?.length || 1;
      if (this.modalValue.targetWorkflowId !== undefined) this.targetWorkflowId = this.modalValue.targetWorkflowId;
      if (this.modalValue.workflowMapping) this.workflowMapping = { ...this.modalValue.workflowMapping };
      if (this.modalValue.newStudyOwner) this.newStudyOwner = this.modalValue.newStudyOwner;
    }
    this.initializeEmptyDialogueMappings();
    this.$emit('update:isValid', this.isValid);
  },
  methods: {
    initializeEmptyDialogueMappings() {
      this.workflowSteps.forEach(step => {
        if (step.stepType === 4
            && !Object.prototype.hasOwnProperty.call(this.workflowMapping, step.id)) {
          this.workflowMapping[step.id] = null;
        }
      });
    },
    emitModalValue(
        targetWorkflowId = this.targetWorkflowId,
        workflowMapping = this.workflowMapping,
        newStudyOwner = this.newStudyOwner
    ) {
      this.$emit('update:isValid', this.isValid);
      this.$emit('update:modalValue', {
        targetWorkflowId,
        workflowMapping,
        sourceSessionSlots: this.sourceSessionSlots,
        newStudyOwner,
      });
    },
    /** Returns the dropdown key for a stored source mapping. */
    getSourceSelection(stepId) {
      if (!Object.prototype.hasOwnProperty.call(this.workflowMapping, stepId)) return -1;
      const mapping = this.workflowMapping[stepId];
      if (mapping === null) return null;
      const source = typeof mapping === 'object' ? mapping : {workflowStepId: mapping, sourceSessionSlot: 1};
      return this.sourceSessionCount > 1
          ? `${source.sourceSessionSlot}:${source.workflowStepId}` : source.workflowStepId;
    },
    /** Stores legacy IDs for one source, or explicit positions for multiple sources. */
    setSourceSelection(stepId, selection) {
      this.workflowMapping[stepId] = selection && typeof selection === 'object'
          ? {workflowStepId: selection.workflowStepId, sourceSessionSlot: selection.sourceSessionSlot}
          : selection;
    },
    getStepTypeName(stepType) {
      switch (stepType) {
        case 1: return 'Annotator';
        case 2: return 'Editor';
        case 4: return 'Dialogue';
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
      let options = orderedSteps
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
      if (this.sourceSessionCount > 1) {
        const revisionSlots = new Set();
        let previousStep = this.workflowSteps.find(step => step.id === currentStepId);
        while (previousStep?.workflowStepPrevious) {
          previousStep = this.workflowSteps.find(step => step.id === previousStep.workflowStepPrevious);
          const mapping = this.workflowMapping[previousStep?.id];
          const sourceStepId = typeof mapping === 'object' ? mapping?.workflowStepId : mapping;
          if (sourceStepId != null && sourceStepId !== 'previousSubmission') {
            revisionSlots.add(typeof mapping === 'object' ? mapping.sourceSessionSlot : 1);
          }
        }
        options = this.sourceSessionSlots.flatMap(slot => options
            .filter(option => option.value !== 'previousSubmission' || revisionSlots.has(slot))
            .map(option => ({
          ...option,
          name: `Source ${slot} — ${option.name}`,
          value: `${slot}:${option.value}`,
          workflowStepId: option.value,
          sourceSessionSlot: slot,
        })));
      }
      if (stepType === 4) options.unshift({name: 'No copied source', value: null});
      return options;
    },
    reset() {
      this.targetWorkflowId = null;
      this.sourceSessionCount = 1;
      this.workflowMapping = {};
      this.newStudyOwner = 'session_owner';
    },
  },
};
</script>
