<template>
  <div class="w3-container w3-section">
     <input class="w3-input w3-border w3-round w3-margin" id="fileInput" type="file" name="file"/>
     <button class="w3-btn w3-blue w3-margin" id="uploadButton" @click="upload">upload</button>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "Upload",
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
        console.log(res.data)
        console.log(res.data.id)
        this.$router.push(`/annotate/${res.data.id}`);
      })
    }
  }
}
</script>

<style scoped>
</style>