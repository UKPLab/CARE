<template>
  <BasicModal ref="overviewModal" :name="modalName" size="lg">
    <template #title>
      {{ config.title }}
    </template>
    <template #body>
      <div v-if="isLoading" class="text-center py-4 text-muted" role="status">
        <div class="spinner-border" />
        <div class="small mt-2">
          Loading...
        </div>
      </div>
      <div v-else-if="loadError" class="alert alert-danger mb-0">
        {{ loadError }}
      </div>
      <template v-else-if="meta && row">
        <dl class="row mb-3 small">
          <template v-for="item in detailRows" :key="item.key">
            <dt class="col-sm-3">
              {{ item.label }}
            </dt>
            <dd class="col-sm-9 text-break">
              <span v-if="item.type === 'badge'" class="badge" :class="item.class">
                {{ item.value }}
              </span>
              <code v-else-if="item.type === 'code'">{{ item.value }}</code>
              <ol v-else-if="item.type === 'list'" class="mb-0 ps-3">
                <li v-for="(entry, index) in item.value" :key="`${item.key}-${index}`">
                  {{ entry }}
                </li>
              </ol>
              <span v-else>{{ item.value }}</span>
            </dd>
          </template>
        </dl>
        <pre
          v-if="meta.isOwner && additionalParametersJson"
          class="bg-light border rounded p-2 small text-break mb-3"
        >{{ additionalParametersJson }}</pre>

        <div v-if="meta.viewerShare" class="alert alert-info py-2 small mb-3">
          Shared access expires {{ formatDateTime(meta.viewerShare.expiryDate) }}.
        </div>

        <template v-if="meta.isOwner">
          <h6 class="text-muted text-uppercase small mb-2">
            Shared with (active)
          </h6>
          <BasicTable
            :columns="shareColumns"
            :data="shareRows"
            :options="shareTableOptions"
            :max-table-height="300"
          />
          <ul v-if="resourceType === 'model' && meta.shareRecipients.length" class="list-unstyled small mt-2 mb-0">
            <li
              v-for="recipient in meta.shareRecipients"
              :key="recipient.id"
              class="d-flex align-items-center justify-content-between py-1 border-bottom"
            >
              <span>
                {{ recipient.recipientLabel || "—" }}
                <span v-if="recipient.costLimit != null" class="text-muted ms-2">(cap ${{ Number(recipient.costLimit).toFixed(2) }})</span>
                <span class="text-muted ms-2">· reset {{ recipient.resetAt ? formatDateTime(recipient.resetAt) : "never" }}</span>
              </span>
              <button
                class="btn btn-sm btn-outline-warning"
                type="button"
                title="Reset budget window for this share"
                :disabled="resettingId === recipient.id"
                @click="onResetShare(recipient)"
              >
                <i class="bi bi-arrow-counterclockwise" />
              </button>
            </li>
          </ul>
        </template>
      </template>
    </template>
    <template #footer>
      <BasicButton
        title="Close"
        class="btn btn-secondary"
        @click="$refs.overviewModal.close()"
      />
    </template>
  </BasicModal>
  <ConfirmModal ref="confirmModal" />
</template>

<script>
/**
 * Modal overview differentiating organizers vs delegated viewers pulling server-side ACL metadata only.
 *
 * @author Akash Gundapuneni
 */

import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

const RESOURCE_CONFIGS = {
  model: {
    title: "AI model overview",
    modalName: "aiModelOverviewModal",
    command: "getModelOverview",
    idKey: "aiModelId",
    invalidMessage: "Invalid model",
    loadErrorMessage: "Failed to load overview",
    details(row, meta, helpers) {
      return [
        { key: "name", label: "Name", value: row.name },
        { key: "provider", label: "Provider", value: row.provider },
        { key: "model", label: "Model ID", value: row.model, type: "code" },
        {
          key: "status",
          label: "Status",
          value: row.enabled ? "Enabled" : "Disabled",
          type: "badge",
          class: row.enabled ? "bg-success" : "bg-secondary",
        },
        { key: "credential", label: "Credential", value: row.credentialName, visible: meta.isOwner && !!row.credentialName },
        { key: "updated", label: "Updated", value: helpers.formatDateTime(row.updatedAt) },
        { key: "description", label: "Description", value: row.description, visible: !!row.description },
      ];
    },
  },
  hook: {
    title: "AI hook overview",
    modalName: "aiHookOverviewModal",
    command: "getHookOverview",
    idKey: "aiHookId",
    invalidMessage: "Invalid AI hook",
    loadErrorMessage: "Failed to load hook overview",
    details(row, _meta, helpers) {
      return [
        { key: "name", label: "Name", value: row.name },
        { key: "description", label: "Description", value: row.description },
        { key: "template", label: "Prompt Template", value: row.templateName },
        { key: "models", label: "Models", value: (row.models || []).map((model) => model.name), type: "list" },
        { key: "output", label: "Output Type", value: row.outputLabel },
        { key: "status", label: "Status", value: row.statusLabel },
        { key: "created", label: "Created", value: helpers.formatDateTime(row.createdAt) },
        { key: "updated", label: "Updated", value: helpers.formatDateTime(row.updatedAt) },
      ];
    },
  },
};

