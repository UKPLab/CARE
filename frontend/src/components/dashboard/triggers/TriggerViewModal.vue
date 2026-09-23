<template>
  <BasicModal
    ref="modal"
    name="trigger-view"
    size="lg"
  >
    <template #title>
      {{ trigger ? $t("triggers.view.namedTitle", { name: trigger.name }) : $t("triggers.common.trigger") }}
    </template>
    <template #body>
      <BasicDetails v-if="trigger" :items="detailRows">
        <pre
          v-if="configurationJson"
          class="bg-light border rounded p-2 small text-break mb-0"
        >{{ configurationJson }}</pre>
      </BasicDetails>
    </template>
    <template #footer>
      <BasicButton
        :title="$t('triggers.common.close')"
        class="btn btn-secondary"
        @click="$refs.modal.close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicDetails from "@/basic/Details.vue";
import { translateMaybeKey } from "@/assets/utils";

export default {
  name: "TriggerViewModal",
  components: { BasicModal, BasicButton, BasicDetails },
  data() {
    return { trigger: null };
  },
  computed: {
    detailRows() {
      if (!this.trigger) return [];
      const t = this.trigger;
      return [
        { key: "description", label: this.$t("triggers.common.description"), value: t.description || "-" },
        {
          key: "status",
          label: this.$t("triggers.common.status"),
          value: t.enabled ? this.$t("triggers.status.enabled") : this.$t("triggers.status.disabled"),
          type: "badge",
          class: t.enabled ? "bg-success" : "bg-secondary",
        },
        { key: "event", label: this.$t("triggers.common.event"), value: t.eventLabel },
        { key: "action", label: this.$t("triggers.common.action"), value: t.actionLabel },
        { key: "project", label: this.$t("triggers.common.project"), value: t.projectLabel },
        { key: "maxRetries", label: this.$t("triggers.fields.maxRetries"), value: t.maxRetries },
        { key: "parallelLimit", label: this.$t("triggers.fields.parallelLimit"), value: t.parallelLimit },
        { key: "timeout", label: this.$t("triggers.fields.timeout"), value: this.$t("triggers.view.seconds", { count: t.timeout }) },
      ];
    },
    configurationJson() {
      const configuration = this.trigger?.configuration;
      if (!configuration || !Object.keys(configuration).length) return "";
      try {
        return JSON.stringify(configuration, null, 2);
      } catch (_error) {
        return "";
      }
    },
  },
  methods: {
    catalogItem(table, id) {
      return id == null ? null : this.$store.getters[`table/${table}/get`](Number(id));
    },
    open(row) {
      const event = this.catalogItem("trigger_event", row.triggerEventId);
      const action = this.catalogItem("trigger_action", row.triggerActionId);
      const configuration = row.configuration || {};
      const project = this.catalogItem("project", row.projectId);

      this.trigger = {
        name: row.name,
        description: configuration.description || "",
        enabled: row.enabled?.value ?? row.enabled,
        eventLabel: translateMaybeKey(row.eventLabel || event?.configuration?.label || event?.name || "-"),
        actionLabel: translateMaybeKey(row.actionLabel || action?.configuration?.label || action?.name || "-"),
        projectLabel: project?.name || (row.projectId == null ? "-" : `#${row.projectId}`),
        maxRetries: row.maxRetries ?? "-",
        parallelLimit: row.parallelLimit ?? "-",
        timeout: row.timeout ?? "-",
        configuration: {
          ...(configuration.event && Object.keys(configuration.event).length
            ? { event: configuration.event }
            : {}),
          ...(configuration.action && Object.keys(configuration.action).length
            ? { action: configuration.action }
            : {}),
        },
      };
      this.$refs.modal.open();
    },
  },
};
</script>
