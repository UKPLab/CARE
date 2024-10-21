<template>
  <Card title="Review Documents">
    <!-- Header Starts -->
    <template #headerElements>
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
        @click="$refs.importModal.openModal()"
      />
    </template>
    <!-- Header Ends -->
    <!-- Body Starts -->
    <template #body>
      <BasicTable
        :columns="tableColumns"
        :data="documents"
        :options="tableOptions"
        @action="action"
      />
    </template>
    <!-- Body Ends -->
  </Card>
  <UploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
  <ImportModal ref="importModal" />
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/table/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./review/UploadModal.vue";
import ImportModal from "./review/ImportModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

/**
 * Submission list component
 *
 * TODO: description to be provided
 *
 * @author Linyin Huang
 */
export default {
  name: "ReviewDocuments",
  fetchData: ["document", "study"],
  components: {
    UploadModal,
    ImportModal,
    ConfirmModal,
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
        { name: "Title", key: "name" },
        { name: "Created At", key: "createdAt" },
        { name: "Type", key: "type" },
        { name: "Manage", key: "manage", type: "button-group" },
      ],
    };
  },
  computed: {
    documents() {
      return this.$store.getters["table/document/getAll"].map((d) => {
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
        ];
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
    accessDoc(row) {
      this.$router.push(`/document/${row.hash}`);
    },
    onAddedDoc() {
      this.load();
    },
  },
};
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>
