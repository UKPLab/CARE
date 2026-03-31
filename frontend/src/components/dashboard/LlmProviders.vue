<template>
  <div>
    <Card title="LLM Providers">
      <template #headerElements>
        <div class="btn-group gap-2 ms-3">
          <BasicButton
            class="btn-primary btn-sm"
            title="Add Provider"
            text="Add Provider"
            icon="plus-circle"
            @click="openAddModal"
          />
          <BasicButton
            class="btn-outline-secondary btn-sm"
            title="Refresh"
            text="Refresh"
            icon="arrow-clockwise"
            @click="load"
          />
        </div>
      </template>
      <template #body>
        <div v-if="!providers || providers.length === 0" class="text-center text-muted py-4">
          No LLM providers configured.
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

    <!-- Provider Modal -->
    <Modal ref="providerModal" name="llmProviderModal" size="lg">
      <template #title>
        {{ editingProvider ? 'Edit Provider' : 'Add Provider' }}
      </template>
      <template #body>
        <div class="mb-3">
          <label class="form-label fw-bold">Name</label>
          <input v-model="form.name" type="text" class="form-control" placeholder="e.g. OpenAI" />
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">Slug (unique identifier)</label>
          <input v-model="form.slug" type="text" class="form-control" placeholder="e.g. openai" :disabled="!!editingProvider" />
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">API Base URL</label>
          <input v-model="form.apiBaseUrl" type="text" class="form-control" placeholder="https://api.openai.com/v1" />
        </div>

        <div class="form-check mb-3">
          <input v-model="form.enabled" class="form-check-input" type="checkbox" id="providerEnabled" />
          <label class="form-check-label" for="providerEnabled">Enabled</label>
        </div>

        <hr />
        <h6 class="text-secondary">Models</h6>
        <div class="mb-2" v-for="(model, idx) in form.models" :key="idx">
          <div class="input-group input-group-sm">
            <input v-model="model.id" type="text" class="form-control" placeholder="Model ID (e.g. gpt-4o)" />
            <input v-model="model.name" type="text" class="form-control" placeholder="Display Name" />
            <button class="btn btn-outline-danger" type="button" @click="form.models.splice(idx, 1)">
              &times;
            </button>
          </div>
        </div>
        <button class="btn btn-sm btn-outline-secondary mt-1" @click="form.models.push({id: '', name: '', capabilities: ['text-generation']})">
          + Add Model
        </button>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.providerModal.close()">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="!isFormValid" @click="saveProvider">
          {{ editingProvider ? 'Update' : 'Add Provider' }}
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
  subscribeTable: ['llm_provider'],
  data() {
    return {
      editingProvider: null,
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
        {name: "Slug", key: "slug"},
        {name: "API Base URL", key: "apiBaseUrl"},
        {name: "Models", key: "modelCount"},
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
    providers() {
      return this.$store.getters["table/llm_provider/getAll"] || [];
    },
    tableData() {
      return this.providers.map(p => {
        const models = Array.isArray(p.models)
          ? p.models
          : (typeof p.models === 'string' ? JSON.parse(p.models) : []);
        return {
          ...p,
          modelCount: models.length + ' model(s)',
          enabledToggle: {
            title: "Toggle enabled",
            value: p.enabled,
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
      return this.form.name && this.form.slug && this.form.apiBaseUrl;
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    getEmptyForm() {
      return {
        name: '',
        slug: '',
        apiBaseUrl: '',
        enabled: true,
        models: [{id: '', name: '', capabilities: ['text-generation']}],
      };
    },
    load() {
      this.$socket.emit("serviceCommand", {service: "LLMService", command: "getProviders", data: {}});
    },
    openAddModal() {
      this.editingProvider = null;
      this.form = this.getEmptyForm();
      this.$refs.providerModal.open();
    },
    handleAction(data) {
      switch (data.action) {
        case "edit": {
          this.editingProvider = data.params;
          const models = Array.isArray(data.params.models)
            ? data.params.models
            : (typeof data.params.models === 'string' ? JSON.parse(data.params.models) : []);
          this.form = {
            name: data.params.name,
            slug: data.params.slug,
            apiBaseUrl: data.params.apiBaseUrl,
            enabled: data.params.enabled,
            models: models.map(m => ({...m})),
          };
          this.$refs.providerModal.open();
          break;
        }
        case "delete":
          if (confirm(`Delete provider "${data.params.name}"?`)) {
            this.$socket.emit("appDataUpdate", {
              table: "llm_provider",
              action: "delete",
              data: {id: data.params.id},
            });
          }
          break;
        case "toggleEnabled":
          this.$socket.emit("appDataUpdate", {
            table: "llm_provider",
            action: "update",
            data: {id: data.params.id, enabled: data.value},
          });
          break;
      }
    },
    saveProvider() {
      const payload = {
        name: this.form.name,
        slug: this.form.slug,
        apiBaseUrl: this.form.apiBaseUrl,
        enabled: this.form.enabled,
        models: JSON.stringify(this.form.models.filter(m => m.id && m.name)),
      };

      if (this.editingProvider) {
        this.$socket.emit("appDataUpdate", {
          table: "llm_provider",
          action: "update",
          data: {id: this.editingProvider.id, ...payload},
        }, (res) => {
          if (res && res.success !== false) {
            this.eventBus.emit("toast", {title: "Provider", message: "Provider updated.", variant: "success"});
            this.$refs.providerModal.close();
          } else {
            this.eventBus.emit("toast", {title: "Error", message: res?.message || "Failed.", variant: "danger"});
          }
        });
      } else {
        this.$socket.emit("appDataUpdate", {
          table: "llm_provider",
          action: "add",
          data: payload,
        }, (res) => {
          if (res && res.success !== false) {
            this.eventBus.emit("toast", {title: "Provider", message: "Provider added.", variant: "success"});
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
</style>
