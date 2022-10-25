<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Documents
      <div>
        <button class="btn btn-sm btn-secondary me-1" type="button" @click="exportAllAnnotations()">Export Annotations
        </button>
        <Upload @addedDoc="onAddedDoc"></Upload>
      </div>
    </div>
    <div class="card-body">
      <span v-if="items.length === 0">
        No documents available...
      </span>
      <table v-else class="table table-hover">
        <thead>
        <tr>
          <th v-for="field in fields" scope="col">{{ field.name }}</th>
          <th scope="col">Manage</th>
          <th scope="col">Review</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in items" :key="item.hash">
          <td v-for="field in fields">{{ item[field.col] }}</td>
          <td>
            <div class="btn-group">

              <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Access document..." type="button" @click="accessDoc(item.hash)">
                <svg class="bi bi-box-arrow-right" fill="currentColor" height="16" viewBox="0 0 16 16"
                     width="16" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"
                        fill-rule="evenodd"></path>
                  <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"
                        fill-rule="evenodd"></path>
                </svg>
                <span class="visually-hidden">Access</span>
              </button>


              <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Delete document..."
                      type="button" @click="deleteDoc(item.id)">
                <svg class="bi bi-trash3-fill" fill="currentColor" height="16" viewBox="0 0 16 16"
                     width="16" xmlns="http://www.w3.org/2000/svg">
                  <path
                      d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"/>
                </svg>
                <span class="visually-hidden">Delete</span>
              </button>
              <!--<button type="button" class="btn btn-outline-secondary" @click="renameDoc(item.id, 'default_name')" data-toggle="tooltip" data-placement="top" title="Rename document...">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                    <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                    <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                  </svg>
                  <span class="visually-hidden">Rename</span>
              </button>-->
            </div>
          </td>
          <td>
            <button class="btn"
                    :class="reviewState(item.hash) === 'SUBMITTED' ? 'disabled btn-outline-secondary' : reviewState(item.hash) === 'PENDING' ? 'btn-outline-primary' : 'btn-outline-success'"
                    type="button"
                    @click="startReview(item.hash)">{{
                reviewState(item.hash) === "PENDING" ? "Continue"
                    : (reviewState(item.hash) === "SUBMITTED" ? "Submitted" : "Start")
              }}
            </button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
/* List.vue - document list management

This component loads the user-specific documents from the server
and allows to interact with them. The user can delete existing
documents or access the annotator view for the respective pdf.

Author: Nils Dycke (dycke@ukp...)
Co-Author:  Dennis Zyska (zyska@ukp...)
Source: -
*/
import {mapGetters, mapActions} from "vuex";
import Upload from "./documents/Upload.vue";
import {FileSaver} from "file-saver"; //required for window.saveAs to work


export default {
  name: "Document",
  components: {Upload},
  data() {
    return {
      fields: [
        {name: "Title", col: "name"},
        {name: "Created At", col: "createdAt"}
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
    ...mapGetters({items: 'user/getDocuments', reviews: 'user/getReviews'})
  },
  methods: {
    load() {
      this.$socket.emit("docs_get");
      this.$socket.emit("getReviews");
    },
    deleteDoc(docId) {
      this.$socket.emit("doc_delete", {docId: docId});
    },
    renameDoc(docId, name) {
      this.$socket.emit("doc_rename", {docId: docId, newName: name});
    },
    accessDoc(docHash) {
      this.$router.push(`/annotate/${docHash}`);
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
    exportAllAnnotations() {
      const doc_ids = this.items.map(i => i.hash);
      this.exportAnnotations(doc_ids);
    },
    exportAnnotations(doc_ids) {
      this.sockets.subscribe("exportedAnnotations", (r) => {
        this.sockets.unsubscribe('exportedAnnotations');

        if (r.success) {
          let exported = 0;
          r.csvs.forEach((val, index) => {
            if (val !== null && val.length > 0) {
              const docId = r.docids[index];
              exported++;
              window.saveAs(new Blob([val], {type: "text/csv;charset=utf-8"}), `${docId}_annotations.csv`);
            }
          });
          this.eventBus.emit('toast', {
            title: "Export Success",
            message: `Exported annotations for ${exported} documents`,
            variant: "success"
          });
        } else {
          this.eventBus.emit('toast', {
            title: "Export Failed",
            message: "Export failed for some reason.",
            variant: "danger"
          });
        }
      });

      this.$socket.emit("exportAnnotations", doc_ids);
    }
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>