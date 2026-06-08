<template>
  <BasicModal ref="overviewModal" name="aiModelOverviewModal" size="lg">
    <template #title>
      AI model overview
    </template>
    <template #body>
      <div v-if="isLoading" class="text-center py-4 text-muted" role="status">
        <div class="spinner-border" />
        <div class="small mt-2">
          Loading…
        </div>
      </div>
      <div v-else-if="loadError" class="alert alert-danger mb-0">
        {{ loadError }}
      </div>
      <template v-else-if="meta && modelRow">
        <dl class="row mb-3 small">
          <dt class="col-sm-3">
            Name
          </dt>
          <dd class="col-sm-9">
            {{ modelRow.name || "—" }}
          </dd>
          <dt class="col-sm-3">
            Provider
          </dt>
          <dd class="col-sm-9">
            {{ modelRow.provider || "—" }}
          </dd>
          <dt class="col-sm-3">
            Model ID
          </dt>
          <dd class="col-sm-9">
            <code>{{ modelRow.model || "—" }}</code>
          </dd>
          <dt class="col-sm-3">
            Status
          </dt>
          <dd class="col-sm-9">
            <span class="badge" :class="modelRow.enabled ? 'bg-success' : 'bg-secondary'">
              {{ modelRow.enabled ? "Enabled" : "Disabled" }}
            </span>
          </dd>
          <template v-if="meta.isOwner && modelRow.credentialName">
            <dt class="col-sm-3">
              Credential
            </dt>
            <dd class="col-sm-9">
              {{ modelRow.credentialName }}
            </dd>
          </template>
          <dt class="col-sm-3">
            Updated
          </dt>
          <dd class="col-sm-9">
            {{ formatDateTime(modelRow.updatedAt) }}
          </dd>
          <template v-if="modelRow.description">
            <dt class="col-sm-3">
              Description
            </dt>
            <dd class="col-sm-9 text-break">
              {{ modelRow.description }}
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
          <h6 class="text-muted text-uppercase small">
            Shared with (active)
          </h6>
          <p v-if="!meta.shareRecipients.length" class="text-muted small mb-0">
            No active shares.
          </p>
          <ul v-else class="small mb-0 ps-3">
            <li v-for="(row, index) in meta.shareRecipients" :key="index">
              {{ row.recipientLabel }} — {{ formatAccess(row) }} — {{ formatDateTime(row.expiryDate) }}
            </li>
          </ul>
        </template>
      </template>
    </template>
    <template #footer>
      <button class="btn btn-secondary" type="button" @click="$refs.overviewModal.close()">
        Close
      </button>
    </template>
  </BasicModal>
</template>

<script>
/**
 * Modal overview differentiating organizers vs delegated viewers pulling server-side ACL metadata only.
 *
 * @author Akash Gundapuneni
 */

import BasicModal from "@/basic/Modal.vue";

export default {
  name: "AIOverview",
  components: { BasicModal },
  data() {
    return {
      isLoading: false,
      modelRow: null,
      meta: null,
      loadError: null,
    };
  },
  computed: {
    additionalParametersJson() {
      const ap = this.modelRow?.additionalParameters;
      if (!ap || typeof ap !== "object" || !Object.keys(ap).length) return "";
      try {
        return JSON.stringify(ap, null, 2);
      } catch (_error) {
        return "";
      }
    },
  },
  methods: {
    formatAccess(row) {
      if (row.accessVia === "role") return row.viaLabel ? `role: ${row.viaLabel}` : "role";
      return "direct";
    },
    formatDateTime(value) {
      if (!value) return "—";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
    },
    emitAi(command, data = {}) {
      return new Promise((resolve, reject) => {
        this.$socket.emit("serviceCommand", { service: "AIService", command, data }, (result) => {
          if (result?.success) resolve(result.data);
          else reject(new Error(result?.message || "Request failed"));
        });
      });
    },
    async open(row) {
      if (!row?.id) {
        this.eventBus.emit("toast", { title: "Error", message: "Invalid model", variant: "danger" });
        return;
      }
      this.modelRow = row;
      this.meta = null;
      this.loadError = null;
      this.isLoading = true;
      this.$refs.overviewModal.open();
      try {
        this.meta = await this.emitAi("getModelOverview", { aiModelId: row.id });
      } catch (error) {
        this.loadError = error.message || "Failed to load overview";
        this.eventBus.emit("toast", { title: "Error", message: this.loadError, variant: "danger" });
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>
