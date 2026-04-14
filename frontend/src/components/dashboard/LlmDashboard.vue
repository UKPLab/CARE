<template>
  <div>
    <Card title="LLM Credentials" class="mb-3">
      <template #headerElements>
        <div class="btn-group gap-2 ms-3">
          <BasicButton
            class="btn-primary btn-sm"
            title="Add Credential"
            text="Add Credential"
            icon="plus-circle"
            @click="openAddCredentialModal"
          />
        </div>
      </template>
      <template #body>
        <div v-if="myCredentials.length === 0" class="text-center text-muted py-3">
          No credentials yet. Add one to connect to your LLM provider.
        </div>
        <BasicTable
          v-else
          :columns="credentialColumns"
          :data="credentialTableData"
          :options="compactTableOptions"
          :buttons="credentialButtons"
          @action="handleCredentialAction"
        />
      </template>
    </Card>

    <Card title="Shared Credentials" class="mb-3">
      <template #body>
        <div v-if="allShares.length === 0" class="text-center text-muted py-3">
          No credential shares available.
        </div>
        <BasicTable
          v-else
          :columns="allSharesColumns"
          :data="allSharesTableData"
          :options="compactTableOptions"
          :buttons="allSharesButtons"
          @action="handleAllSharesAction"
        />
      </template>
    </Card>

    <Card title="Enabled Model Catalog" class="mb-3">
      <template #body>
        <div v-if="enabledModels.length === 0" class="text-center text-muted py-3">
          No enabled models available.
        </div>
        <BasicTable
          v-else
          :columns="modelColumns"
          :data="modelTableData"
          :options="compactTableOptions"
        />
      </template>
    </Card>

    <Card title="LLM Usage Log (Optional)">
      <template #body>
        <div v-if="usageLogs.length === 0" class="text-center text-muted py-4">
          No usage logs found or backend logging is not enabled yet.
        </div>
        <BasicTable
          v-else
          :columns="logColumns"
          :data="usageLogTableData"
          :options="compactTableOptions"
          :buttons="logButtons"
          @action="handleLogAction"
        />
      </template>
    </Card>

    <Modal ref="credentialModal" name="llmCredentialModal" size="lg">
      <template #title>
        {{ editingCredential ? "Edit Credential" : "Add Credential" }}
      </template>
      <template #body>
        <div class="mb-3">
          <label class="form-label fw-bold">Provider</label>
          <input
            v-model="credentialForm.provider"
            type="text"
            class="form-control"
            placeholder="openai, azure, anthropic, ollama, openrouter..."
          />
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Name</label>
          <input v-model="credentialForm.name" type="text" class="form-control" placeholder="e.g. My Azure Key" />
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">API Key</label>
          <input
            v-model="credentialForm.apiKey"
            type="password"
            class="form-control"
            :placeholder="editingCredential ? 'Leave blank to keep existing' : 'Enter API key'"
          />
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">API Base URL (optional)</label>
          <input v-model="credentialForm.apiBaseUrl" type="text" class="form-control" placeholder="https://.../v1 or Azure endpoint" />
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">API Version (optional)</label>
          <input v-model="credentialForm.apiVersion" type="text" class="form-control" placeholder="e.g. 2024-02-01" />
        </div>
        <div class="form-check mb-3">
          <input v-model="credentialForm.enabled" class="form-check-input" type="checkbox" id="credentialEnabled" />
          <label class="form-check-label" for="credentialEnabled">Enabled</label>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Additional Parameters (JSON)</label>
          <textarea
            v-model="credentialForm.additionalParametersText"
            class="form-control font-monospace"
            rows="4"
            placeholder='{"timeout":120000,"extra_headers":{"x-tenant":"acme"}}'
          ></textarea>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.credentialModal.close()">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="!isCredentialFormValid" @click="saveCredential">
          {{ editingCredential ? "Update" : "Add" }}
        </button>
      </template>
    </Modal>

    <Modal ref="shareModal" name="credentialShareModal" size="lg">
      <template #title>
        Manage Credential Shares
      </template>
      <template #body>
        <div v-if="selectedCredentialForSharing" class="mb-3">
          <strong>Credential:</strong> {{ selectedCredentialForSharing.name }}
        </div>
        <div class="row g-2 mb-3">
          <div class="col-md-3">
            <label class="form-label fw-bold">Share With</label>
            <select v-model="shareForm.targetType" class="form-select">
              <option value="user">User</option>
              <option value="study">Study</option>
            </select>
          </div>
          <div class="col-md-5">
            <label class="form-label fw-bold">{{ shareForm.targetType === "user" ? "User" : "Study" }}</label>
            <select v-model="shareForm.targetId" class="form-select">
              <option :value="null">Select...</option>
              <option v-for="option in shareTargetOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold">Expiry Date</label>
            <input v-model="shareForm.expiryDate" type="datetime-local" class="form-control" />
          </div>
        </div>
        <div class="d-flex justify-content-end mb-3">
          <button class="btn btn-primary btn-sm" :disabled="!canCreateShare" @click="addShare">Add Share</button>
        </div>

        <div v-if="sharesForSelectedCredential.length === 0" class="text-center text-muted py-3">
          No shares yet.
        </div>
        <BasicTable
          v-else
          :columns="shareColumns"
          :data="shareTableData"
          :options="compactTableOptions"
          :buttons="shareButtons"
          @action="handleShareAction"
        />
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.shareModal.close()">Close</button>
      </template>
    </Modal>

    <Modal ref="detailModal" name="usageDetailModal" size="xl">
      <template #title>LLM Usage Detail</template>
      <template #body>
        <div v-if="selectedLog" class="row">
          <div class="col-md-6">
            <h6 class="text-secondary">Metadata</h6>
            <table class="table table-sm">
              <tbody>
                <tr><td class="fw-bold">Status</td><td>{{ selectedLog.status || "-" }}</td></tr>
                <tr><td class="fw-bold">Input Tokens</td><td>{{ selectedLog.inputTokens || 0 }}</td></tr>
                <tr><td class="fw-bold">Output Tokens</td><td>{{ selectedLog.outputTokens || 0 }}</td></tr>
                <tr><td class="fw-bold">Total Tokens</td><td>{{ selectedLog.total_tokens || 0 }}</td></tr>
                <tr><td class="fw-bold">Costs</td><td>{{ selectedLog.costs || 0 }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="col-md-6">
            <h6 class="text-secondary">Input</h6>
            <pre class="border rounded p-2 bg-light usage-pre">{{ formatJson(selectedLog.input) }}</pre>
            <h6 class="text-secondary mt-3">Output</h6>
            <pre class="border rounded p-2 bg-light usage-pre">{{ formatJson(selectedLog.output) }}</pre>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.detailModal.close()">Close</button>
      </template>
    </Modal>
  </div>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Modal from "@/basic/Modal.vue";

export default {
  name: "LlmDashboard",
  components: {Card, BasicTable, BasicButton, Modal},
  subscribeTable: ["llm_credential", "llm_credential_share", "llm_model", "llm_log", "user", "study"],
  data() {
    return {
      editingCredential: null,
      selectedCredentialForSharing: null,
      selectedLog: null,
      credentialForm: this.getEmptyCredentialForm(),
      shareForm: this.getEmptyShareForm(),
      compactTableOptions: {
        striped: true,
        hover: true,
        small: true,
        pagination: 10,
      },
      credentialColumns: [
        {name: "Name", key: "name"},
        {name: "Provider", key: "provider"},
        {name: "API Base URL", key: "apiBaseUrlDisplay"},
        {name: "API Version", key: "apiVersionDisplay"},
        {name: "Enabled", key: "enabledBadge", type: "badge", typeOptions: {keyMapping: {true: "Yes", false: "No"}, classMapping: {true: "bg-success", false: "bg-secondary"}}},
        {name: "Shares", key: "shareCount"},
      ],
      credentialButtons: [
        {icon: "share", options: {iconOnly: true, specifiers: {"btn-outline-primary": true}}, title: "Manage shares", action: "manageShares"},
        {icon: "pencil", options: {iconOnly: true, specifiers: {"btn-outline-secondary": true}}, title: "Edit", action: "editCredential"},
        {icon: "trash", options: {iconOnly: true, specifiers: {"btn-outline-danger": true}}, title: "Delete", action: "deleteCredential"},
      ],
      modelColumns: [
        {name: "Name", key: "name"},
        {name: "LiteLLM Model", key: "model"},
        {name: "Provider", key: "provider"},
        {name: "Defaults", key: "defaultsSummary"},
      ],
      shareColumns: [
        {name: "Type", key: "targetType"},
        {name: "Target", key: "targetName"},
        {name: "Expiry", key: "expiryDisplay"},
      ],
      allSharesColumns: [
        {name: "Credential", key: "credentialName"},
        {name: "Owner", key: "ownerName"},
        {name: "Type", key: "targetType"},
        {name: "Target", key: "targetName"},
        {name: "Expiry", key: "expiryDisplay"},
      ],
      shareButtons: [
        {icon: "trash", options: {iconOnly: true, specifiers: {"btn-outline-danger": true}}, title: "Revoke", action: "revokeShare"},
      ],
      allSharesButtons: [
        {icon: "trash", options: {iconOnly: true, specifiers: {"btn-outline-danger": true}}, title: "Revoke", action: "revokeShareGlobal"},
      ],
      logColumns: [
        {name: "When", key: "createdAtDisplay"},
        {name: "Status", key: "status"},
        {name: "Input Tokens", key: "inputTokens"},
        {name: "Output Tokens", key: "outputTokens"},
        {name: "Total Tokens", key: "total_tokens"},
        {name: "Costs", key: "costs"},
      ],
      logButtons: [
        {icon: "eye", options: {iconOnly: true, specifiers: {"btn-outline-primary": true}}, title: "View details", action: "viewLogDetail"},
      ],
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    allCredentials() {
      return this.$store.getters["table/llm_credential/getAll"] || [];
    },
    myCredentials() {
      return this.allCredentials.filter((c) => c.userId === this.userId);
    },
    allShares() {
      return this.$store.getters["table/llm_credential_share/getAll"] || [];
    },
    allModels() {
      return this.$store.getters["table/llm_model/getAll"] || [];
    },
    enabledModels() {
      return this.allModels.filter((m) => m.enabled !== false);
    },
    usageLogs() {
      return this.$store.getters["table/llm_log/getAll"] || [];
    },
    users() {
      return this.$store.getters["table/user/getAll"] || [];
    },
    studies() {
      return this.$store.getters["table/study/getAll"] || [];
    },
    credentialTableData() {
      return this.myCredentials.map((c) => ({
        ...c,
        apiBaseUrlDisplay: c.apiBaseUrl || "-",
        apiVersionDisplay: c.apiVersion || "-",
        enabledBadge: c.enabled !== false,
        shareCount: this.allShares.filter((s) => s.llmCredentialId === c.id).length,
      }));
    },
    modelTableData() {
      return this.enabledModels.map((m) => ({
        ...m,
        defaultsSummary: this.stringifyJsonShort(m.additionalParameters),
      }));
    },
    usageLogTableData() {
      return this.usageLogs.map((l) => ({
        ...l,
        createdAtDisplay: l.createdAt ? new Date(l.createdAt).toLocaleString() : "-",
      }));
    },
    sharesForSelectedCredential() {
      if (!this.selectedCredentialForSharing) return [];
      return this.allShares.filter((s) => s.llmCredentialId === this.selectedCredentialForSharing.id);
    },
    shareTargetOptions() {
      if (this.shareForm.targetType === "user") {
        return this.users.map((u) => ({id: u.id, name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.userName || `User ${u.id}`}));
      }
      return this.studies.map((s) => ({id: s.id, name: s.name || `Study ${s.id}`}));
    },
    shareTableData() {
      return this.sharesForSelectedCredential.map((share) => {
        const isUserTarget = share.userId != null;
        const targetId = isUserTarget ? share.userId : share.studyId;
        const targetName = isUserTarget ? this.getUserName(targetId) : this.getStudyName(targetId);
        return {
          ...share,
          targetType: isUserTarget ? "User" : "Study",
          targetName,
          expiryDisplay: share.expiryDate ? new Date(share.expiryDate).toLocaleString() : "-",
        };
      });
    },
    allSharesTableData() {
      return this.allShares.map((share) => {
        const credential = this.allCredentials.find((c) => c.id === share.llmCredentialId);
        const isUserTarget = share.userId != null;
        const targetId = isUserTarget ? share.userId : share.studyId;
        return {
          ...share,
          credentialName: credential?.name || `Credential ${share.llmCredentialId}`,
          ownerName: credential ? this.getUserName(credential.userId) : "-",
          targetType: isUserTarget ? "User" : "Study",
          targetName: isUserTarget ? this.getUserName(targetId) : this.getStudyName(targetId),
          expiryDisplay: share.expiryDate ? new Date(share.expiryDate).toLocaleString() : "-",
        };
      });
    },
    isCredentialFormValid() {
      return this.credentialForm.name && this.credentialForm.provider && (this.editingCredential || this.credentialForm.apiKey);
    },
    canCreateShare() {
      return this.selectedCredentialForSharing && this.shareForm.targetId && this.shareForm.expiryDate;
    },
  },
  methods: {
    getEmptyCredentialForm() {
      return {
        name: "",
        provider: "",
        apiKey: "",
        apiBaseUrl: "",
        apiVersion: "",
        enabled: true,
        additionalParametersText: "{}",
      };
    },
    getEmptyShareForm() {
      return {
        targetType: "user",
        targetId: null,
        expiryDate: "",
      };
    },
    stringifyJsonShort(value) {
      if (!value) return "{}";
      let asText = "{}";
      try {
        asText = typeof value === "string" ? value : JSON.stringify(value);
      } catch (_error) {
        asText = "{}";
      }
      return asText.length > 60 ? `${asText.slice(0, 60)}...` : asText;
    },
    parseJsonOrEmpty(value) {
      if (!value || !value.trim()) return {};
      return JSON.parse(value);
    },
    getUserName(id) {
      const user = this.users.find((u) => u.id === id);
      if (!user) return `User ${id}`;
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      return fullName || user.userName || `User ${id}`;
    },
    getStudyName(id) {
      const study = this.studies.find((s) => s.id === id);
      return study ? (study.name || `Study ${id}`) : `Study ${id}`;
    },
    formatJson(value) {
      if (!value) return "-";
      try {
        return typeof value === "string" ? value : JSON.stringify(value, null, 2);
      } catch (_error) {
        return String(value);
      }
    },
    openAddCredentialModal() {
      this.editingCredential = null;
      this.credentialForm = this.getEmptyCredentialForm();
      this.$refs.credentialModal.open();
    },
    handleCredentialAction(data) {
      switch (data.action) {
        case "editCredential":
          this.editingCredential = data.params;
          this.credentialForm = {
            name: data.params.name || "",
            provider: data.params.provider || "",
            apiKey: "",
            apiBaseUrl: data.params.apiBaseUrl || "",
            apiVersion: data.params.apiVersion || "",
            enabled: data.params.enabled !== false,
            additionalParametersText: this.stringifyJsonShort(data.params.additionalParameters),
          };
          this.$refs.credentialModal.open();
          break;
        case "deleteCredential":
          if (confirm(`Delete credential "${data.params.name}"?`)) {
            this.$socket.emit("appDataUpdate", {
              table: "llm_credential",
              data: {id: data.params.id, deleted: true},
            });
          }
          break;
        case "manageShares":
          this.selectedCredentialForSharing = data.params;
          this.shareForm = this.getEmptyShareForm();
          this.$refs.shareModal.open();
          break;
      }
    },
    saveCredential() {
      let additionalParameters = {};
      try {
        additionalParameters = this.parseJsonOrEmpty(this.credentialForm.additionalParametersText);
      } catch (_error) {
        this.eventBus.emit("toast", {title: "Invalid JSON", message: "Please fix additionalParameters JSON.", variant: "danger"});
        return;
      }

      const payload = {
        name: this.credentialForm.name.trim(),
        provider: this.credentialForm.provider.trim(),
        apiBaseUrl: this.credentialForm.apiBaseUrl || null,
        apiVersion: this.credentialForm.apiVersion || null,
        enabled: this.credentialForm.enabled,
        additionalParameters,
      };

      if (this.credentialForm.apiKey) {
        payload.encryptedKey = this.credentialForm.apiKey;
      }

      if (this.editingCredential) {
        this.$socket.emit("appDataUpdate", {
          table: "llm_credential",
          data: {id: this.editingCredential.id, ...payload},
        }, (res) => {
          if (res && res.success === false) {
            this.eventBus.emit("toast", {title: "Error", message: res.message || "Failed to update credential.", variant: "danger"});
            return;
          }
          this.$refs.credentialModal.close();
          this.eventBus.emit("toast", {title: "Credential", message: "Credential updated.", variant: "success"});
        });
      } else {
        this.$socket.emit("appDataUpdate", {
          table: "llm_credential",
          data: payload,
        }, (res) => {
          if (res && res.success === false) {
            this.eventBus.emit("toast", {title: "Error", message: res.message || "Failed to add credential.", variant: "danger"});
            return;
          }
          this.$refs.credentialModal.close();
          this.eventBus.emit("toast", {title: "Credential", message: "Credential added.", variant: "success"});
        });
      }
    },
    addShare() {
      if (!this.canCreateShare) return;
      const payload = {
        llmCredentialId: this.selectedCredentialForSharing.id,
        userId: this.shareForm.targetType === "user" ? this.shareForm.targetId : null,
        studyId: this.shareForm.targetType === "study" ? this.shareForm.targetId : null,
        expiryDate: new Date(this.shareForm.expiryDate).toISOString(),
      };
      this.$socket.emit("appDataUpdate", {table: "llm_credential_share", data: payload}, (res) => {
        if (res && res.success === false) {
          this.eventBus.emit("toast", {title: "Error", message: res.message || "Failed to create share.", variant: "danger"});
          return;
        }
        this.shareForm = this.getEmptyShareForm();
        this.eventBus.emit("toast", {title: "Share", message: "Credential share created.", variant: "success"});
      });
    },
    handleShareAction(data) {
      if (data.action !== "revokeShare") return;
      if (!confirm("Revoke this share?")) return;
      this.$socket.emit("appDataUpdate", {
        table: "llm_credential_share",
        data: {id: data.params.id, deleted: true},
      }, (res) => {
        if (res && res.success === false) {
          this.eventBus.emit("toast", {title: "Error", message: res.message || "Failed to revoke share.", variant: "danger"});
          return;
        }
        this.eventBus.emit("toast", {title: "Share", message: "Share revoked.", variant: "success"});
      });
    },
    handleAllSharesAction(data) {
      if (data.action !== "revokeShareGlobal") return;
      if (!confirm("Revoke this share?")) return;
      this.$socket.emit("appDataUpdate", {
        table: "llm_credential_share",
        data: {id: data.params.id, deleted: true},
      }, (res) => {
        if (res && res.success === false) {
          this.eventBus.emit("toast", {title: "Error", message: res.message || "Failed to revoke share.", variant: "danger"});
          return;
        }
        this.eventBus.emit("toast", {title: "Share", message: "Share revoked.", variant: "success"});
      });
    },
    handleLogAction(data) {
      if (data.action !== "viewLogDetail") return;
      this.selectedLog = data.params;
      this.$refs.detailModal.open();
    },
  },
};
</script>

<style scoped>
.font-monospace {
  font-family: 'Courier New', Courier, monospace;
}

.usage-pre {
  max-height: 240px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 0.85em;
}
</style>
