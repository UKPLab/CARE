<template>
  <Card title="Documents">
    <template v-slot:headerElements>
      <button class="btn btn-sm me-1 btn-secondary" title="Export" type="button" @click="exportAll()">
        <LoadIcon iconName="cloud-arrow-down" @click=""></LoadIcon>
        Export all
      </button>
      <Upload @addedDoc="onAddedDoc"></Upload>
    </template>
    <template v-slot:body>
      <Table :columns="columns" :data="docs" :options="options"></Table>
    </template>
  </Card>
  <Export ref="export"></Export>
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
import Export from "../basic/Export.vue";
import Card from "../basic/Card.vue";
import Table from "../basic/Table.vue";
import LoadIcon from "../../icons/LoadIcon.vue";

export default {
  name: "Document",
  components: {Upload, Export, Card, LoadIcon, Table},
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
        {name: "Manage", key: "manage", type: "button-group"},
      ]
    }
  },
  props: {
    'admin': {
      required: false,
      default: false
    },
  },
  mounted() {
    this.load();
  },
  computed: {
    docs() {
      return this.$store.getters["document/getDocuments"].map(d => {

        console.log(d)
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
            onClick: this.accessDoc,
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
            onClick: this.deleteDoc,
          },
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
        return d;
      });
    },
    ...mapGetters({reviews: 'user/getReviews'})
  },
  methods: {
    load() {
      this.$socket.emit("getReviews");
    },
    deleteDoc(row) {
      this.$socket.emit("documentDelete", {documentId: row.id});
    },
    renameDoc(row) {
      this.$socket.emit("documentUpdate", {documentId: row.id, document: {name: "default_name"}});
    },
    accessDoc(row) {
      this.$router.push(`/annotate/${row.hash}`);
    },
    onAddedDoc() {
      this.load();
    },
    startReview(document_id) {
      //if a review was already started on this document, don't start a new one
      if (this.reviews.map(r => r.document).includes(document_id)) {
        const review_i = this.reviews.map(r => r.document).indexOf(document_id);

        this.$router.push(`/review/${this.reviews[review_i].hash}`);
      } else {
        this.sockets.subscribe("reviewProcessStarted", (data) => {
          this.sockets.unsubscribe('reviewProcessStarted');
          if (data.success) {
            this.$router.push(`/review/${data.reviewHash}`);
          } else {
            this.eventBus.emit('toast', {
              title: "Review Process",
              message: "The process cannot be started! Please try it again!",
              variant: "danger"
            });
          }
        });
        this.$socket.emit("startReview", {document_id: document_id});
      }
    },
    reviewState(document_id) {
      const review_i = this.reviews.map(r => r.document).indexOf(document_id); //gets first review matching the document
      if (review_i === -1) {
        return "NOT_STARTED";
      }

      return this.reviews[review_i].submitted ? "SUBMITTED" : "PENDING";
    },
    exportAll() {
      const doc_ids = this.docs.map(i => i.id);
      this.$refs.export.requestExport(doc_ids, "json");
    },
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>