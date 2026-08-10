<template>
  <Modal
      ref="replaceModal"
      name="replaceDocumentFile"
      size="xl"
  >
    <template #title>
      Replace document file
    </template>

    <template #body>
      <div class="modal-body">
        <div
            v-if="replacing"
            class="d-flex justify-content-center m-5"
        >
          <div
              class="spinner-border"
              role="status"
          >
            <span class="visually-hidden">Replacing...</span>
          </div>
        </div>

        <div v-else>
          <p class="mb-3">
            Upload a new PDF or ZIP to overwrite the file stored for an existing document.
            The document keeps the same title, id, and links; only the file bytes change.
            The uploaded file type must match the document type.
            For PDFs, existing CARE annotations and comments on that document are removed.
          </p>

          <div class="mb-3">
            <label
                class="form-label"
                for="replace-doc-type-filter"
            >Type</label>
            <select
                id="replace-doc-type-filter"
                v-model="typeFilter"
                class="form-select"
            >
              <option value="all">All (PDF &amp; ZIP)</option>
              <option value="pdf">PDF only</option>
              <option value="zip">ZIP only</option>
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
              v-if="selectedDocument"
              class="small text-muted mt-2 mb-3"
          >
            Selected:
            <strong>{{ selectedDocument.name || "(unnamed)" }}</strong>
            (#{{ selectedDocument.id }}, {{ selectedDocument.typeName }}).
          </p>
          <p
              v-else
              class="small text-muted mt-2 mb-3"
          >
            Select one document in the table (10 per page; use search or next page for more).
          </p>

          <BasicForm
              v-model="formData"
              :fields="fileFields"
              @file-change="handleFileChange"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div
          v-if="!replacing"
          class="btn-group"
      >
        <BasicButton
            class="btn btn-secondary"
            text="Close"
            title="Close"
            @click="$refs.replaceModal.close()"
        />
        <BasicButton
            class="btn btn-primary"
            text="Replace file"
            title="Replace file"
            :disabled="!canSubmit"
            @click="replace"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";

const DOC_TYPE_PDF = 0;
const DOC_TYPE_ZIP = 4;

const TYPE_EXTENSION = {
  [DOC_TYPE_PDF]: ".pdf",
  [DOC_TYPE_ZIP]: ".zip",
};

/**
 * Modal to replace an existing document's PDF or ZIP file on disk.
 *
 * @author Mohammad Elwan
 */
export default {
  name: "ReplaceDocumentFileModal",
  subscribeTable: ["document"],
  components: {
    Modal,
    BasicButton,
    BasicForm,
    BasicTable,
  },
  data() {
    return {
      replacing: false,
      typeFilter: "all",
      selectedRows: [],
      selectedFile: null,
      formData: {
        file: null,
      },
      columns: [
        {name: "ID", key: "id", sortable: true},
        {name: "Title", key: "name", sortable: true, multiline: true},
        {name: "Type", key: "typeName", sortable: true},
      ],
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
            name: doc.name || "(unnamed)",
            typeName: this.typeLabel(doc.type),
          }));
    },
    selectedDocument() {
      if (!this.selectedRows || this.selectedRows.length === 0) {
        return null;
      }
      const selected = this.selectedRows[0];
      const id = Number(selected.id);
      return this.tableData.find((doc) => Number(doc.id) === id) || selected;
    },
    fileFields() {
      return [
        {
          key: "file",
          type: "file",
          label: "Replacement file",
          accept: this.selectedDocument
              ? TYPE_EXTENSION[this.selectedDocument.type]
              : this.acceptForFilter,
          class: "form-control",
          default: null,
        },
      ];
    },
    acceptForFilter() {
      if (this.typeFilter === "pdf") {
        return ".pdf";
      }
      if (this.typeFilter === "zip") {
        return ".zip";
      }
      return ".pdf,.zip";
    },
    canSubmit() {
      return Boolean(this.selectedDocument && this.selectedFile);
    },
  },
  watch: {
    typeFilter() {
      this.clearSelectionIfFilteredOut();
    },
    tableData() {
      this.clearSelectionIfFilteredOut();
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
        return "PDF";
      }
      if (type === DOC_TYPE_ZIP) {
        return "ZIP";
      }
      return "Unknown";
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
      const stillVisible = this.tableData.some((doc) => Number(doc.id) === id);
      if (!stillVisible) {
        this.selectedRows = [];
      }
    },

    /**
     * Store the selected replacement file from the form upload control.
     * @param {File} file - The file chosen by the user, or null when cleared
     * @returns {void}
     */
    handleFileChange(file) {
      this.selectedFile = file || null;
    },

    /**
     * Open the modal and reset form state.
     * @returns {void}
     */
    open() {
      this.replacing = false;
      this.typeFilter = "all";
      this.selectedRows = [];
      this.selectedFile = null;
      this.formData = {
        file: null,
      };
      this.$refs.replaceModal.open();
    },

    /**
     * Validate client-side type match and emit documentReplaceFile.
     * @returns {void}
     */
    replace() {
      if (!this.canSubmit) {
        return;
      }

      const expectedExtension = TYPE_EXTENSION[this.selectedDocument.type];
      const fileName = this.selectedFile.name || "";
      const fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      if (fileExtension !== expectedExtension) {
        this.eventBus.emit("toast", {
          title: "Type mismatch",
          message: `Document is ${this.typeLabel(this.selectedDocument.type)}; please upload a ${expectedExtension} file.`,
          variant: "danger",
        });
        return;
      }

      this.replacing = true;
      this.$refs.replaceModal.waiting = true;

      const documentId = Number(this.selectedDocument.id);
      const documentName = this.selectedDocument.name || "(unnamed)";

      this.$socket.emit("documentReplaceFile", {
        documentId,
        file: this.selectedFile,
        name: fileName,
      }, (res) => {
        this.replacing = false;
        this.$refs.replaceModal.waiting = false;

        if (res.success) {
          this.eventBus.emit("toast", {
            title: "File replaced",
            message: `Updated file for “${documentName}” (#${documentId}).`,
            variant: "success",
          });
          this.$refs.replaceModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Replace failed",
            message: res.message || "Could not replace document file.",
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
</style>
