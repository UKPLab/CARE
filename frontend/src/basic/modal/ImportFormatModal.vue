<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValid"
    size="lg"
    @submit="importItems"
    @hide="reset"
  >
    <template #title>
      <h5 class="modal-title">{{ title }}</h5>
    </template>

    <!-- Step 1: File picker -->
    <template #step-1>
      <div class="form-field d-flex flex-column">
        <label class="form-label w-100 text-start mb-2">
          Select file ({{ acceptedExtensions.join(", ") }}):
        </label>
        <div class="w-100">
          <input
            ref="fileInput"
            class="form-control"
            type="file"
            :accept="acceptString"
            @change="handleFileSelect"
          />
        </div>
      </div>
      <div v-if="selectedFile" class="mt-2">
        <small class="text-muted">Selected: {{ selectedFile.name }}</small>
      </div>
      <div v-if="parseError" class="mt-2 text-danger">
        <small>{{ parseError }}</small>
      </div>
    </template>

    <!-- Step 2: Item selection -->
    <template #step-2>
      <p class="text-muted mb-2">
        Select which items to import from <strong>{{ selectedFile && selectedFile.name }}</strong>:
      </p>
      <BasicTable
        v-model="selectedItems"
        :columns="displayColumns"
        :data="displayData"
        :options="tableOptions"
        :max-table-height="400"
      />
    </template>

    <!-- Step 3: Confirmation -->
    <template #step-3>
      <p>Are you sure you want to import the following {{ table || "items" }}?</p>
      <ul>
        <li v-for="item in selectedItems" :key="item._idx">
          <strong>{{ item._label }}</strong>
          <span v-if="item._childCount !== undefined"> — {{ item._childCount }} child record(s)</span>
        </li>
      </ul>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import { getSupportedImportFormats } from "@/assets/utils";

/**
 * Import Format Modal Component
 *
 * Generic stepper modal for importing data from JSON or YAML files.
 * Supports two modes:
 * - Table mode (table set via open()): handles socket emit internally
 * - Emit mode (no table): emits @itemsSelected with parsed data for parent to handle
 *
 * @author Karim Ouf
 */
