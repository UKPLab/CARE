<template>
  <a class="btn btn-sm btn-primary" href="#" @click="openModal">Add</a>

  <!-- Modal -->
  <!--<teleport to="body">-->
  <div id="uploadModal" ref="uploadModal" aria-hidden="true" aria-labelledby="uploadModalLabel" class="modal fade"
       data-bs-backdrop="static"
       role="dialog" tabindex="-1">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="uploadModalLabel" class="modal-title">Upload new document</h5>
          <button aria-label="Close" class="close" data-bs-dismiss="modal" type="button">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body justify-content-center flex-grow-1 d-flex">
          <div v-if="uploading" class="spinner-border m-5 " role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <div v-else class="flex-grow-1">
            <!--<label class="form-label" for="fileInput">Document Upload</label>-->
            <input id="fileInput" class="form-control" name="file" type="file">
          </div>
        </div>
        <div v-if="!uploading" class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal" type="button">Close</button>
          <button class="btn btn-primary" type="button" @click="upload">Upload</button>
        </div>
      </div>
    </div>
  </div>
  <!--</teleport>-->
</template>

<script>
/* Upload.vue - document upload component

This component provides the functionality for uploading a document
to the server. The user is prompted the option to select a PDF from
disk.

Author: Dennis Zyska (zyska@ukp...)
Co-Author:  Nils Dycke (dycke@ukp...)
Source: -
*/
import {Modal} from 'bootstrap';

export default {
  name: "Upload",
  data() {
    return {
      modal: null,
      uploading: false,
      show: false,
    }
  },
  mounted() {
    this.modal = new Modal(this.$refs.uploadModal);
    console.log(this.modal);
  },
  sockets: {
    upload_result: function (data) {
      this.modal.hide();
      this.uploading = false;
      if (data.success) {
        this.eventBus.emit('toast', {message: "File successfully uploaded!", variant: "success", delay: 3000});
      } else {
        this.eventBus.emit('toast', {message: "Error during upload of file!", variant: "danger", delay: 3000});
      }
    }
  },
  methods: {
    openModal() {
      this.modal.show();
    },
    upload() {
      let fileElement = document.getElementById('fileInput')

      // check if user had selected a file
      if (fileElement.files.length === 0) {
        alert('please choose a file')
        return
      }

      this.$socket.emit("doc_upload", {file: fileElement.files[0], name: fileElement.files[0].name});
      this.uploading = true;

    }
  }
}
</script>

<style>
.modal-backdrop:nth-child(2n-1) {
  opacity: 0;
}
</style>