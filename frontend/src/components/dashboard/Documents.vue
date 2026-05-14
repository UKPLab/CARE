<template>
  <Card :title="$t('documents.title')">
    <template #headerElements>
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
    <template #body>
      <BasicTable
          :columns="columns"
          :data="docs"
          :options="options"
          :buttons="buttons"
          :max-table-height="'65vh'"
          @action="action"
      />
      <EditorDownload ref="editorDownload"/>
    </template>
  </Card>
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
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import StudyModal from "./coordinator/Study.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./documents/UploadModal.vue";
import CreateModal from "./documents/CreateModal.vue";
import EditModal from "./documents/EditModal.vue";
import EditorDownload from "@/components/editor/editor/EditorDownload.vue";
import DownloadPDFModal from "./documents/DownloadPDFModal.vue";
import { resolveApiMessage } from "@/assets/utils";

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
    Card,
    BasicTable,
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
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
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
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: this.$t('documents.accessDocument'),
          action: "accessDoc",
          stats:{
            documentId: "id",
          }
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
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
          title: this.$t('documents.deleteDocument'),
          action: "deleteDoc",
          stats:{
            documentId: "id",
          }
        },
        {
          icon: "cloud-arrow-up",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
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
          title: this.$t('documents.publishDocument'),
          action: "publicDoc",
          stats:{
            documentId: "id",
          }
        },
        {
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
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
          title: this.$t('documents.renameDocument'),
          action: "renameDoc",
          stats:{
            documentId: "id",
          }
        },
      ];
      if (this.studiesEnabled) {
        buttons.push({
          icon: "person-workspace",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          filter: [
            {
              key: "type",
              value: 0,
            },
          ],
          title: this.$t('documents.openStudyCoordinator'),
          action: "openStudyCoordinator",
          stats: {
            documentId: "id",
          }
        });
      }
      if (this.showDeltaDownloadButton) {
        buttons.push({
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          filter: [
            {
              key: "type",
              value: 1,
            }],
          title: this.$t('documents.exportDelta'),
          action: "exportDeltaDoc",
          stats: {
            documentId: "id",
          } 
        });
      }
      if (this.showHTMLDownloadButton) {
        buttons.push({
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          filter: [
            {
              key: "type",
              value: 1,
            }],
          title: this.$t('documents.exportHtml'),
          action: "exportHTMLDoc",
          stats: {
            documentId: "id",
          }
        });
      }
      if (this.showPDFDownloadButton) {
        buttons.push({
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          filter: [
            {
            key: "type",
            value: 0,
          }
        ],
        title: this.$t('documents.downloadPdfWithAnnotations'),
        action: "exportWithAnnotations",
      });
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
              class: newD.public ? "bg-success" : "bg-danger",
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

      this.$refs.deleteConf.open(
          this.$t('documents.messages.deleteTitle'),
          this.$t('documents.messages.deleteConfirm'),
          warning,
          function (val) {
            if (val) {
              this.$socket.emit("appDataUpdate", {
                table: "document",
                data: {
                  id: row.id,
                  deleted: true
                }
              }, (result) => {
                if (!result.success) {
                  this.eventBus.emit('toast', {
                    title: this.$t('errors.documents.deleteFailed'),
                    message: resolveApiMessage(result),
                    variant: "danger"
                  });
                }
              });
            }
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

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>
