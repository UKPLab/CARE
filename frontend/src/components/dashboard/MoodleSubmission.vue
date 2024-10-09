<template>
  <Card title="Moodle Submission">
    <!-- Header Starts -->
    <template #headerElements>
      <BasicButton
        class="btn-secondary btn-sm me-1"
        text="Manual Import"
        title="Manual Import"
        @click="exportAll()"
      />
      <BasicButton
        class="btn-primary btn-sm"
        title="Import via Moodle"
        text="Import via Moodle"
        @click="$refs.uploadModal.open()"
      />
    </template>
    <!-- Header Ends -->
    <!-- Body Starts -->
    <template #body>
      <BasicTable
        :columns="columns"
        :data="docs"
        :options="options"
        @action="action"
      />
      <EditorDownload ref="editorDownload" />
    </template>
    <!-- Body Ends -->
  </Card>
  <PublishModal ref="publishModal" />
  <StudyModal ref="studyCoordinator" />
  <ExportAnnos ref="export" />
  <ConfirmModal ref="deleteConf" />
  <UploadModal ref="uploadModal" />
  <EditModal ref="editModal" />
</template>

<script>
import PublishModal from "./documents/PublishModal.vue";
import ExportAnnos from "@/basic/download/ExportAnnos.vue";
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/table/Table.vue";
import StudyModal from "./coordinator/Study.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./documents/UploadModal.vue";
import EditModal from "./documents/EditModal.vue";
import EditorDownload from "@/components/editor/EditorDownload.vue";

/**
 * Submission list component
 * 
 * NOTE: description to be provided
 * 
 * @author Linyin Huang
 */
export default {
  name: "MoodleSubmission",
  fetchData: ["document", "study"],
  components: {
    StudyModal,
    ExportAnnos,
    UploadModal,
    Card,
    BasicTable,
    BasicButton,
    PublishModal,
    ConfirmModal,
    EditModal,
    EditorDownload,
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
        { name: "Title", key: "name" },
        { name: "Created At", key: "createdAt" },
        { name: "Type", key: "type" },
        {
          name: "Public",
          key: "publicBadge",
          type: "badge",
        },
        { name: "Manage", key: "manage", type: "button-group" },
      ],
    };
  },
  computed: {
    documents() {
      return this.$store.getters["table/document/getAll"];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    docs() {
      return this.documents
        .filter((doc) => doc.userId === this.userId)
        .map((d) => {
          let newD = { ...d };
          newD.type = d.type === 0 ? "PDF" : "HTML";
          newD.publicBadge = {
            class: newD.public ? "bg-success" : "bg-danger",
            text: newD.public ? "Yes" : "No",
          };
          newD.manage = [
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
              title: "Rename document...",
              action: "renameDoc",
            },
          ];
          if (this.studiesEnabled && d.type === 0) {
            //PDF document type
            newD.manage.push({
              icon: "person-workspace",
              options: {
                iconOnly: true,
                specifiers: {
                  "btn-outline-secondary": true,
                },
              },
              title: "Open study coordinator...",
              action: "studyCoordinator",
            });
          }

          if (d.type === 1 && this.showDeltaDownloadButton) {
            //HTML document type
            newD.manage.push({
              icon: "download",
              options: {
                iconOnly: true,
                specifiers: {
                  "btn-outline-secondary": true,
                },
              },
              title: "Export delta to a local file",
              action: "exportDeltaDoc",
            });
          }
          if (d.type === 1 && this.showHTMLDownloadButton) {
            newD.manage.push({
              icon: "download",
              options: {
                iconOnly: true,
                specifiers: {
                  "btn-outline-secondary": true,
                },
              },
              title: "Export HTML to a local file",
              action: "exportHTMLDoc",
            });
          }
          return newD;
        });
    },
    studiesEnabled() {
      return this.$store.getters["settings/getValue"]("app.study.enabled") === "true";
    },
    showDeltaDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.document.showButtonDeltaDownload") === "true";
    },
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.document.showButtonHTMLDownload") === "true";
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
      }
    },
    async deleteDoc(row) {
      const studies = this.$store.getters["table/study/getFiltered"]((e) => e.documentId === row.id);
      let warning;
      if (studies && studies.length > 0) {
        warning = ` There ${studies.length !== 1 ? "are" : "is"} currently ${studies.length} ${
          studies.length !== 1 ? "studies" : "study"
        }
         running on this document. Deleting it will delete the ${studies.length !== 1 ? "studies" : "study"}!`;
      } else {
        warning = "";
      }

      this.$refs.deleteConf.open(
        "Delete Document",
        "Are you sure you want to delete the document?",
        warning,
        function (val) {
          if (val) {
            this.$socket.emit("documentUpdate", {
              documentId: row.id,
              deleted: true,
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
    exportAll() {
      const docIds = this.docs.map((i) => i.id);
      this.$refs.export.requestExport(docIds, "json");
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
