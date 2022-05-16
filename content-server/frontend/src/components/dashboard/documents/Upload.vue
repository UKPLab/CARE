<template>
    <a href="#" class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#uploadModal">Add</a>

      <!-- Modal -->
    <teleport to="body">
    <div class="modal fade" id="uploadModal" tabindex="-1"  data-bs-backdrop="static" role="dialog" aria-labelledby="uploadModalLabel" aria-hidden="true">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="uploadModalLabel">Upload new document</h5>
            <button type="button" class="close" data-bs-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="fileInput" class="form-label">Document Upload</label>
              <input class="form-control"  name="file" type="file" id="fileInput">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" @click="upload">Upload</button>
          </div>
        </div>
      </div>
    </div>
    </teleport>
</template>

<script>
import axios from "axios";
import { Modal } from 'bootstrap';

export default {
  name: "Upload",
  data() {
    return {
      modal: null
    }
  },
  mounted() {
   this.modal = new Modal(document.getElementById('uploadModal'));
  },
  methods: {
    upload() {
      let fileElement = document.getElementById('fileInput')

      // check if user had selected a file
      if (fileElement.files.length === 0) {
        alert('please choose a file')
        return
      }

      let formData = new FormData();
      formData.set('file', fileElement.files[0]);

      axios.post(
          "/api/upload",
          formData,
          {
            onUploadProgress: progressEvent => {
              const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
              );
              console.log(`upload process: ${percentCompleted}%`);
            }
          }).then(res => {

        this.modal.hide();
        const elements = document.getElementsByClassName("modal-backdrop");
        while(elements.length > 0){
            elements[0].parentNode.removeChild(elements[0]);
        }
      })
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  display: none;
}
</style>