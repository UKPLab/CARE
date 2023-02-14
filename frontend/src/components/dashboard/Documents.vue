<template>
  <PublishModal ref="publishModal"></PublishModal>
  <StudyModal ref="studyCoordinator"></StudyModal>
  <Card title="Documents">
    <template v-slot:headerElements>
      <button class="btn btn-sm me-1 btn-secondary" type="button" @click="exportAll()" title="Export">
        <LoadIcon iconName="cloud-arrow-down" @click=""></LoadIcon>
        Export all
      </button>
      <Upload @addedDoc="onAddedDoc"></Upload>
    </template>
    <template v-slot:body>
      <Table :columns="columns" :data="docs" :options="options" @action="action"></Table>
    </template>
  </Card>
  <ExportAnnos ref="export"></ExportAnnos>
  <ConfirmModal ref="deleteConf"></ConfirmModal>
</template>

<script>
/* Documents.vue - document list component

This component loads the user-specific documents from the server
and allows to interact with them. The user can delete existing
documents or access the annotator view for the respective pdf.

Author: Nils Dycke (dycke@ukp...)
Co-Author:  Dennis Zyska (zyska@ukp...)
Source: -
*/
import {mapGetters} from "vuex";
import Upload from "./documents/Upload.vue";
import PublishModal from "./documents/PublishModal.vue";
import ExportAnnos from "@/basic/download/ExportAnnos.vue";
import Card from "@/basic/Card.vue";
import Table from "@/basic/table/Table.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import StudyModal from "./study/StudyModal.vue";
import ConfirmModal from "@/basic/ConfirmModal.vue";

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
        d.manage = [
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
          d.manage.push({
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
        return d;
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
      this.$refs.deleteConf.open(
          "Delete Document",
          "Are you sure you want to delete the document?",
          function(val) {
            if(val){
              this.$socket.emit("documentUpdate", {documentId: row.id, deleted: true, deletedAt: Date.now()});
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
      console.log(row);
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