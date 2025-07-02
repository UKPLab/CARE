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
      <BasicButton
        class="btn-success btn-sm ms-1"
        text="Grading with LLMentor"
        title="Grading with LLMentor"
        @click="gradeWithLLMentor" 
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
  <GradingModal
    ref="gradingModal"
    @submit="submitGrading"
  />
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./review/UploadModal.vue";
import ImportModal from "./review/ImportModal.vue";
import PublishModal from "./review/PublishModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import GradingModal from "@/basic/modal/GradingModal.vue";

/**
 * Submission list component
 *
 * This component loads the documents for review from the server
 * and provide two ways to import documents: one is via manually importing;
 * the other is via importing from Moodle API.
 * @author Linyin Huang, Dennis Zyska
 */
export default {
  name: "Submissions",
  subscribeTable: [{
    table: "document",
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
    GradingModal,
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
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    documentsTable() {
      return this.documents.map((d) => {
        let newD = {...d};
        newD.type = d.type === 0 ? "PDF" : "HTML";
        const user = this.$store.getters["table/user/get"](d.userId)
        newD.firstName = (user) ? user.firstName : "Unknown";
        newD.lastName = (user) ? user.lastName : "Unknown";
        return newD;
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
    gradeWithLLMentor() {
      this.$refs.gradingModal.open();
    },
    submitGrading(selectedSkill) {
      this.$socket.emit("llmentorGradeAll", {
        documentIds: this.documents.map((d) => d.id),
        skill: selectedSkill,
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Triggered",
            message: "Grading has been started for all review documents.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>