export default {
  name: "ImportFormatModal",
  components: { StepperModal, BasicTable },
  emits: ["itemsSelected"],
  props: {
    title: {
      type: String,
      default: "Import",
    },
    columns: {
      type: Array,
      default: null,
    },
  },
  data() {
    return {
      table: null,
      childTable: null,
      overrides: {},
      socketOptions: {},
      selectedFile: null,
      parsedData: null,
      selectedItems: [],
      parseError: null,
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    supportedImportFormats() {
      return getSupportedImportFormats();
    },
    acceptedExtensions() {
      return this.supportedImportFormats.flatMap((f) => f.extensions);
    },
    acceptString() {
      return this.acceptedExtensions.join(",");
    },
    steps() {
      const itemLabel = this.table
        ? this.table.replace(/_/g, " ")
        : "Item";
      return [
        { title: "File Selection" },
        { title: `${itemLabel} Selection` },
        { title: "Confirmation" },
      ];
    },
    stepValid() {
      return [
        !!this.parsedData,
        this.selectedItems.length > 0,
        true,
      ];
    },
    displayColumns() {
      if (this.columns) return this.columns;
      if (!this.parsedData?.length) return [];

      const firstItem = this.parsedData[0];
      const priority = ["name", "title", "id"];
      const scalarKeys = Object.keys(firstItem).filter((k) => {
        const v = firstItem[k];
        return !Array.isArray(v) && (typeof v !== "object" || v === null);
      });
      const ordered = [
        ...priority.filter((k) => scalarKeys.includes(k)),
        ...scalarKeys.filter((k) => !priority.includes(k)),
      ].slice(0, 3);

      const cols = ordered.map((key) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        key,
        sortable: true,
      }));

      if (this.childTable) {
        cols.push({ name: this.childTable, key: "_childCount", sortable: true });
      }
      return cols;
    },
    displayData() {
      if (!this.parsedData) return [];
      return this.parsedData.map((item, idx) => {
        const row = { ...item, _idx: idx };
        row._label = item.name || item.title || item.id || `Item ${idx + 1}`;
        if (this.childTable) {
          row._childCount = (item[this.childTable] || []).length;
        }
        return row;
      });
    },
    tableOptions() {
      return {
        striped: true,
        hover: true,
        selectableRows: true,
        scrollY: true,
        search: true,
      };
    },
  },
  methods: {
    /**
     * Opens the import modal.
     * @param {string|null} table - Table to import into. If null, emits @itemsSelected instead of writing to socket.
     * @param {string|null} childTable - Optional child table for nested records (e.g. "workflow_step").
     * @param {object} [options={}] - Optional configuration.
     * @param {object} [options.overrides={}] - Fields merged into each imported item, overriding values from the file.
     * @param {object} [options.socket={}] - Custom socket options (defaults to appDataUpdate with standard payload).
     * @param {string}      [options.socket.name] - Custom socket event name instead of "appDataUpdate".
     * @param {string} [options.socket.dataKey] - Key under which item data is nested in the payload. If omitted, item data is spread directly into the top-level payload.
     * @param {object} [options.socket.extra={}] - Extra top-level fields merged into the socket payload.
     *
     * @example
     * Default table mode — imports workflows with nested steps via appDataUpdate
     * this.$refs.importFormatModal.open("workflow", "workflow_step");
     *
     * @example
     * Emit mode — no table, parent handles the imported items via @itemsSelected
     * this.$refs.importFormatModal.open();
     *
     * @example
     * Override mode — force template: true on every imported record
     * this.$refs.importFormatModal.open("study", "study_step", {
     *   overrides: { template: true },
     * });
     *
     * @example
     * Custom socket with dataKey — send data to a specific socket event
     * this.$refs.importFormatModal.open("study", "study_step", {
     *   socket: {
     *     name: "studySaveAsTemplate",
     *     dataKey: "templateData",
     *     extra: { onlyTemplate: true },
     *   },
     * });
     *
     */
    open(table = null, childTable = null, { overrides = {}, socket = {} } = {}) {
      this.table = table;
      this.childTable = childTable;
      this.overrides = overrides;
      this.socketOptions = socket;
      this.reset();
      this.$refs.stepper.open();
    },
    close() {
      this.$refs.stepper.close();
    },
    reset() {
      this.selectedFile = null;
      this.parsedData = null;
      this.selectedItems = [];
      this.parseError = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      this.parsedData = null;
      this.selectedItems = [];
      this.parseError = null;
      this.processFile(file);
    },
    async processFile(file) {
      try {
        const content = await this.readFile(file);
        const ext = "." + file.name.toLowerCase().split(".").pop();
        const format = this.supportedImportFormats.find((f) =>
          f.extensions.includes(ext)
        );
        if (!format) {
          throw new Error(`Unsupported file type "${ext}"`);
        }
        let parsed = format.parse(content);
        if (parsed && !Array.isArray(parsed)) {
          parsed = [parsed];
        }
        this.parsedData = parsed;
        this.selectedItems = this.displayData.slice();
      } catch (error) {
        console.error("Error processing file:", error);
        this.parseError = `Failed to parse file: ${error.message}`;
        this.selectedFile = null;
        this.parsedData = null;
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });
    },
    socketEmit(event, data) {
      return new Promise((resolve) => {
        this.$socket.emit(event, data, (r) => resolve(r));
      });
    },
    async importItems() {
      if (!this.parsedData || this.selectedItems.length === 0) return;

      // Emit-only mode: no table set, delegate to parent
      if (!this.table) {
        this.$emit(
          "itemsSelected",
          this.selectedItems.map((row) => this.parsedData[row._idx])
        );
        this.close();
        return;
      }

      this.$refs.stepper.setWaiting(true);

      const attributesToDelete = [
        "draft", "anonymous", "createdAt", "updatedAt",
        "deleted", "deletedAt", "userId",
      ];
      const tableCamel = this.table.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const childTableCamel = this.childTable
        ? this.childTable.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
        : null;

      let importedCount = 0;

      for (const selectedRow of this.selectedItems) {
        const item = this.parsedData[selectedRow._idx];
        const children = this.childTable ? (item[this.childTable] || []) : [];
        const itemData = Object.fromEntries(
          Object.entries(item).filter(
            ([key]) => !attributesToDelete.includes(key) && key !== this.childTable
          )
        );
        let result;
        if (this.socketOptions.name) {
          const dataKey = this.socketOptions.dataKey;
          const extra = this.socketOptions.extra || {};
          const itemPayload = { ...itemData, ...this.overrides, userId: this.userId };
          result = await this.socketEmit(this.socketOptions.name, dataKey
            ? { ...extra, [dataKey]: itemPayload }
            : { ...extra, ...itemPayload }
          );
        } else {
          result = await this.socketEmit("appDataUpdate", {
            table: this.table,
            data: { ...itemData, ...this.overrides, userId: this.userId },
          });
        }
        
        if (result.success) {
          importedCount++;

          if (this.childTable && children.length > 0 && !this.socketOptions.name) {
            const fkField = `${tableCamel}Id`;
            const previousField = `${childTableCamel}Previous`;
            let previousId = null;

            for (const child of children) {
              const childData = Object.fromEntries(
                Object.entries(child).filter(([key]) => !attributesToDelete.includes(key))
              );
              const childResult = await this.socketEmit("appDataUpdate", {
                table: this.childTable,
                data: { ...childData, [fkField]: result.data, [previousField]: previousId },
              });
              if (childResult.success) {
                previousId = childResult.data;
              } else {
                this.eventBus.emit("toast", {
                  title: "Import Error",
                  message: `Failed to import child record: ${childResult.message}`,
                  variant: "danger",
                });
              }
            }
          }
        } else {
          this.eventBus.emit("toast", {
            title: "Import Error",
            message: `Failed to import "${itemData.name || itemData.id}": ${result.message}`,
            variant: "danger",
          });
        }
      }

      this.$refs.stepper.setWaiting(false);
      this.eventBus.emit("toast", {
        title: "Import Successful",
        message: `${importedCount} ${this.table}${importedCount !== 1 ? "s" : ""} imported successfully!`,
        variant: "success",
      });
      this.close();
    },
  },
};
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 15px 0;
}

.form-field .form-label {
  flex-shrink: 0;
  margin-bottom: 0;
  margin-right: 0.5rem;
  min-width: 160px;
}
</style>

