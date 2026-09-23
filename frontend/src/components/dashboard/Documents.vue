<template>
  <DashboardListPage
    :title="$t('documents.title')"
    :columns="columns"
    :data="docs"
    :buttons="buttons"
    :table-options="options"
    @action="action"
  >
    <template #headerActions>
      <div class="btn-group gap-2">
      <BasicButton
          class="btn-primary btn-sm"
          :title="$t('documents.addDocument')"
          :text="$t('documents.uploadDocument')"
          icon="upload"
          @click="$refs.uploadModal.open()"
      />
      <BasicButton
          v-if="showCreateButton"
          class="btn-primary btn-sm"
          :title="$t('documents.createDocument')"
          :text="$t('documents.createDocument')"
          icon="file-earmark-plus"
          @click="$refs.createModal.open()"
      />
      </div>
    </template>
    <template #afterTable>
      <EditorDownload ref="editorDownload"/>
    </template>
  </DashboardListPage>
  <PublishModal ref="publishModal"/>
  <StudyModal ref="studyCoordinator"/>
  <ConfirmModal ref="deleteConf"/>
  <UploadModal ref="uploadModal"/>
  <CreateModal ref="createModal"/>
  <EditModal ref="editModal"/>
  <DownloadPDFModal ref="pdfDownloadModal"/>
</template>

<script>
import PublishModal from "./documents/PublishModal.vue";
import StudyModal from "./coordinator/Study.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./documents/UploadModal.vue";
import CreateModal from "./documents/CreateModal.vue";
import EditModal from "./documents/EditModal.vue";
import EditorDownload from "@/components/editor/editor/EditorDownload.vue";
import DownloadPDFModal from "./documents/DownloadPDFModal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { DEFAULT_DASHBOARD_TABLE_OPTIONS } from "@/basic/dashboard/constants.js";
import { DASHBOARD_BADGES, dashboardRowAction, dashboardRowButton, confirmSoftDelete } from "@/basic/dashboard/actions.js";

