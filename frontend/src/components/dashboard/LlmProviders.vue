<template>
  <div>
    <Card title="LLM Model Catalog">
      <template #headerElements>
        <div class="btn-group gap-2 ms-3">
          <BasicButton
            class="btn-primary btn-sm"
            title="Add Model"
            text="Add Model"
            icon="plus-circle"
            @click="openAddModal"
          />
        </div>
      </template>
      <template #body>
        <div v-if="!models || models.length === 0" class="text-center text-muted py-4">
          No LLM models configured.
        </div>
        <BasicTable
          v-else
          :columns="columns"
          :data="tableData"
          :options="tableOptions"
          :buttons="buttons"
          @action="handleAction"
        />
      </template>
    </Card>

    <Modal ref="providerModal" name="llmModelModal" size="lg">
      <template #title>
        {{ editingModel ? 'Edit Model' : 'Add Model' }}
      </template>
      <template #body>
        <div class="mb-3">
          <label class="form-label fw-bold">Name</label>
          <input v-model="form.name" type="text" class="form-control" placeholder="e.g. GPT-4o (Default)" />
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">LiteLLM Model ID</label>
          <input v-model="form.model" type="text" class="form-control" placeholder="e.g. gpt-4o, azure/my-deploy, openrouter/google/gemini-pro" />
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">Provider</label>
          <input v-model="form.provider" type="text" class="form-control" placeholder="e.g. openai, azure, anthropic, ollama" />
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">Description</label>
          <textarea v-model="form.description" class="form-control" rows="2" placeholder="Optional model description"></textarea>
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">Credential (optional)</label>
          <select v-model="form.llmCredentialId" class="form-select">
            <option :value="null">None</option>
            <option v-for="c in credentialOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-check mb-3">
          <input v-model="form.enabled" class="form-check-input" type="checkbox" id="providerEnabled" />
          <label class="form-check-label" for="providerEnabled">Enabled</label>
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">Additional Parameters (JSON)</label>
          <textarea
            v-model="form.additionalParametersText"
            class="form-control font-monospace"
            rows="5"
            placeholder='{"temperature":0.2,"max_tokens":4096,"top_p":1}'
          ></textarea>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.providerModal.close()">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="!isFormValid" @click="saveProvider">
          {{ editingModel ? 'Update' : 'Add Model' }}
        </button>
      </template>
    </Modal>
  </div>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Modal from "@/basic/Modal.vue";

/**
 * LLM Providers Admin Dashboard
 *
 * Admin-only page to manage LLM provider configurations.
 * Providers define available models, API endpoints, and can be enabled/disabled system-wide.
 *
 * @author CARE LLM Integration
 */
