<template>
  <a
    class="btn btn-sm btn-primary"
    @click="openModal()"
  >Add</a>
  <UploadModal ref="uploadModal" />
</template>

<script>

import UploadModal from "./UploadModal.vue";

/* Upload.vue - document upload component

This component provides the functionality for uploading a document
to the server. The user is prompted the option to select a PDF from
disk.

Author: Dennis Zyska (zyska@ukp...)
Co-Author:  Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "Upload",
  components: {UploadModal},
  data() {
    return {}
  },
  mounted() {
  },
  sockets: {},
  methods: {
    openModal() {
      this.$refs.uploadModal.openModal();
    }
  }
}
</script>

<style>
</style>