/**
 * Document list component
 *
 * This component loads the user-specific documents from the server
 * and allows to interact with them. The user can delete existing
 * documents or access the annotator view for the respective pdf.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "DashboardDocument",
  subscribeTable: ["document", "study", "template"],
  components: {
    StudyModal,
    UploadModal,
    DashboardListPage,
    BasicButton,
    PublishModal,
    ConfirmModal,
    EditModal,
    CreateModal,
    EditorDownload,
    DownloadPDFModal,
  },
  data() {
    return {
      options: {...DEFAULT_DASHBOARD_TABLE_OPTIONS},
    };
  },
  computed: {
    columns() {
      return [
        {name: this.$t('common.id'), key: "id"},
        {
          name: this.$t('common.title'),
          key: "name",
          multiline: true,
          width: 5,
        },
        {name: this.$t('common.createdAt'), key: "createdAt"},
        {name: this.$t('common.type'), key: "typeName"},
        {
          name: this.$t('common.public'),
          key: "publicBadge",
          type: "badge",
        },
      ];
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](
          (doc) => doc.projectId === this.projectId && doc.type !== 4
      );
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    buttons() {
      const buttons = [
        dashboardRowAction("open", {
          title: this.$t('documents.accessDocument'),
          action: "accessDoc",
          stats:{
            documentId: "id",
          }
        }),
        dashboardRowAction("delete", {
          title: this.$t('documents.deleteDocument'),
          action: "deleteDoc",
          filter: [
            {
              key: "uploadedByUserId",
              value: this.userId,
            },
            {
              key: "uploadedByUserId",
              value: null
            }
          ],
          stats:{
            documentId: "id",
          }
        }),
        dashboardRowAction("publish", {
          title: this.$t('documents.publishDocument'),
          action: "publicDoc",
          filter: [
            {
              key: "uploadedByUserId",
              value: this.userId,
            },
            {
              key: "uploadedByUserId",
              value: null
            }
          ],
          stats:{
            documentId: "id",
          }
        }),
        dashboardRowAction("edit", {
          title: this.$t('documents.renameDocument'),
          action: "renameDoc",
          filter: [
            {
              key: "uploadedByUserId",
              value: this.userId,
            },
            {
              key: "uploadedByUserId",
              value: null
            }
          ],
          stats:{
            documentId: "id",
          }
        }),
      ];
      if (this.studiesEnabled) {
        buttons.push(dashboardRowButton("person-workspace", {
          title: this.$t('documents.openStudyCoordinator'),
          action: "openStudyCoordinator",
          filter: [
            {
              key: "type",
              value: 0,
            },
          ],
          stats: {
            documentId: "id",
          }
        }));
      }
      if (this.showDeltaDownloadButton) {
        buttons.push(dashboardRowAction("exportDelta", {
          title: this.$t('documents.exportDelta'),
          action: "exportDeltaDoc",
          filter: [
            {
              key: "type",
              value: 1,
            }],
          stats: {
            documentId: "id",
          }
        }));
      }
      if (this.showHTMLDownloadButton) {
        buttons.push(dashboardRowAction("exportHtml", {
          title: this.$t('documents.exportHtml'),
          action: "exportHTMLDoc",
          filter: [
            {
              key: "type",
              value: 1,
            }],
          stats: {
            documentId: "id",
          }
        }));
      }
      if (this.showPDFDownloadButton) {
        buttons.push(dashboardRowAction("exportPdf", {
          title: this.$t('documents.downloadPdfWithAnnotations'),
          action: "exportWithAnnotations",
          filter: [
            {
            key: "type",
            value: 0,
          }
        ],
        }));
      }
      return buttons;
    },
    docs() {
      return this.documents
          .filter((doc) => doc.userId === this.userId && doc.parentDocumentId === null && doc.hideInFrontend === false && doc.type !== 3)
          .map((d) => {
            let newD = {...d};
            newD.typeName = d.type === 0 ? this.$t('documents.types.pdf') : d.type === 1 ? this.$t('documents.types.html') : this.$t('documents.types.modal');
            newD.publicBadge = {
              class: DASHBOARD_BADGES.publicPrivate[!!newD.public],
              text: newD.public ? this.$t('common.yes') : this.$t('common.no'),
            };
            return newD;
          });
    },
    studiesEnabled() {
      return (
          this.$store.getters["settings/getValue"]("app.study.enabled") === "true"
      );
    },
    showCreateButton() {
      return this.$store.getters["settings/getValue"]('editor.document.showButtonCreate') === 'true';
    },
    showDeltaDownloadButton() {
      return this.$store.getters["settings/getValue"]('editor.document.showButtonDeltaDownload') === 'true';
    },
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]('editor.document.showButtonHTMLDownload') === 'true';
    },
    showPDFDownloadButton() {
      return this.$store.getters["settings/getValue"]('editor.document.showButtonPDFDownload') === 'true'
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "accessDoc":
          this.accessDoc(data.params);
          break;
        case "deleteDoc":
          this.deleteDoc(data.params);
          break;
        case "publicDoc":
          this.$refs.publishModal.open(data.params.id);
          break;
        case "renameDoc":
          this.renameDoc(data.params);
          break;
        case "openStudyCoordinator":
          this.openStudyCoordinator(data.params);
          break;
        case "exportDeltaDoc":
          this.$refs.editorDownload.exportDeltaDoc(data.params);
          break;
        case "exportHTMLDoc":
          this.$refs.editorDownload.exportHTMLDoc(data.params);
          break;
        case "exportWithAnnotations":
          this.$refs.pdfDownloadModal.open(data.params);
          break;
      }
    },
    async deleteDoc(row) {
      const studies = this.$store.getters["table/study/getFiltered"](
          (e) => e.documentId === row.id
      );
      let warning;
      if (studies && studies.length > 0) {
        warning = this.$t('documents.messages.studyWarning', { count: studies.length });
      } else {
        warning = "";
      }

      confirmSoftDelete(
        {
          confirmRef: this.$refs.deleteConf,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "document",
          id: row.id,
          title: this.$t('documents.messages.deleteTitle'),
          message: this.$t('documents.messages.deleteConfirm'),
          warning,
          failTitle: this.$t('errors.documents.deleteFailed'),
        }
      );
    },
    renameDoc(row) {
      this.$refs.editModal.open(row.id);
    },
    accessDoc(row) {
      this.$router.push(`/document/${row.hash}`);
    },
    onAddedDoc() {
      this.load();
    },
    publishDoc(row) {
      this.$refs.publishModal.open(row.id);
    },
    openStudyCoordinator(row) {
      this.$refs.studyCoordinator.open(0, row.id);
    },
  },
};
</script>

<style scoped></style>