export default {
  name: "LlmProviders",
  components: {Card, BasicTable, BasicButton, Modal},
  subscribeTable: ['llm_model', 'llm_credential'],
  data() {
    return {
      editingModel: null,
      form: this.getEmptyForm(),
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      columns: [
        {name: "Name", key: "name"},
        {name: "LiteLLM Model", key: "model"},
        {name: "Provider", key: "provider"},
        {name: "Credential", key: "credentialName"},
        {name: "Defaults", key: "defaultsSummary"},
        {
          name: "Enabled",
          key: "enabledToggle",
          type: "toggle",
        },
        {name: "Actions", key: "actions", type: "button-group"},
      ],
    };
  },
  computed: {
    models() {
      return this.$store.getters["table/llm_model/getAll"] || [];
    },
    credentials() {
      return this.$store.getters["table/llm_credential/getAll"] || [];
    },
    credentialOptions() {
      return this.credentials.map((c) => ({id: c.id, name: c.name || `Credential ${c.id}`}));
    },
    tableData() {
      return this.models.map((m) => {
        const defaults = this.stringifyParameters(m.additionalParameters);
        const credential = this.credentials.find((c) => c.id === m.llmCredentialId);
        return {
          ...m,
          credentialName: credential ? credential.name : "-",
          defaultsSummary: defaults.length > 60 ? `${defaults.slice(0, 60)}...` : defaults,
          enabledToggle: {
            title: "Toggle enabled",
            value: m.enabled,
            action: "toggleEnabled",
          },
        };
      });
    },
    buttons() {
      return [
        {
          icon: "pencil",
          options: {iconOnly: true, specifiers: {"btn-outline-secondary": true}},
          title: "Edit",
          action: "edit",
        },
        {
          icon: "trash",
          options: {iconOnly: true, specifiers: {"btn-outline-danger": true}},
          title: "Delete",
          action: "delete",
        },
      ];
    },
    isFormValid() {
      return this.form.name && this.form.model && this.form.provider;
    },
  },
  methods: {
    getEmptyForm() {
      return {
        name: '',
        model: '',
        provider: '',
        description: '',
        llmCredentialId: null,
        enabled: true,
        additionalParametersText: '{}',
      };
    },
    stringifyParameters(value) {
      if (!value) return "{}";
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return "{}";
      }
    },
    parseParameters(text) {
      if (!text || !text.trim()) return {};
      return JSON.parse(text);
    },
    openAddModal() {
      this.editingModel = null;
      this.form = this.getEmptyForm();
      this.$refs.providerModal.open();
    },
    handleAction(data) {
      switch (data.action) {
        case "edit": {
          this.editingModel = data.params;
          this.form = {
            name: data.params.name,
            model: data.params.model,
            provider: data.params.provider,
            description: data.params.description || '',
            llmCredentialId: data.params.llmCredentialId || null,
            enabled: data.params.enabled,
            additionalParametersText: this.stringifyParameters(data.params.additionalParameters),
          };
          this.$refs.providerModal.open();
          break;
        }
        case "delete":
          if (confirm(`Delete model "${data.params.name}"?`)) {
            this.$socket.emit("appDataUpdate", {
              table: "llm_model",
              data: {id: data.params.id, deleted: true},
            });
          }
          break;
        case "toggleEnabled":
          this.$socket.emit("appDataUpdate", {
            table: "llm_model",
            data: {id: data.params.id, enabled: data.value},
          });
          break;
      }
    },
    saveProvider() {
      let additionalParameters = {};
      try {
        additionalParameters = this.parseParameters(this.form.additionalParametersText);
      } catch (_error) {
        this.eventBus.emit("toast", {title: "Invalid JSON", message: "Please provide valid JSON in additional parameters.", variant: "danger"});
        return;
      }

      const payload = {
        name: this.form.name.trim(),
        model: this.form.model.trim(),
        provider: this.form.provider.trim(),
        description: this.form.description,
        llmCredentialId: this.form.llmCredentialId,
        enabled: this.form.enabled,
        additionalParameters,
      };

      if (this.editingModel) {
        this.$socket.emit("appDataUpdate", {
          table: "llm_model",
          data: {id: this.editingModel.id, ...payload},
        }, (res) => {
          if (res && res.success !== false) {
            this.eventBus.emit("toast", {title: "Model", message: "Model updated.", variant: "success"});
            this.$refs.providerModal.close();
          } else {
            this.eventBus.emit("toast", {title: "Error", message: res?.message || "Failed.", variant: "danger"});
          }
        });
      } else {
        this.$socket.emit("appDataUpdate", {
          table: "llm_model",
          data: payload,
        }, (res) => {
          if (res && res.success !== false) {
            this.eventBus.emit("toast", {title: "Model", message: "Model added.", variant: "success"});
            this.$refs.providerModal.close();
          } else {
            this.eventBus.emit("toast", {title: "Error", message: res?.message || "Failed.", variant: "danger"});
          }
        });
      }
    },
  },
};
</script>

<style scoped>
.font-monospace {
  font-family: 'Courier New', Courier, monospace;
}
</style>