export default {
  name: "AIOverview",
  components: { BasicModal, BasicButton, BasicTable, ConfirmModal },
  props: {
    resourceType: {
      type: String,
      default: "model",
      validator: (value) => Object.keys(RESOURCE_CONFIGS).includes(value),
    },
  },
  data() {
    return {
      isLoading: false,
      row: null,
      meta: null,
      loadError: null,
      resettingId: null,
      shareTableOptions: {
        striped: true,
        hover: true,
      },
      shareColumns: [
        { name: "Name", key: "recipientLabel", sortable: true },
        { name: "Access", key: "accessLabel", sortable: true },
        { name: "Expires", key: "expiryLabel", sortable: true },
      ],
    };
  },
  computed: {
    config() {
      return RESOURCE_CONFIGS[this.resourceType] || RESOURCE_CONFIGS.model;
    },
    modalName() {
      return this.config.modalName;
    },
    detailRows() {
      if (!this.row || !this.meta) return [];
      const helpers = { formatDateTime: this.formatDateTime };
      return this.config.details(this.row, this.meta, helpers)
        .filter((item) => item.visible !== false)
        .map((item) => ({
          ...item,
          value: this.normalizeDetailValue(item),
        }))
        .filter((item) => item.type === "list" || item.value !== "");
    },
    shareRows() {
      return (this.meta?.shareRecipients || []).map((recipient, index) => ({
        id: index + 1,
        recipientLabel: recipient.recipientLabel || "-",
        accessLabel: this.formatAccess(recipient),
        expiryLabel: this.formatDateTime(recipient.expiryDate),
      }));
    },
    additionalParametersJson() {
      const ap = this.resourceType === "model" ? this.row?.additionalParameters : null;
      if (!ap || typeof ap !== "object" || !Object.keys(ap).length) return "";
      try {
        return JSON.stringify(ap, null, 2);
      } catch (_error) {
        return "";
      }
    },
  },
  methods: {
    normalizeDetailValue(item) {
      if (item.type === "list") {
        return Array.isArray(item.value) && item.value.length > 0 ? item.value : ["-"];
      }
      return item.value || "-";
    },
    formatAccess(row) {
      if (row.accessVia === "role") return row.viaLabel ? `Role: ${row.viaLabel}` : "Role";
      return "User";
    },
    formatDateTime(value) {
      if (!value) return "-";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
    },
    emitAi(command, data = {}) {
      return new Promise((resolve, reject) => {
        this.$socket.emit("serviceCommand", { service: "AIService", command, data }, (result) => {
          if (result?.success) resolve(result.data);
          else reject(new Error(result?.message || "Request failed"));
        });
      });
    },
    onResetShare(recipient) {
      this.$refs.confirmModal.open(
        "Reset Share Budget",
        `Reset the budget window for ${recipient.recipientLabel || "this recipient"}?`,
        "",
        async (confirmed) => {
          if (!confirmed) return;
          this.resettingId = recipient.id;
          try {
            await this.emitAi("resetShareBudget", { shareId: recipient.id });
            this.eventBus.emit("toast", { title: "Success", message: "Share budget reset", variant: "success" });
            this.meta = await this.emitAi(this.config.command, { [this.config.idKey]: this.row.id });
          } catch (error) {
            this.eventBus.emit("toast", { title: "Error", message: error.message || "Reset failed", variant: "danger" });
          } finally {
            this.resettingId = null;
          }
        }
      );
    },
    async open(row) {
      if (!row?.id) {
        this.eventBus.emit("toast", { title: "Error", message: this.config.invalidMessage, variant: "danger" });
        return;
      }
      this.row = row;
      this.meta = null;
      this.loadError = null;
      this.isLoading = true;
      this.$refs.overviewModal.open();
      try {
        this.meta = await this.emitAi(this.config.command, { [this.config.idKey]: row.id });
      } catch (error) {
        this.loadError = error.message || this.config.loadErrorMessage;
        this.eventBus.emit("toast", { title: "Error", message: this.loadError, variant: "danger" });
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>
