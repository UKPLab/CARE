<template>
  <div>
    <BasicForm
        ref="templateSelectionForm"
        v-model="templateSelection"
        :fields="templateSelectionFields"
    />
    <div class="mt-3"><strong>{{ $t('dashboard.study.workflowSteps') }}</strong></div>
    <ul class="list-group">
      <li
          v-for="(workflowStep, index) in workflowSteps"
          :key="workflowStep.id"
          class="list-group-item"
          :class="workflowStep.workflowStepDocument !== null ? 'disabled' : 'list-group-item-primary'">
        {{ $t('dashboard.study.workflowStepWithIndex', { index: index + 1 }) }}
        {{ getStepTypeName(workflowStep.stepType) }}
      </li>
    </ul>
    <div class="mt-3">
      <label class="form-label"><strong>{{ $t('dashboard.study.assignmentBase') }}</strong></label>
      <FormSelect v-model="assignmentTypeSelection.type" :options="assignmentTypeFields" />
    </div>
    <div class="mt-3">
      <div class="form-check">
        <input id="emailNotifyCheck" v-model="enableEmailNotification" type="checkbox" class="form-check-input" />
        <label class="form-check-label" for="emailNotifyCheck">
          <strong>{{ $t('dashboard.study.sendEmailNotificationToReviewer') }}</strong>
        </label>
      </div>
    </div>
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import FormSelect from "@/basic/form/Select.vue";

/**
 * First step of the bulk assignment wizard. Allows the user to pick a study template,
 * choose whether assignments are based on documents, submissions, or study sessions,
 * and opt in to email notifications for reviewers. Emits template and workflow data
 * to the parent so downstream steps can filter and map workflow steps accordingly.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "TemplateSelectionStep",
  components: { BasicForm, FormSelect },
  emits: ['update:modalValue', 'update:assignmentType', 'update:workflowSteps', 'update:workflowStepsAssignment', 'update:template', 'update:workflow', 'update:isValid'],
  subscribeTable: [
    { filter: [{ key: "template", value: true }], table: "study" },
    {table: "workflow"},
    { table: "workflow_step" }
  ],
  props: {
    modalValue: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      templateSelection: {},
      assignmentTypeSelection: {},
      enableEmailNotification: false,
    };
  },
  computed: {
    templates() {
      return this.$store.getters["table/study/getFiltered"](item => item.template === true);
    },
    template() {
      if (!this.templateSelection.template) return null;
      return this.$store.getters["table/study/get"](this.templateSelection.template);
    },
    workflow() {
      if (!this.template) return null;
      return this.$store.getters["table/workflow/get"](this.template.workflowId);
    },
    workflowSteps() {
      if (!this.template) return [];
      return this.$store.getters["table/workflow_step/getFiltered"](
          item => item.workflowId === this.template.workflowId
      );
    },
    workflowStepsAssignment() {
      return this.workflowSteps.filter(
          step => step.stepType === 1 && step.workflowStepDocument === null
      );
    },
    assignmentType() {
      return this.assignmentTypeSelection.type || 'document';
    },
    templateSelectionFields() {
      return [
        {
          key: "template",
          label: this.$t("studies.template"),
          type: "select",
          options: this.templates.map(template => ({
            name: template.name,
            value: template.id,
          })),
          required: true,
        },
      ];
    },
    assignmentTypeFields() {
      return {
        options: [
          { value: 'document', name: this.$t("dashboard.study.basedOnDocuments") },
          { value: 'submission', name: this.$t("dashboard.study.basedOnSubmissions") },
          { value: 'study_session', name: this.$t("dashboard.study.studySessions") },
        ],
      };
    },
    isValid() {
      return this.workflowStepsAssignment.length > 0 && !!this.assignmentType;
    },
  },
  watch: {

    templateSelection: {
      handler(val) {
        this.$emit('update:modalValue', { templateSelection: val, assignmentTypeSelection: this.assignmentTypeSelection, enableEmailNotification: this.enableEmailNotification });
      },
      deep: true,
    },
    assignmentTypeSelection: {
      handler(val) {
        this.$emit('update:modalValue', { templateSelection: this.templateSelection, assignmentTypeSelection: val, enableEmailNotification: this.enableEmailNotification });
      },
      deep: true,
    },
    assignmentType(val) {
      this.$emit('update:assignmentType', val);
    },
    workflowSteps(val) {
      this.$emit('update:workflowSteps', val);
    },
    workflowStepsAssignment(val) {
      this.$emit('update:workflowStepsAssignment', val);
    },
    template(val) {
      this.$emit('update:template', val);
    },
    workflow(val) {
      this.$emit('update:workflow', val);
    },
    enableEmailNotification(val) {
      this.$emit('update:modalValue', { templateSelection: this.templateSelection, assignmentTypeSelection: this.assignmentTypeSelection, enableEmailNotification: val });
    },
    isValid(val) {
      this.$emit('update:isValid', val);
    },
  },
  mounted() {
    if (this.modalValue) {
      if (this.modalValue.templateSelection) this.templateSelection = { ...this.modalValue.templateSelection };
      if (this.modalValue.assignmentTypeSelection) this.assignmentTypeSelection = { ...this.modalValue.assignmentTypeSelection };
      if (this.modalValue.enableEmailNotification !== undefined) this.enableEmailNotification = this.modalValue.enableEmailNotification;
    }
  },
  methods: {
    getStepTypeName(stepType) {
      if (stepType === 1) return this.$t("dashboard.study.annotator");
      if (stepType === 2) return this.$t("dashboard.study.editor");
      return this.$t("common.unknown");
    },
    reset() {
      this.templateSelection = {};
      this.assignmentTypeSelection = {};
      this.enableEmailNotification = false;
    },
  },
};
</script>

<style scoped>
.list-group-item {
  cursor: default;
}

.list-group-item:hover {
  background-color: transparent;
}
</style>
