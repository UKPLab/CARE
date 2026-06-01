<template>
  <Card title="Triggers">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        text="Create trigger"
        title="Create a new trigger rule"
        icon="plus"
        @click="$refs.triggerStepper.open()"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="triggers"
        :options="options"
        :max-table-height="'65vh'"
      />
    </template>
  </Card>

  <StepperModal
    ref="triggerStepper"
    size="lg"
    :steps="steps"
    submit-text="Save"
    @submit="onTriggerSaved"
  >
    <template #title>
      <h5 class="modal-title">Create trigger</h5>
    </template>
    <template #step-1>
      <BasicForm
        v-model="triggerForm"
        :fields="eventFields"
      />
    </template>
    <template #step-2>
      <BasicForm
        v-model="triggerForm"
        :fields="actionFields"
      />
    </template>
    <template #step-3>
      <BasicForm
        v-model="triggerForm"
        :fields="summaryFields"
      />
    </template>
  </StepperModal>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";

export default {
  name: "DashboardTriggers",
  components: {
    Card,
    BasicTable,
    BasicButton,
    StepperModal,
    BasicForm,
  },
  data() {
    return {
      options: {
        striped: true,
        hover: true,
        pagination: 10,
      },
      columns: [
        { name: "Name", key: "name" },
        { name: "Event", key: "event" },
        { name: "Action", key: "action" },
        { name: "Enabled", key: "enabled", type: "badge" },
      ],
      triggers: [],
      steps: [
        { title: "Event" },
        { title: "Action" },
        { title: "Confirm" },
      ],
      triggerForm: {
        name: "",
        event: "",
        action: "",
        enabled: true,
      },
      eventFields: [
        { name: "name", label: "Trigger name", type: "text", required: true },
        { name: "event", label: "When (event)", type: "text", required: true },
      ],
      actionFields: [
        { name: "action", label: "Then (action)", type: "text", required: true },
      ],
      summaryFields: [
        { name: "enabled", label: "Enabled", type: "checkbox" },
      ],
    };
  },
  methods: {
    onTriggerSaved() {
      this.$refs.triggerStepper.close();
    },
  },
};
</script>
