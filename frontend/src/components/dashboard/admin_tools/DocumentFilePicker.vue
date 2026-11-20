<template>
  <div>
    <div class="mb-3">
      <label
          class="form-label"
          for="replace-doc-type-filter"
      >{{ $t('dashboard.adminTools.replaceDocumentFile.typeLabel') }}</label>
      <select
          id="replace-doc-type-filter"
          :value="typeFilter"
          class="form-select"
          @change="$emit('update:typeFilter', $event.target.value)"
      >
        <option value="all">{{ $t('dashboard.adminTools.replaceDocumentFile.typeAll') }}</option>
        <option value="pdf">{{ $t('dashboard.adminTools.replaceDocumentFile.typePdfOnly') }}</option>
        <option value="zip">{{ $t('dashboard.adminTools.replaceDocumentFile.typeZipOnly') }}</option>
      </select>
    </div>

    <BasicTable
        v-model="selectedRows"
        :columns="columns"
        :data="tableData"
        :options="tableOptions"
        :max-table-height="320"
    />

    <p
        v-if="modelValue"
        class="small text-muted mt-2 mb-3"
    >
      <i18n-t
        :id="modelValue.id"
        keypath="dashboard.adminTools.replaceDocumentFile.selected"
        tag="span"
        :type="modelValue.typeName"
      >
        <template #name>
          <strong>{{ modelValue.name }}</strong>
        </template>
      </i18n-t>
    </p>
    <p
        v-else
        class="small text-muted mt-2 mb-3"
    >
      {{ $t('dashboard.adminTools.replaceDocumentFile.selectHint') }}
    </p>
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

const DOC_TYPE_PDF = 0;
const DOC_TYPE_ZIP = 4;

/**
 * Filterable, single-select table of PDF/ZIP documents whose file can be replaced.
 * Emits the selected document row (with typeName and expected file extension).
 *
 * @author Mohammad Elwan
 */
export default {
  name: "DocumentFilePicker",
  subscribeTable: ["document"],
  components: { BasicTable },
  props: {
    typeFilter: {
      type: String,
      default: "all",
    },
    modelValue: {
      type: Object,
      default: null,
    },
  },
  emits: ["update:typeFilter", "update:modelValue"],
  data() {
    return {
      selectedRows: [],
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
        selectableRows: true,
        singleSelect: true,
        search: true,
        pagination: 10,
      },
    };
  },
  computed: {
    columns() {
      return [
        {name: this.$t("dashboard.adminTools.replaceDocumentFile.columns.id"), key: "id", sortable: true},
        {name: this.$t("dashboard.adminTools.replaceDocumentFile.columns.title"), key: "name", sortable: true, multiline: true},
        {name: this.$t("dashboard.adminTools.replaceDocumentFile.columns.type"), key: "typeName", sortable: true},
      ];
    },
    tableData() {
      const all = this.$store.getters["table/document/getAll"] || [];
      return all
          .filter((doc) => {
            if (!doc || doc.deleted) {
              return false;
            }
            if (doc.type !== DOC_TYPE_PDF && doc.type !== DOC_TYPE_ZIP) {
              return false;
            }
            if (this.typeFilter === "pdf" && doc.type !== DOC_TYPE_PDF) {
              return false;
            }
            if (this.typeFilter === "zip" && doc.type !== DOC_TYPE_ZIP) {
              return false;
            }
            return true;
          })
          .map((doc) => ({
            ...doc,
            name: doc.name || this.$t("dashboard.adminTools.replaceDocumentFile.unnamed"),
            typeName: this.typeLabel(doc.type),
            extension: doc.type === DOC_TYPE_PDF ? ".pdf" : ".zip",
          }));
    },
  },
  watch: {
    selectedRows() {
      this.emitSelection();
    },
    tableData() {
      this.clearSelectionIfFilteredOut();
      this.emitSelection();
    },
    modelValue(value) {
      // Parent reset (e.g. reopening the modal) clears the table selection.
      if (!value && this.selectedRows.length > 0) {
        this.selectedRows = [];
      }
    },
  },
  methods: {
    /**
     * Human-readable label for a document type.
     * @param {number} type - Document type enum value
     * @returns {string}
     */
    typeLabel(type) {
      if (type === DOC_TYPE_PDF) {
        return this.$t("dashboard.adminTools.replaceDocumentFile.typePdf");
      }
      if (type === DOC_TYPE_ZIP) {
        return this.$t("dashboard.adminTools.replaceDocumentFile.typeZip");
      }
      return this.$t("dashboard.adminTools.replaceDocumentFile.typeUnknown");
    },

    /**
     * Clear selection when the selected document is no longer in the filtered table.
     * @returns {void}
     */
    clearSelectionIfFilteredOut() {
      if (!this.selectedRows || this.selectedRows.length === 0) {
        return;
      }
      const id = Number(this.selectedRows[0].id);
      if (!this.tableData.some((doc) => Number(doc.id) === id)) {
        this.selectedRows = [];
      }
    },

    /**
     * Emit the currently selected document row (resolved against fresh table data), or null.
     * @returns {void}
     */
    emitSelection() {
      let selected = null;
      if (this.selectedRows && this.selectedRows.length > 0) {
        const row = this.selectedRows[0];
        const id = Number(row.id);
        selected = this.tableData.find((doc) => Number(doc.id) === id) || row;
      }
      if (selected !== this.modelValue) {
        this.$emit("update:modelValue", selected);
      }
    },
  },
};
</script>
