<template>
  <div>
    <h6 class="text-secondary">{{ $t('dashboard.study.targetWorkflowSelection') }}</h6>
    <div class="mb-3">
      <label class="form-label"><strong>{{ $t('dashboard.study.selectTargetWorkflow') }}</strong></label>
      <FormSelect v-model="targetWorkflowId" :options="workflowOptions" />
    </div>
    <div v-if="targetWorkflowId && targetWorkflowSteps.length > 0">
      <h6 class="text-secondary mt-4">{{ $t('dashboard.study.workflowStepMapping') }}</h6>
      <p class="text-muted">{{ $t('dashboard.study.mapWorkflowStepToTarget') }}</p>
      <div v-for="(templateStep, index) in workflowSteps" :key="templateStep.id" class="mb-3">
        <label class="form-label">
          <strong>
            {{ $t('dashboard.study.sourceStepTargetStep', {
              index: index + 1,
              stepType: getStepTypeName(templateStep.stepType),
            }) }}
          </strong>
        </label>
        <FormSelect
            v-model="workflowMapping[templateStep.id]"
            :options="{ options: getTargetStepOptions(templateStep.stepType, templateStep.id) }"
        />
      </div>
    </div>
    <div v-if="bulk" class="mt-4">
      <h6 class="text-secondary">{{ $t('dashboard.study.newStudyOwner') }}</h6>
      <div class="form-check">
        <input id="owner-session" v-model="newStudyOwner" type="radio" class="form-check-input" value="session_owner" />
        <label class="form-check-label" for="owner-session">{{ $t('dashboard.study.userOfStudySession') }}</label>
      </div>
      <div class="form-check">
        <input id="owner-current-user" v-model="newStudyOwner" type="radio" class="form-check-input" value="study_owner" />
        <label class="form-check-label" for="owner-current-user">{{ $t('dashboard.study.ownerOfStudy') }}</label>
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
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
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
      this.$emit('update:isValid', val);
    },
  },
  mounted() {
    if (this.modalValue) {
      if (this.modalValue.targetWorkflowId !== undefined) this.targetWorkflowId = this.modalValue.targetWorkflowId;
      if (this.modalValue.workflowMapping) this.workflowMapping = { ...this.modalValue.workflowMapping };
      if (this.modalValue.newStudyOwner) this.newStudyOwner = this.modalValue.newStudyOwner;
    }
    this.$emit('update:isValid', this.isValid);
  },
  methods: {
    getStepTypeName(stepType) {
      switch (stepType) {
        case 1: return this.$t("dashboard.study.annotator");
        case 2: return this.$t("dashboard.study.editor");
        default: return this.$t("common.unknown");
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
            name: this.$t("dashboard.study.workflowStepOption", {
              index: stepPositionMap.get(step.id),
              type: this.getStepTypeName(step.stepType),
            }),
            value: step.id,
          }));
      if (stepType === 1 && currentStepId) {
        const currentSourceStep = this.workflowSteps.find(s => s.id === currentStepId);
        if (currentSourceStep && currentSourceStep.workflowStepPrevious) {
          const previousSourceStep = this.workflowSteps.find(
              s => s.id === currentSourceStep.workflowStepPrevious
          );
          if (previousSourceStep && previousSourceStep.stepType === 1) {
            options.unshift({
              name: this.$t("dashboard.study.revisedDocument"),
              value: 'previousSubmission',
            });
          }
        }
      }
      return options;
    },
    reset() {
      this.targetWorkflowId = null;
      this.workflowMapping = {};
      this.newStudyOwner = 'session_owner';
    },
  },
};
</script>
