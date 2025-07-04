<template>
  <Card title="Submissions">
    <template #headerElements>
      <BasicButton
        class="btn-secondary btn-sm me-1"
        text="Publish Reviews"
        title="Publish Reviews"
        @click="$refs.publishModal.open()"
      />
      <BasicButton
        class="btn-secondary btn-sm me-1"
        text="Manual Import"
        title="Manual Import"
        @click="$refs.uploadModal.open()"
      />
      <BasicButton
        class="btn-primary btn-sm"
        title="Import via Moodle"
        text="Import via Moodle"
        @click="$refs.importModal.open()"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="tableColumns"
        :data="documentsTable"
        :options="tableOptions"
        :buttons="tableButtons"
        @action="action"
      />
    </template>
  </Card>
  <UploadModal
    ref="uploadModal"
  />
  <ConfirmModal ref="deleteConf"/>
  <ImportModal
    ref="importModal"
  />
  <PublishModal ref="publishModal" />
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./review/UploadModal.vue";
import ImportModal from "./review/ImportModal.vue";
import PublishModal from "./review/PublishModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

/**
 * Submission list component
 *
 * This component loads the submission documents for review from the server
 * and provide two ways to import submission documents: one is via manually importing;
 * the other is via importing from Moodle API.
 * @author Linyin Huang, Dennis Zyska, Yiwei Wang
 */
export default {
  name: "Submissions",
  subscribeTable: [{
    table: "submission",
    filter: [{
      key: "readyForReview",
      value: true
    }],
    include: [{
      table: "user",
      by: "userId",
    }]
  }],
  components: {
    UploadModal,
    ImportModal,
    ConfirmModal,
    PublishModal,
    Card,
    BasicTable,
    BasicButton,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      tableColumns: [
        {name: "Title", key: "name"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Created At", key: "createdAt"},
        {name: "Type", key: "type"},
      ],
      tableButtons: [
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
      ]
    };
  },
  computed: {
    submissions() {
      // at the moment no readyForReview flag – return all
      return this.$store.getters["table/submission/getAll"];
    },
    documentsTable() {
      /* Build one row per submission: pick the main PDF document (if any) to
       * drive "title", "type" and link/hash.  If none found we still list the
       * submission but leave document-specific columns blank.
       */
      return this.submissions.map((s) => {
        const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === s.id);

        // heuristic: choose first PDF as main document
        const mainDoc = docs.find((d) => d.type === 0) || docs[0] || {};

        const user = this.$store.getters["table/user/get"](s.userId);

        return {
          id: s.id,
          name: mainDoc.name || "—",              // Title column
          firstName: user ? user.firstName : "Unknown",
          lastName: user ? user.lastName : "Unknown",
          createdAt: new Date(s.createdAt).toLocaleDateString(),
          type: mainDoc.type === 0 ? "PDF" : (mainDoc.type === 1 ? "HTML" : "—"),
          hash: mainDoc.hash || null,              // for accessDoc()
        };
      });
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

      this.$refs.deleteConf.open("Delete Document", "Are you sure you want to delete the document?", warning, (val) => {
        if (val) {
          this.$socket.emit("documentUpdate", {
            id: row.id,
            deleted: true,
          }, (res) => {
            if (res.success) {
              this.eventBus.emit("toast", {
                title: "Document deleted",
                message: "The document has been deleted",
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: "Failed to delete document",
                message: res.message,
                variant: "danger",
              });
            }
          });
        }
      });
    },
    accessDoc(row) {
      this.$router.push(`/document/${row.hash}`);
    },
  },
};
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>
