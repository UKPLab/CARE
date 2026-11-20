<template>
  <DashboardListPage
    :title="$t('triggers.dashboard.title')"
    :columns="columns"
    :data="triggers"
    :buttons="buttons"
    @action="onAction"
  >
    <template #headerActions>
      <BasicButton
        class="btn-primary btn-sm"
        :text="$t('triggers.dashboard.create')"
        :title="$t('triggers.dashboard.createTitle')"
        icon="plus"
        @click="openCreate"
      />
    </template>
  </DashboardListPage>

  <TriggerStepperModal ref="triggerStepper" />
  <TriggerViewModal ref="triggerView" />
  <ConfirmModal ref="deleteModal" />
</template>

<script>
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import TriggerStepperModal from "./triggers/TriggerStepperModal.vue";
import TriggerViewModal from "./triggers/TriggerViewModal.vue";
import { translateMaybeKey } from "@/assets/utils";

export default {
  name: "DashboardTriggers",
  subscribeTable: ["trigger", "trigger_event", "trigger_action"],
  components: {
    DashboardListPage,
    BasicButton,
    ConfirmModal,
    TriggerStepperModal,
    TriggerViewModal,
  },
  computed: {
    columns() {
      return [
        { name: this.$t("triggers.common.name"), key: "name" },
        { name: this.$t("triggers.common.event"), key: "eventLabel" },
        { name: this.$t("triggers.common.action"), key: "actionLabel" },
        { name: this.$t("triggers.common.enabled"), key: "enabled", type: "toggle" },
      ];
    },
    manageActions() {
      return [
        dashboardRowAction("view", {
          title: this.$t("triggers.actions.view"),
          action: "view",
          handler: "viewModal",
        }),
        dashboardRowAction("edit", {
          title: this.$t("triggers.actions.edit"),
          action: "edit",
          handler: "editStepper",
        }),
        dashboardRowAction("delete", {
          title: this.$t("triggers.actions.delete"),
          action: "delete",
          handler: "confirmDelete",
          socketEvent: "triggerDelete",
          confirm: {
            title: this.$t("triggers.confirm.deleteTitle"),
            message: this.$t("triggers.confirm.delete", { name: "{name}" }),
          },
        }),
      ];
    },
    enabledToggle() {
      return {
        title: this.$t("triggers.actions.toggle"),
        action: "toggleEnabled",
        socketEvent: "triggerUpdate",
      };
    },
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
        .filter((t) => !t.deleted && (this.projectId == null || Number(t.projectId) === Number(this.projectId)))
        .map((t) => {
          const event = eventsById[t.triggerEventId];
          const action = actionsById[t.triggerActionId];
          return {
            ...t,
            eventLabel: translateMaybeKey(event?.configuration?.label || event?.name || "-"),
            actionLabel: translateMaybeKey(action?.configuration?.label || action?.name || "-"),
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
        this.$refs.triggerView.open(row);
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
