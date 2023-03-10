<template>
  <PublishModal ref="publishModal" />
  <StudyModal ref="studyCoordinator" />
  <Card title="Documents">
    <template #headerElements>
      <button
        class="btn btn-sm me-1 btn-secondary"
        type="button"
        title="Export"
        @click="exportAll()"
      >
        <LoadIcon
          icon-name="cloud-arrow-down"
        />
        Export all
      </button>
      <Upload @addedDoc="onAddedDoc" />
    </template>
    <template #body>
      <Table
        :columns="columns"
        :data="docs"
        :options="options"
        @action="action"
      />
    </template>
  </Card>
  <ExportAnnos ref="export" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import {mapGetters} from "vuex";
import Upload from "./documents/Upload.vue";
import PublishModal from "./documents/PublishModal.vue";
import ExportAnnos from "@/basic/download/ExportAnnos.vue";
import Card from "@/basic/Card.vue";
import Table from "@/basic/table/Table.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import StudyModal from "./study/StudyModal.vue";
import ConfirmModal from "@/basic/ConfirmModal.vue";

/* Documents.vue - document list component

This component loads the user-specific documents from the server
and allows to interact with them. The user can delete existing
documents or access the annotator view for the respective pdf.

Author: Nils Dycke (dycke@ukp...)
Co-Author:  Dennis Zyska (zyska@ukp...)
Source: -
*/
export default {
  name: "Document",
  components: {StudyModal, Upload, ExportAnnos, Card, LoadIcon, Table, PublishModal, ConfirmModal},
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
        {
          name: "Public",
          key: "public",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {name: "Manage", key: "manage", type: "button-group"},
      ]
    }
  },
  mounted() {
    this.$socket.emit("documentGetAll");
    this.$socket.emit("studyGetAll", {userId: this.$store.getters["auth/getUserId"]});
  },
  computed: {
    documents() {
      return this.$store.getters["document/getDocuments"];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    docs() {
      return this.documents.filter(doc => doc.userId === this.userId).map(d => {
        let newD = {... d};
        newD.manage = [
          {
            icon: "box-arrow-in-right",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              }
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
              }
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
              }
            },
            title: "Publish document...",
            action: "publicDoc",
          }
          /*
        {
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Rename document...",
          onClick: this.renameDoc,
        },  */
        ];
        if (this.studiesEnabled) {
          newD.manage.push({
            icon: "person-workspace",
            options: {
              iconOnly: true,
              specifiers: {
                "btn-outline-secondary": true,
              }
            },
            title: "Open study coordinator...",
            action: "studyCoordinator",
          });
        }
        return newD;
      });
    },
    studiesEnabled() {
      return this.$store.getters["settings/getValue"]('app.study.enabled') === "true";
    },
    ...mapGetters({reviews: 'user/getReviews'})
  },
  methods: {
    action(data) {
      switch(data.action){
        case "accessDoc":
          this.accessDoc(data.params);
          break;
        case "deleteDoc":
          this.deleteDoc(data.params);
          break;
        case "publicDoc":
          this.$refs.publishModal.open(data.params.id);
          break;
        case "studyCoordinator":
          this.studyCoordinator(data.params);
          break;
      }
    },
    async deleteDoc(row) {
      const studies = this.$store.getters["study/getStudiesByDocument"](row.id);
      let warning;
      if(studies && studies.length > 0){
        warning = ` There ${studies.length !== 1 ? 'are' : 'is'} currently ${studies.length} ${studies.length !== 1 ? 'studies' : 'study'}
         running on this document. Deleting it will delete the ${studies.length !== 1 ? 'studies' : 'study'}!`
      } else {
        warning = "";
      }

      this.$refs.deleteConf.open(
          "Delete Document",
          "Are you sure you want to delete the document?",
          warning,
          function(val) {
            if(val){
              this.$socket.emit("documentUpdate", {documentId: row.id, deleted: true});
            }
      });
    },
    renameDoc(row) {
      this.$socket.emit("documentUpdate", {documentId: row.id, document: {name: "default_name"}});
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
      const doc_ids = this.docs.map(i => i.id);
      this.$refs.export.requestExport(doc_ids, "json");
    },
    studyCoordinator(row) {
      this.$refs.studyCoordinator.open(0, row.id);
    }
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>