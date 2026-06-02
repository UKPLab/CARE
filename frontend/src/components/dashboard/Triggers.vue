<template>
  <Card title="Triggers">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        text="Create trigger"
        title="Create a new trigger rule"
        icon="plus"
        @click="openCreate"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="triggers"
        :options="tableOptions"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
      />
    </template>
  </Card>

  <TriggerStepperModal ref="triggerStepper" />
  <ConfirmModal ref="deleteModal" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import TriggerStepperModal from "./triggers/TriggerStepperModal.vue";

export default {
  name: "DashboardTriggers",
  subscribeTable: ["trigger", "trigger_event", "trigger_action"],
  components: {
    Card,
    BasicTable,
    BasicButton,
    ConfirmModal,
    TriggerStepperModal,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
      },
      columns: [
        { name: "Name", key: "name" },
        { name: "Event", key: "eventLabel" },
        { name: "Action", key: "actionLabel" },
        { name: "Enabled", key: "enabled", type: "toggle" },
      ],
      manageActions: [
        {
          icon: "eye",
          title: "View trigger",
          action: "view",
          handler: "viewModal",
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "pencil-square",
          title: "Edit trigger",
          action: "edit",
          handler: "editStepper",
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
        },
        {
          icon: "trash",
          title: "Delete trigger",
          action: "delete",
          handler: "confirmDelete",
          socketEvent: "triggerDelete",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
          confirm: {
            title: "Delete Trigger",
            message: 'Are you sure you want to delete "{name}"?',
          },
        },
      ],
      enabledToggle: {
        title: "Enable / disable trigger",
        action: "toggleEnabled",
        socketEvent: "triggerUpdate",
      },
    };
  },
  computed: {
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    buttons() {
      return this.manageActions.map(
        ({ handler, socketEvent, confirm, ...btn }) => btn
      );
    },
    manageActionsByAction() {
      return Object.fromEntries(this.manageActions.map((a) => [a.action, a]));
    },
    triggers() {
      const eventsById = Object.fromEntries(
        this.$store.getters["table/trigger_event/getAll"]
          .filter((e) => e.enabled && !e.deleted)
          .map((e) => [e.id, e])
      );
      const actionsById = Object.fromEntries(
        this.$store.getters["table/trigger_action/getAll"]
          .filter((a) => a.enabled && !a.deleted)
          .map((a) => [a.id, a])
      );
      return this.$store.getters["table/trigger/getAll"]
        .filter((t) => !t.deleted)
        .map((t) => {
          const event = eventsById[t.triggerEventId];
          const action = actionsById[t.triggerActionId];
          return {
            ...t,
            eventLabel: event?.configuration?.label || event?.name || "-",
            actionLabel: action?.configuration?.label || action?.name || "-",
            enabled: {
              title: this.enabledToggle.title,
              value: t.enabled,
              action: this.enabledToggle.action,
            },
          };
        });
    },
  },
  methods: {
    openCreate() {
      this.$refs.triggerStepper.openCreate(this.projectId);
    },
    onAction(data) {
      const row = data.params;

      if (data.action === this.enabledToggle.action) {
        this.$socket.emit(this.enabledToggle.socketEvent, { id: row.id, enabled: data.value });
        return;
      }

      const actionDef = this.manageActionsByAction[data.action];

      if (actionDef.handler === "viewModal") {
        this.$refs.triggerStepper.openView(row);
        return;
      }

      if (actionDef.handler === "editStepper") {
        this.$refs.triggerStepper.openEdit(row);
        return;
      }

      if (actionDef.handler === "confirmDelete") {
        const { confirm } = actionDef;
        this.$refs.deleteModal.open(
          confirm.title,
          confirm.message.replace("{name}", row.name),
          null,
          (ok) => {
            if (ok) {
              this.$socket.emit(actionDef.socketEvent, { id: row.id });
            }
          }
        );
      }
    },
  },
};
</script>
