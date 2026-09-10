<template>
  <BasicModal
    ref="modal"
    name="trigger-view"
    size="lg"
  >
    <template #title>
      {{ trigger ? `Trigger: ${trigger.name}` : "Trigger" }}
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
        title="Close"
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
        { key: "description", label: "Description", value: t.description || "-" },
        {
          key: "status",
          label: "Status",
          value: t.enabled ? "Enabled" : "Disabled",
          type: "badge",
          class: t.enabled ? "bg-success" : "bg-secondary",
        },
        { key: "event", label: "Event", value: t.eventLabel },
        { key: "action", label: "Action", value: t.actionLabel },
        { key: "project", label: "Project", value: t.projectLabel },
        { key: "maxRetries", label: "Max retries", value: t.maxRetries },
        { key: "parallelLimit", label: "Parallel limit", value: t.parallelLimit },
        { key: "timeout", label: "Timeout", value: `${t.timeout} seconds` },
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
        eventLabel: row.eventLabel || event?.configuration?.label || event?.name || "-",
        actionLabel: row.actionLabel || action?.configuration?.label || action?.name || "-",
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
