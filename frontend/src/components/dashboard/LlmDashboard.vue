<template>
  <div>
    <!-- ============ USAGE STATS CARDS ============ -->
    <div class="row g-3 mb-3">
      <div class="col-md-3">
        <div class="card text-center">
          <div class="card-body py-2">
            <h6 class="card-subtitle mb-1 text-muted">Total Requests</h6>
            <h3 class="card-title mb-0">{{ statsDisplay.totalRequests }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center">
          <div class="card-body py-2">
            <h6 class="card-subtitle mb-1 text-muted">Input Tokens</h6>
            <h3 class="card-title mb-0">{{ formatNumber(statsDisplay.totalInputTokens) }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center">
          <div class="card-body py-2">
            <h6 class="card-subtitle mb-1 text-muted">Output Tokens</h6>
            <h3 class="card-title mb-0">{{ formatNumber(statsDisplay.totalOutputTokens) }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center">
          <div class="card-body py-2">
            <h6 class="card-subtitle mb-1 text-muted">Est. Cost (30d)</h6>
            <h3 class="card-title mb-0">${{ statsDisplay.totalCost }}</h3>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ API KEYS SECTION ============ -->
    <Card title="API Keys" :collapsable="true" :collapsed="true" class="mb-3">
      <template #headerElements>
        <span v-if="!waitForStatus" class="badge" :class="llmOnline ? 'bg-success' : 'bg-danger'">
          {{ llmOnline ? "ONLINE" : "OFFLINE" }}
        </span>
        <div v-else class="spinner-grow" role="status" style="width:12px; height:12px">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="btn-group gap-2 ms-3">
          <BasicButton
            class="btn-primary btn-sm"
            title="Add API Key"
            text="Add Key"
            icon="plus-circle"
            @click="openAddKeyModal"
          />
        </div>
      </template>
      <template #body>
        <div v-if="keys.length === 0" class="text-center text-muted py-3">
          No API keys yet. Add one to start using LLM models.
        </div>
        <BasicTable
          v-else
          :columns="keyColumns"
          :data="keyTableData"
          :options="compactTableOptions"
          :buttons="keyButtons"
          @action="handleKeyAction"
        />
      </template>
    </Card>

    <!-- ============ PROMPT TEMPLATES SECTION ============ -->
    <Card title="Prompt Templates" :collapsable="true" :collapsed="true" class="mb-3">
      <template #headerElements>
        <div class="btn-group gap-2 ms-3">
          <BasicButton
            class="btn-primary btn-sm"
            title="New Template"
            text="New Template"
            icon="plus-circle"
            @click="openAddTemplateModal"
          />
        </div>
      </template>
      <template #body>
        <div v-if="templates.length === 0" class="text-center text-muted py-3">
          No prompt templates yet. Create one to define what the LLM should do.
        </div>
        <BasicTable
          v-else
          :columns="templateColumns"
          :data="templateTableData"
          :options="compactTableOptions"
          :buttons="templateButtons"
          @action="handleTemplateAction"
        />
      </template>
    </Card>

    <!-- ============ PROVIDER COST BREAKDOWN ============ -->
    <Card title="Cost by Provider" :collapsable="true" :collapsed="true" class="mb-3">
      <template #body>
        <div v-if="providerStats.length === 0" class="text-muted text-center py-3">
          No usage data yet.
        </div>
        <table v-else class="table table-sm table-striped mb-0">
          <thead>
            <tr>
              <th>Provider</th>
              <th class="text-end">Requests</th>
              <th class="text-end">Input Tokens</th>
              <th class="text-end">Output Tokens</th>
              <th class="text-end">Est. Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ps in providerStats" :key="ps.provider">
              <td>{{ ps.provider }}</td>
              <td class="text-end">{{ formatNumber(ps.requests) }}</td>
              <td class="text-end">{{ formatNumber(ps.inputTokens) }}</td>
              <td class="text-end">{{ formatNumber(ps.outputTokens) }}</td>
              <td class="text-end">${{ Number(ps.cost || 0).toFixed(6) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </Card>

    <!-- ============ USAGE LOG TABLE ============ -->
    <Card title="Request Log">
      <template #headerElements>
        <div class="btn-group gap-2 ms-3">
          <BasicButton
            class="btn-outline-secondary btn-sm"
            title="Export CSV"
            text="Export CSV"
            icon="download"
            :disabled="logs.length === 0"
            @click="exportCsv"
          />
          <BasicButton
            class="btn-outline-secondary btn-sm"
            title="Refresh"
            text="Refresh"
            icon="arrow-clockwise"
            @click="loadAll"
          />
        </div>
      </template>
      <template #body>
        <div class="row g-2 mb-3">
          <div class="col-md-3">
            <select v-model="filterProvider" class="form-select form-select-sm" @change="loadLogs">
              <option value="">All Providers</option>
              <option v-for="p in providers" :key="p.slug" :value="p.slug">{{ p.name }}</option>
            </select>
          </div>
          <div class="col-md-3">
            <select v-model="filterStatus" class="form-select form-select-sm" @change="loadLogs">
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
            </select>
          </div>
          <div class="col-md-3">
            <select v-model="filterDays" class="form-select form-select-sm" @change="loadAll">
              <option :value="7">Last 7 days</option>
              <option :value="30">Last 30 days</option>
              <option :value="90">Last 90 days</option>
              <option :value="365">Last year</option>
            </select>
          </div>
        </div>

        <div v-if="logs.length === 0" class="text-center text-muted py-4">
          No log entries found.
        </div>
        <BasicTable
          v-else
          :columns="logColumns"
          :data="logTableData"
          :options="logTableOptions"
          :count="logCount"
          :buttons="logButtons"
          @action="handleLogAction"
          @paginationUpdate="handlePaginationUpdate"
        />
      </template>
    </Card>

    <!-- ============ ADD/EDIT KEY MODAL ============ -->
    <Modal ref="keyModal" name="apiKeyModal" size="lg">
      <template #title>
        {{ editingKey ? 'Edit API Key' : 'Add API Key' }}
      </template>
      <template #body>
        <div class="mb-3">
          <label class="form-label fw-bold">Provider</label>
          <select v-model="keyForm.provider" class="form-select" :disabled="!!editingKey">
            <option value="" disabled>Select a provider...</option>
            <option v-for="p in providers" :key="p.slug" :value="p.slug">{{ p.name }}</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Name</label>
          <input v-model="keyForm.name" type="text" class="form-control" placeholder="e.g. My OpenAI Key" />
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">API Key</label>
          <input v-model="keyForm.apiKey" type="password" class="form-control"
            :placeholder="editingKey ? 'Leave blank to keep existing' : 'sk-...'" />
        </div>
        <div v-if="keyForm.provider === 'custom'" class="mb-3">
          <label class="form-label fw-bold">Custom API Endpoint</label>
          <input v-model="keyForm.apiEndpoint" type="text" class="form-control" placeholder="https://your-api.com/v1" />
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Monthly Token Limit</label>
          <input v-model.number="keyForm.usageLimitMonthly" type="number" class="form-control" placeholder="Leave empty for unlimited" />
          <small class="form-text text-muted">Maximum tokens per month. Leave empty for no limit.</small>
        </div>
        <hr />
        <h6 class="text-secondary">Sharing</h6>
        <div class="form-check mb-2">
          <input v-model="keyForm.shared" class="form-check-input" type="checkbox" id="keyShareCheck" />
          <label class="form-check-label" for="keyShareCheck">Share this key with others</label>
        </div>
        <div v-if="keyForm.shared" class="mb-3">
          <select v-model="keyForm.sharedScope" class="form-select">
            <option value="system">System-wide (all users)</option>
            <option value="study">Specific Study</option>
            <option value="project">Specific Project</option>
          </select>
        </div>
        <div v-if="keyForm.shared && (keyForm.sharedScope === 'study' || keyForm.sharedScope === 'project')" class="mb-3">
          <label class="form-label fw-bold">{{ keyForm.sharedScope === 'study' ? 'Study' : 'Project' }} ID</label>
          <input v-model.number="keyForm.sharedTargetId" type="number" class="form-control" />
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.keyModal.close()">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="!isKeyFormValid" @click="saveKey">
          {{ editingKey ? 'Update' : 'Add Key' }}
        </button>
      </template>
    </Modal>

    <!-- ============ ADD/EDIT TEMPLATE MODAL ============ -->
    <Modal ref="templateModal" name="promptTemplateModal" size="xl">
      <template #title>
        {{ editingTemplate ? 'Edit Prompt Template' : 'New Prompt Template' }}
      </template>
      <template #body>
        <div class="row">
          <div class="col-md-5">
            <div class="mb-3">
              <label class="form-label fw-bold">Template Name</label>
              <input v-model="templateForm.name" type="text" class="form-control" placeholder="e.g. Essay Feedback Generator" />
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Description</label>
              <textarea v-model="templateForm.description" class="form-control" rows="2" placeholder="What does this template do?"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Provider</label>
              <select v-model="templateForm.provider" class="form-select">
                <option :value="null">Any provider</option>
                <option v-for="p in providers" :key="p.slug" :value="p.slug">{{ p.name }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Model</label>
              <select v-model="templateForm.model" class="form-select" :disabled="!templateForm.provider">
                <option :value="null">Any model</option>
                <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>
            <hr />
            <h6 class="text-secondary">Sharing</h6>
            <div class="form-check mb-2">
              <input v-model="templateForm.shared" class="form-check-input" type="checkbox" id="tmplShareCheck" />
              <label class="form-check-label" for="tmplShareCheck">Share this template</label>
            </div>
            <div v-if="templateForm.shared" class="mb-3">
              <select v-model="templateForm.sharedScope" class="form-select">
                <option value="system">System-wide</option>
                <option value="study">Specific Study</option>
                <option value="project">Specific Project</option>
              </select>
            </div>
            <div v-if="templateForm.shared && (templateForm.sharedScope === 'study' || templateForm.sharedScope === 'project')" class="mb-3">
              <label class="form-label fw-bold">{{ templateForm.sharedScope === 'study' ? 'Study' : 'Project' }} ID</label>
              <input v-model.number="templateForm.sharedTargetId" type="number" class="form-control" />
            </div>
          </div>
          <div class="col-md-7">
            <div class="mb-3">
              <label class="form-label fw-bold">Prompt Template</label>
              <div class="mb-1">
                <small class="text-muted">
                  Use <code v-pre>{{parameter_name}}</code> for template parameters.
                </small>
              </div>
              <textarea
                v-model="templateForm.promptText"
                class="form-control font-monospace"
                rows="10"
                placeholder="You are an expert writing tutor. Please provide detailed feedback on the following text:

{{document}}

Focus on:
- Clarity and structure
- Grammar and style
- Argument strength"
              ></textarea>
            </div>
            <div v-if="detectedParams.length > 0" class="mb-3">
              <label class="form-label fw-bold">Detected Parameters</label>
              <div class="d-flex flex-wrap gap-1">
                <span v-for="param in detectedParams" :key="param" class="badge bg-primary">{{ param }}</span>
              </div>
            </div>
            <div class="border rounded p-3 bg-light">
              <h6 class="text-secondary mb-2">Quick Test</h6>
              <div v-for="param in detectedParams" :key="'test-' + param" class="mb-2">
                <label class="form-label">{{ param }}:</label>
                <input v-model="testParams[param]" type="text" class="form-control form-control-sm" :placeholder="'Value for ' + param" />
              </div>
              <div class="d-flex gap-2 mt-2">
                <button class="btn btn-sm btn-outline-primary" @click="previewPrompt" :disabled="detectedParams.length === 0">Preview</button>
                <button class="btn btn-sm btn-primary" @click="testRun" :disabled="!canTest || testing">
                  <span v-if="testing" class="spinner-border spinner-border-sm me-1"></span>
                  Test Run
                </button>
              </div>
              <div v-if="previewText" class="mt-2 p-2 border rounded bg-white">
                <small class="text-muted d-block mb-1">Resolved prompt:</small>
                <pre class="mb-0" style="white-space: pre-wrap; font-size: 0.85em;">{{ previewText }}</pre>
              </div>
              <div v-if="testResult" class="mt-2 p-2 border rounded bg-white">
                <small class="text-muted d-block mb-1">Model response:</small>
                <pre class="mb-0" style="white-space: pre-wrap; font-size: 0.85em;">{{ testResult }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.templateModal.close()">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="!isTemplateFormValid" @click="saveTemplate">
          {{ editingTemplate ? 'Update' : 'Create Template' }}
        </button>
      </template>
    </Modal>

    <!-- ============ LOG DETAIL MODAL ============ -->
    <Modal ref="detailModal" name="usageDetailModal" size="xl">
      <template #title>Request Detail</template>
      <template #body>
        <div v-if="selectedLog" class="row">
          <div class="col-md-6">
            <h6 class="text-secondary">Metadata</h6>
            <table class="table table-sm">
              <tbody>
                <tr><td class="fw-bold">Provider</td><td>{{ selectedLog.provider }}</td></tr>
                <tr><td class="fw-bold">Model</td><td>{{ selectedLog.model }}</td></tr>
                <tr>
                  <td class="fw-bold">Status</td>
                  <td><span class="badge" :class="selectedLog.status === 'success' ? 'bg-success' : 'bg-danger'">{{ selectedLog.status }}</span></td>
                </tr>
                <tr><td class="fw-bold">Latency</td><td>{{ selectedLog.latencyMs }}ms</td></tr>
                <tr><td class="fw-bold">Input Tokens</td><td>{{ selectedLog.inputTokens }}</td></tr>
                <tr><td class="fw-bold">Output Tokens</td><td>{{ selectedLog.outputTokens }}</td></tr>
                <tr><td class="fw-bold">Est. Cost</td><td>${{ Number(selectedLog.estimatedCost || 0).toFixed(6) }}</td></tr>
                <tr><td class="fw-bold">Timestamp</td><td>{{ new Date(selectedLog.createdAt).toLocaleString() }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="col-md-6">
            <h6 class="text-secondary">Input</h6>
            <pre class="border rounded p-2 bg-light" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; font-size: 0.85em;">{{ formatJson(selectedLog.input) }}</pre>
            <h6 class="text-secondary mt-3">Output</h6>
            <pre class="border rounded p-2 bg-light" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; font-size: 0.85em;">{{ formatJson(selectedLog.output) }}</pre>
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
import {v4 as uuid} from "uuid";

/**
 * Unified LLM Dashboard
 *
 * Combines API Key management, Prompt Templates, and Usage Log into a
 * single dashboard page. Usage stats at the top, collapsible API Keys
 * and Prompt Templates sections, and the request log as the primary view.
 *
 * @author CARE LLM Integration
 */
export default {
  name: "LlmDashboard",
  components: {Card, BasicTable, BasicButton, Modal},
  data() {
    return {
      // --- Service status ---
      waitForStatus: true,

      // --- API Key form ---
      editingKey: null,
      keyForm: this.getEmptyKeyForm(),

      // --- Template form ---
      editingTemplate: null,
      templateForm: this.getEmptyTemplateForm(),
      testParams: {},
      previewText: '',
      testResult: '',
      testing: false,

      // --- Log filters ---
      filterProvider: '',
      filterStatus: '',
      filterDays: 30,
      currentPage: 0,
      selectedLog: null,

      // --- Table configs ---
      compactTableOptions: {
        striped: true,
        hover: true,
        small: true,
        pagination: 5,
      },
      keyColumns: [
        {name: "Provider", key: "providerDisplay"},
        {name: "Name", key: "name"},
        {name: "Key", key: "maskedKey"},
        {name: "Enabled", key: "enabledToggle", type: "toggle"},
        {name: "Shared", key: "sharedBadge", type: "badge",
          typeOptions: {keyMapping: {true: "Shared", default: "Private"}, classMapping: {true: "bg-info", default: "bg-secondary"}}},
        {name: "Last Used", key: "lastUsedDisplay"},
        {name: "Actions", key: "actions", type: "button-group"},
      ],
      keyButtons: [
        {icon: "pencil", options: {iconOnly: true, specifiers: {"btn-outline-secondary": true}}, title: "Edit", action: "editKey"},
        {icon: "trash", options: {iconOnly: true, specifiers: {"btn-outline-danger": true}}, title: "Delete", action: "deleteKey"},
      ],
      templateColumns: [
        {name: "Name", key: "name"},
        {name: "Description", key: "descriptionDisplay"},
        {name: "Provider", key: "providerDisplay"},
        {name: "Model", key: "modelDisplay"},
        {name: "Params", key: "paramCount"},
        {name: "Shared", key: "sharedBadge", type: "badge",
          typeOptions: {keyMapping: {true: "Shared", default: "Private"}, classMapping: {true: "bg-info", default: "bg-secondary"}}},
        {name: "Actions", key: "actions", type: "button-group"},
      ],
      templateButtons: [
        {icon: "pencil", options: {iconOnly: true, specifiers: {"btn-outline-secondary": true}}, title: "Edit", action: "editTemplate"},
        {icon: "clipboard", options: {iconOnly: true, specifiers: {"btn-outline-primary": true}}, title: "Duplicate", action: "duplicateTemplate"},
        {icon: "trash", options: {iconOnly: true, specifiers: {"btn-outline-danger": true}}, title: "Delete", action: "deleteTemplate"},
      ],
      logColumns: [
        {name: "Time", key: "timeDisplay", sortable: true, sortKey: "createdAt"},
        {name: "Provider", key: "provider"},
        {name: "Model", key: "model"},
        {name: "Status", key: "statusBadge", type: "badge",
          typeOptions: {keyMapping: {"success": "OK", "error": "Error", "timeout": "Timeout", default: "?"}, classMapping: {"success": "bg-success", "error": "bg-danger", "timeout": "bg-warning", default: "bg-secondary"}}},
        {name: "Tokens (In/Out)", key: "tokenDisplay"},
        {name: "Cost", key: "costDisplay"},
        {name: "Latency", key: "latencyDisplay"},
        {name: "Actions", key: "actions", type: "button-group"},
      ],
      logTableOptions: {
        striped: true,
        hover: true,
        small: true,
        pagination: {serverSide: true, total: 0, itemsPerPage: 25},
      },
      logButtons: [
        {icon: "eye", options: {iconOnly: true, specifiers: {"btn-outline-primary": true}}, title: "View Details", action: "viewDetail"},
      ],
    };
  },
  computed: {
    // --- Service state ---
    llmOnline() {
      return !!this.$store.getters["service/getStatus"]("LLMService");
    },
    lastServiceUpdate() {
      return this.$store.getters["service/getStatus"]("LLMService");
    },
    providers() {
      return this.$store.getters["service/get"]("LLMService", "providerUpdate") || [];
    },

    // --- API Keys ---
    keys() {
      return this.$store.getters["service/get"]("LLMService", "apiKeyUpdate") || [];
    },
    keyTableData() {
      return this.keys.map(k => ({
        ...k,
        providerDisplay: this.getProviderName(k.provider),
        lastUsedDisplay: k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never',
        enabledToggle: {title: "Toggle enabled", value: k.enabled, action: "toggleKeyEnabled"},
        sharedBadge: k.shared,
      }));
    },
    isKeyFormValid() {
      return this.keyForm.provider && this.keyForm.name && (this.editingKey || this.keyForm.apiKey);
    },

    // --- Templates ---
    templates() {
      return this.$store.getters["service/get"]("LLMService", "promptTemplateUpdate") || [];
    },
    templateTableData() {
      return this.templates.map(t => {
        const paramMatches = t.promptText?.match(/\{\{(\w+)\}\}/g) || [];
        return {
          ...t,
          descriptionDisplay: t.description ? (t.description.length > 50 ? t.description.substring(0, 50) + '...' : t.description) : '-',
          providerDisplay: t.provider ? this.getProviderName(t.provider) : 'Any',
          modelDisplay: t.model || 'Any',
          paramCount: [...new Set(paramMatches.map(m => m.replace(/\{\{|\}\}/g, '')))].length,
          sharedBadge: t.shared,
        };
      });
    },
    availableModels() {
      if (!this.templateForm.provider) return [];
      const provider = this.providers.find(p => p.slug === this.templateForm.provider);
      if (!provider) return [];
      return Array.isArray(provider.models) ? provider.models
        : (typeof provider.models === 'string' ? JSON.parse(provider.models) : []);
    },
    detectedParams() {
      const matches = this.templateForm.promptText?.match(/\{\{(\w+)\}\}/g) || [];
      return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    },
    canTest() {
      return this.templateForm.promptText && this.templateForm.provider && this.templateForm.model;
    },
    isTemplateFormValid() {
      return this.templateForm.name && this.templateForm.promptText;
    },

    // --- Usage ---
    usageStats() {
      return this.$store.getters["service/get"]("LLMService", "usageStats");
    },
    usageLogs() {
      return this.$store.getters["service/get"]("LLMService", "usageLogs");
    },
    statsDisplay() {
      const t = this.usageStats?.totals || {};
      return {
        totalRequests: t.totalRequests || 0,
        totalInputTokens: t.totalInputTokens || 0,
        totalOutputTokens: t.totalOutputTokens || 0,
        totalCost: Number(t.totalCost || 0).toFixed(4),
      };
    },
    providerStats() {
      return this.usageStats?.byProvider || [];
    },
    logs() {
      return this.usageLogs?.rows || [];
    },
    logCount() {
      return this.usageLogs?.count || 0;
    },
    logTableData() {
      return this.logs.map(l => ({
        ...l,
        timeDisplay: new Date(l.createdAt).toLocaleString(),
        statusBadge: l.status,
        tokenDisplay: `${l.inputTokens || 0} / ${l.outputTokens || 0}`,
        costDisplay: '$' + Number(l.estimatedCost || 0).toFixed(6),
        latencyDisplay: (l.latencyMs || 0) + 'ms',
      }));
    },
    llmResults() {
      return this.$store.getters["service/get"]("LLMService", "llmResult") || {};
    },
  },
  watch: {
    lastServiceUpdate(newVal) {
      if (newVal) this.waitForStatus = false;
    },
    usageLogs() {
      if (this.usageLogs) {
        this.logTableOptions.pagination.total = this.usageLogs.count || 0;
      }
    },
    llmResults(results) {
      if (this._testRequestId && results[this._testRequestId]) {
        this.testResult = results[this._testRequestId].data || results[this._testRequestId].error || '';
        this.testing = false;
        this.$store.commit("service/removeResults", {service: "LLMService", requestId: this._testRequestId});
        this._testRequestId = null;
      }
    },
  },
  mounted() {
    this.loadAll();
    this.checkServiceConnection();
  },
  methods: {
    // --- Helpers ---
    getProviderName(slug) {
      const p = this.providers.find(p => p.slug === slug);
      return p ? p.name : slug;
    },
    formatNumber(n) {
      if (!n) return '0';
      return Number(n).toLocaleString();
    },
    formatJson(obj) {
      if (!obj) return '-';
      try { return typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2); }
      catch { return String(obj); }
    },
    getEmptyKeyForm() {
      return {provider: '', name: '', apiKey: '', apiEndpoint: '', usageLimitMonthly: null,
        shared: false, sharedScope: 'system', sharedTargetId: null};
    },
    getEmptyTemplateForm() {
      return {name: '', description: '', provider: null, model: null, promptText: '',
        inputMapping: {}, defaultOutputMapping: {}, shared: false, sharedScope: 'system', sharedTargetId: null};
    },

    // --- Loading ---
    loadAll() {
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getProviders", data: {}});
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getApiKeys", data: {}});
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getPromptTemplates", data: {}});
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getUsageStats", data: {days: this.filterDays}});
      this.loadLogs();
    },
    loadLogs() {
      const filter = {};
      if (this.filterProvider) filter.provider = this.filterProvider;
      if (this.filterStatus) filter.status = this.filterStatus;
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getUsageLogs",
        data: {limit: 25, page: this.currentPage, filter, order: [['createdAt', 'DESC']]}});
    },
    checkServiceConnection() {
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getStatus", data: {}});
      this.waitForStatus = true;
      setTimeout(() => { if (this.waitForStatus) this.waitForStatus = false; }, 5000);
    },

    // --- API Key actions ---
    openAddKeyModal() {
      this.editingKey = null;
      this.keyForm = this.getEmptyKeyForm();
      this.$refs.keyModal.open();
    },
    handleKeyAction(data) {
      switch (data.action) {
        case "editKey":
          this.editingKey = data.params;
          this.keyForm = {
            provider: data.params.provider, name: data.params.name, apiKey: '',
            apiEndpoint: data.params.apiEndpoint || '', usageLimitMonthly: data.params.usageLimitMonthly,
            shared: data.params.shared, sharedScope: data.params.sharedScope || 'system',
            sharedTargetId: data.params.sharedTargetId,
          };
          this.$refs.keyModal.open();
          break;
        case "deleteKey":
          if (confirm(`Delete API key "${data.params.name}"?`)) {
            this.$socket.emit("serviceCommand", {service: "LLMService", command: "removeApiKey", data: {id: data.params.id}});
          }
          break;
        case "toggleKeyEnabled":
          this.$socket.emit("serviceCommand", {service: "LLMService", command: "updateApiKey",
            data: {id: data.params.id, enabled: data.value, name: data.params.name}});
          break;
      }
    },
    saveKey() {
      const command = this.editingKey ? 'updateApiKey' : 'addApiKey';
      const payload = {...this.keyForm};
      if (this.editingKey) { payload.id = this.editingKey.id; if (!payload.apiKey) delete payload.apiKey; }
      if (!payload.shared) { payload.sharedScope = 'none'; payload.sharedTargetId = null; }
      this.$socket.emit("serviceCommand", {service: "LLMService", command, data: payload}, (res) => {
        if (res && res.success !== false) {
          this.eventBus.emit("toast", {title: "API Key", message: this.editingKey ? "Key updated." : "Key added.", variant: "success"});
          this.$refs.keyModal.close();
          this.loadAll();
        } else {
          this.eventBus.emit("toast", {title: "Error", message: res?.message || "Failed to save key.", variant: "danger"});
        }
      });
    },

    // --- Template actions ---
    openAddTemplateModal() {
      this.editingTemplate = null;
      this.templateForm = this.getEmptyTemplateForm();
      this.testParams = {};
      this.previewText = '';
      this.testResult = '';
      this.$refs.templateModal.open();
    },
    handleTemplateAction(data) {
      switch (data.action) {
        case "editTemplate":
          this.editingTemplate = data.params;
          this.templateForm = {
            name: data.params.name, description: data.params.description || '',
            provider: data.params.provider, model: data.params.model, promptText: data.params.promptText,
            inputMapping: data.params.inputMapping || {}, defaultOutputMapping: data.params.defaultOutputMapping || {},
            shared: data.params.shared, sharedScope: data.params.sharedScope || 'system',
            sharedTargetId: data.params.sharedTargetId,
          };
          this.testParams = {};
          this.previewText = '';
          this.testResult = '';
          this.$refs.templateModal.open();
          break;
        case "duplicateTemplate":
          this.editingTemplate = null;
          this.templateForm = {
            name: data.params.name + ' (Copy)', description: data.params.description || '',
            provider: data.params.provider, model: data.params.model, promptText: data.params.promptText,
            inputMapping: data.params.inputMapping || {}, defaultOutputMapping: data.params.defaultOutputMapping || {},
            shared: false, sharedScope: 'none', sharedTargetId: null,
          };
          this.testParams = {};
          this.previewText = '';
          this.testResult = '';
          this.$refs.templateModal.open();
          break;
        case "deleteTemplate":
          if (confirm(`Delete template "${data.params.name}"?`)) {
            this.$socket.emit("serviceCommand", {service: "LLMService", command: "removePromptTemplate", data: {id: data.params.id}});
          }
          break;
      }
    },
    previewPrompt() {
      let resolved = this.templateForm.promptText;
      for (const param of this.detectedParams) {
        const value = this.testParams[param] || `[${param}]`;
        resolved = resolved.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), value);
      }
      this.previewText = resolved;
    },
    testRun() {
      if (!this.canTest) return;
      this.previewPrompt();
      this.testing = true;
      this.testResult = '';
      this._testRequestId = uuid();
      this.$socket.emit("serviceRequest", {service: "LLMService", data: {
        id: this._testRequestId, provider: this.templateForm.provider,
        model: this.templateForm.model, messages: [{role: 'user', content: this.previewText}],
      }});
      setTimeout(() => { if (this.testing) { this.testing = false; this.testResult = 'Request timed out.'; } }, 120000);
    },
    saveTemplate() {
      const command = this.editingTemplate ? 'updatePromptTemplate' : 'addPromptTemplate';
      const payload = {...this.templateForm};
      if (this.editingTemplate) payload.id = this.editingTemplate.id;
      if (!payload.shared) { payload.sharedScope = 'none'; payload.sharedTargetId = null; }
      this.$socket.emit("serviceCommand", {service: "LLMService", command, data: payload}, (res) => {
        if (res && res.success !== false) {
          this.eventBus.emit("toast", {title: "Template", message: this.editingTemplate ? "Updated." : "Created.", variant: "success"});
          this.$refs.templateModal.close();
          this.loadAll();
        } else {
          this.eventBus.emit("toast", {title: "Error", message: res?.message || "Failed.", variant: "danger"});
        }
      });
    },

    // --- Log actions ---
    handlePaginationUpdate(paginationData) {
      this.currentPage = paginationData.page;
      this.loadLogs();
    },
    handleLogAction(data) {
      if (data.action === "viewDetail") {
        this.selectedLog = data.params;
        this.$refs.detailModal.open();
      }
    },
    exportCsv() {
      if (this.logs.length === 0) return;
      const headers = ['Timestamp', 'Provider', 'Model', 'Status', 'Input Tokens', 'Output Tokens', 'Est. Cost', 'Latency (ms)'];
      const rows = this.logs.map(l => [
        new Date(l.createdAt).toISOString(), l.provider, l.model, l.status,
        l.inputTokens || 0, l.outputTokens || 0, l.estimatedCost || 0, l.latencyMs || 0,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `llm_usage_log_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },
};
</script>

<style scoped>
.font-monospace {
  font-family: 'Courier New', Courier, monospace;
}
</style>
