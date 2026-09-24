<template>
  <Modal
      ref="replaceModal"
      name="replaceDocumentFile"
      size="xl"
  >
    <template #title>
      {{ $t('dashboard.adminTools.replaceDocumentFile.modalTitle') }}
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
            <span class="visually-hidden">{{ $t('dashboard.adminTools.replaceDocumentFile.replacing') }}</span>
          </div>
        </div>

        <div v-else>
          <p class="mb-3">
            {{ $t('dashboard.adminTools.replaceDocumentFile.help') }}
          </p>

          <div class="mb-3">
            <label
                class="form-label"
                for="replace-doc-type-filter"
            >{{ $t('dashboard.adminTools.replaceDocumentFile.typeLabel') }}</label>
            <select
                id="replace-doc-type-filter"
                v-model="typeFilter"
                class="form-select"
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
              v-if="selectedDocument"
              class="small text-muted mt-2 mb-3"
          >
            <i18n-t
              keypath="dashboard.adminTools.replaceDocumentFile.selected"
              tag="span"
              :id="selectedDocument.id"
              :type="selectedDocument.typeName"
            >
              <template #name>
                <strong>{{ selectedDocument.name || $t('dashboard.adminTools.replaceDocumentFile.unnamed') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p
              v-else
              class="small text-muted mt-2 mb-3"
          >
            {{ $t('dashboard.adminTools.replaceDocumentFile.selectHint') }}
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
            :text="$t('common.close')"
            :title="$t('common.close')"
            @click="$refs.replaceModal.close()"
        />
        <BasicButton
            class="btn btn-primary"
            :text="$t('dashboard.adminTools.replaceDocumentFile.replaceButton')"
            :title="$t('dashboard.adminTools.replaceDocumentFile.replaceButton')"
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
import { resolveApiMessage } from "@/assets/utils";

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
          label: this.$t("dashboard.adminTools.replaceDocumentFile.fileLabel"),
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
          title: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.typeMismatch.title"),
          message: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.typeMismatch.message", {
            type: this.typeLabel(this.selectedDocument.type),
            extension: expectedExtension,
          }),
          variant: "danger",
        });
        return;
      }

      this.replacing = true;
      this.$refs.replaceModal.waiting = true;

      const documentId = Number(this.selectedDocument.id);
      const documentName = this.selectedDocument.name
        || this.$t("dashboard.adminTools.replaceDocumentFile.unnamed");

      this.$socket.emit("documentReplaceFile", {
        documentId,
        file: this.selectedFile,
        name: fileName,
      }, (res) => {
        this.replacing = false;
        this.$refs.replaceModal.waiting = false;

        if (res.success) {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.success.title"),
            message: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.success.message", {
              name: documentName,
              id: documentId,
            }),
            variant: "success",
          });
          this.$refs.replaceModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.failed.title"),
            message: resolveApiMessage(
              res,
              "dashboard.adminTools.replaceDocumentFile.toasts.failed.fallback",
            ),
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
