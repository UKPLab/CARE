<template>
      <div class="form-field d-flex flex-column">
        <label class="form-label w-100 text-start mb-2">
          {{ $t('modals.importExport.import.selectFile', { extensions: acceptedExtensions.join(', ') }) }}
        </label>
        <div class="w-100">
          <input
            ref="fileInput"
            class="form-control"
            type="file"
            :accept="acceptString"
            @change="handleFileSelect"
          />
        </div>
      </div>
      <div v-if="selectedFile" class="mt-2">
        <small class="text-muted">
          {{ $t('modals.importExport.import.selectedFile', { file: selectedFile.name }) }}
        </small>
      </div>
      <div v-if="parseError" class="mt-2 text-danger">
        <small>{{ parseError }}</small>
      </div>
</template>
<script>
import {getSupportedImportFormats} from '@/assets/utils';
export default {
  name:'ImportFilePicker', emits:['file-selected','parsed'],
  data(){return {selectedFile:null,parseError:null};},
  computed:{
    supportedImportFormats() {
      return getSupportedImportFormats();
    },
    acceptedExtensions() {
      return this.supportedImportFormats.flatMap((f) => f.extensions);
    },
    acceptString() {
      return this.acceptedExtensions.join(",");
    }
 },
  methods:{
  reset(){this.selectedFile=null;this.parseError=null;if(this.$refs.fileInput)this.$refs.fileInput.value='';},
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      this.$emit('file-selected',file);
      this.parseError = null;
      this.processFile(file);
    },
    async processFile(file) {
      try {
        const content = await this.readFile(file);
        const ext = "." + file.name.toLowerCase().split(".").pop();
        const format = this.supportedImportFormats.find((f) =>
          f.extensions.includes(ext)
        );
        if (!format) {
          throw new Error(this.$t('modals.importExport.import.errors.unsupportedFileType', { ext }));
        }
        let parsed = format.parse(content);
        if (parsed && !Array.isArray(parsed)) {
          parsed = [parsed];
        }
        this.$emit('parsed', parsed);
      } catch (error) {
        console.error("Error processing file:", error);
        this.parseError = this.$t('modals.importExport.import.errors.parseFileFailed', {
          message: error.message,
        });
        this.selectedFile = null;
        this.$emit('file-selected',null);
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(this.$t('modals.importExport.import.errors.readFileFailed')));
        reader.readAsText(file);
      });
    }
 },
};
</script>
