<template>
  <Card title="Documents">
    <template #headerElements>
      <BasicButton
          class="btn-primary btn-sm me-1"
          title="Add document"
          text="Add"
          @click="$refs.uploadModal.open()"
      />
      <BasicButton
          v-if="showCreateButton"
          class="btn-primary btn-sm"
          title="Create document"
          text="Create"
          @click="$refs.createModal.open()"
      />
    </template>
    <template #body>
      <BasicTable
          :columns="columns"
          :data="docs"
          :options="options"
          :buttons="buttons"
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
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/Table.vue";
import StudyModal from "./coordinator/Study.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./documents/UploadModal.vue";
import CreateModal from "./documents/CreateModal.vue";
import EditModal from "./documents/EditModal.vue";
import EditorDownload from "@/components/editor/editor/EditorDownload.vue";
import DownloadPDFModal from "./documents/DownloadPDFModal.vue";

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
  subscribeTable: ["document", "study"],
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
      columns: [
        {name: "Title", key: "name"},
        {name: "Created At", key: "createdAt"},
        {name: "Type", key: "typeName"},
        {
          name: "Public",
          key: "publicBadge",
          type: "badge",
        },
      ],
    };
  },
  computed: {
    documents() {
      return this.$store.getters["table/document/getFiltered"](
          (doc) => doc.projectId === this.projectId 
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
          title: "Access document...",
          action: "accessDoc",
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
          title: "Delete document...",
          action: "deleteDoc",
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
          title: "Publish document...",
          action: "publicDoc",
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
          title: "Rename document...",
          action: "renameDoc",
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
          title: "Open study coordinator...",
          action: "studyCoordinator",
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
          title: "Export delta to a local file",
          action: "exportDeltaDoc",
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
          title: "Export HTML to a local file",
          action: "exportHTMLDoc",
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
        title: "Download PDF with annotations",
        action: "exportWithAnnotations",
      });
    }
      return buttons;
    },
    docs() {
      return this.documents
          .filter((doc) => doc.userId === this.userId && doc.parentDocumentId === null && doc.hideInFrontend === false)
          .map((d) => {
            let newD = {...d};
            newD.typeName = d.type === 0 ? "PDF" : d.type === 1 ? "HTML" : "MODAL";
            newD.publicBadge = {
              class: newD.public ? "bg-success" : "bg-danger",
              text: newD.public ? "Yes" : "No",
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
        case "studyCoordinator":
          this.studyCoordinator(data.params);
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
        warning = ` There ${studies.length !== 1 ? "are" : "is"} currently ${
            studies.length
        } ${studies.length !== 1 ? "studies" : "study"}
         running on this document. Deleting it will delete the ${
            studies.length !== 1 ? "studies" : "study"
        }!`;
      } else {
        warning = "";
      }

      this.$refs.deleteConf.open(
          "Delete Document",
          "Are you sure you want to delete the document?",
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
                    title: "Document delete failed",
                    message: result.message,
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
    studyCoordinator(row) {
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