<template>
  <span>
  <StudyModal ref="studyCoordinator"/>
  <BasicModal
    ref="savedTemplatesModal"
    name="savedTemplatesModal"
    size="lg"
  >
    <template #title>
      <h5 class="modal-title">Saved Templates</h5>
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="savedTemplates"
        :options="tableOptions"
        :buttons="tableButtons"
        :max-table-height="'60vh'"
        @action="handleAction"
      >
        <template #additional-buttons>
          <BasicButton
            class="btn btn-outline-secondary btn-sm"
            icon="upload"
            text=""
            title="Import Template"
            @click="openImport"
          />
          <BasicButton
            class="btn btn-outline-secondary btn-sm"
            icon="download"
            text=""
            title="Export All Templates"
            @click="$refs.exportFormatModal.open(null, 'study', 'study_step')"
          />
        </template>
      </BasicTable>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          title="Close"
          @click="close"
        />
        <BasicButton
          class="btn btn-primary"
          title="Create Template"
          @click="createTemplate"
        />
      </span>
    </template>
  </BasicModal>
  <ConfirmModal ref="deleteConf"/>
  <ImportFormatModal
    ref="importFormatModal"
    title="Import Study Templates"
  />
  <ExportFormatModal
    ref="exportFormatModal"
    title="Export Study Template"
  />
</span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
/**
 * Modal to show saved study templates
 * 
 * This modal allows users to view, use, and delete saved study templates.
 * Users can browse through their saved templates, delete unwanted ones,
 * and use existing templates to create new studies with pre-configured settings.
 * 
 * @author: Karim Ouf
 */
export default {
  name: "SavedTemplatesModal",
  components: { BasicModal, BasicTable, BasicButton, StudyModal, ConfirmModal, ImportFormatModal, ExportFormatModal },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      columns: [
        { name: "Name", key: "name" },
        { name: "Created At", key: "createdAt", sortable: true },
        {
          name: "Resumable",
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: "Collaborative",
          key: "collab",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: "Multiple Submissions",
          key: "multipleSubmit",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
      ],
      tableButtons: [
        dashboardRowAction("delete", {
          title: "Delete",
          filter: [
            {key: "showDeleteTemplateButton", value: true},
          ],
          action: "deleteTemplate",
        }),
        dashboardRowAction("resume", {
          title: "Use",
          action: "useTemplate",
        }),
        dashboardRowAction("download", {
          title: "Export",
          action: "exportTemplate",
        }),
      ],
    };
  },
  computed:{
    savedTemplates() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.template === true).map((s) => {
        return {
          id: s.id,
          name: s.name,
          createdAt: new Date(s.createdAt).toLocaleDateString(),
          resumable: s.resumable,
          collab: s.collab,
          multipleSubmit: s.multipleSubmit,
          showDeleteTemplateButton: this.showDeleteTemplateButton,
        };
      });
    },
    showDeleteTemplateButton() {
      return this.$store.getters["auth/checkRight"]("study.template.delete");
    }
  },
  methods: {
    open() {
      this.$refs.savedTemplatesModal.open();
    },
    close() {
      this.$refs.savedTemplatesModal.close();
    },
    handleAction({ action, params }) {
      if (action === "deleteTemplate") {
        this.deleteTemplate(params);
      } else if (action === "useTemplate") {
        this.useTemplate(params);
      } else if (action === "exportTemplate") {
        this.exportTemplate(params);
      }
    },
    exportTemplate(template) {
      this.$refs.exportFormatModal.open(template.id, "study", "study_step");
    },
    deleteTemplate(template) {
      this.close();
      this.$refs.deleteConf.open(
        "Delete Template",
        "Are you sure you want to delete this template?",
        "",
        (val) => {
          if (val) {
            this.$socket.emit("appDataUpdate", {
              table: "study",
              data: {
                id: template.id,
                deleted: true
              }
            }, (result) => {
              if (result.success) {
                this.eventBus.emit('toast', {
                  title: "Study template deleted",
                  message: "The study template has been deleted",
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: "Study template deletion failed",
                  message: result.message,
                  variant: "danger"
                });
              }
            });
          }
          this.$nextTick(() => this.open());
        }
      );
    },
    useTemplate(template) {
      this.close();
      this.$refs.studyCoordinator.open(template.id, null, false, false, true);
    },
    openImport() {
      this.$refs.importFormatModal.open("study", "study_step", {
        socket: {
          name: "studySaveAsTemplate",
          dataKey: "templateData",
          extra: { onlyTemplate: true },
        },
      });
    },
    createTemplate() {
      this.close();
      this.$refs.studyCoordinator.open(0, null, false, true, false);
    },
  },
};
</script>

<style scoped>
.modal-title {
  font-weight: bold;
}
</style>
