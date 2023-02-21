<template>
  <DownloadSet req-msg="annotationExportByDocument"
               res-msg="annotationExport"
               index="document"
               ref="annotations"
              @result="r => this.result[0] = r"
              @progress="p => this.progress[0] = p">
  </DownloadSet>
  <DownloadSet req-msg="commentExportByDocument"
               res-msg="commentExport"
               index="document"
               ref="comments"
               @result="r => this.result[1] = r"
               @progress="p => this.progress[1] = p">
  </DownloadSet>
</template>

<script>
/* ExportAnnos.vue - default anno and comment export component

Export logic for annos and comments

Author: Nils Dycke
Source: -
*/
import {mergeAnnotationsAndComments} from "@/assets/data";
import {downloadObjectsAs, omitObjectAttributeSubset} from "@/assets/utils";
import DownloadSet from "./DownloadSet.vue";

export default {
  name: "ExportAnnos.vue",
  components: {DownloadSet},
  props: [],
  data() {
    return {
      progress: [0,0],
      outputType: null,
      simplify: null,
      result: null,
      downloadIds: null
    }
  },
  computed: {
    download_progress() {
      if(this.progress !== null){
        return Math.min(...this.progress);
      }
      return 0;
    }
  },
  watch: {
    download_progress(newVal) {
      if (newVal !== 1) {
        return;
      }

      // export for each document
      for (let i = 0; i < this.downloadIds.length; i++) {
        const downloadId = this.downloadIds[i];

        this.exportDownloaded(
            this.result[0].find(e => e.documentId === downloadId),
            this.result[1].find(e => e.documentId === downloadId));
      }

      this.reset();
    }
  },
  methods: {
    reset() {
      this.progress = [0,0];
      this.outputType = null;
      this.simplify = null;
      this.result = null;
      this.downloadIds = null;

      this.$refs.annotations.reset();
      this.$refs.comments.reset();
    },

    requestExport(doc_ids, outputType, simplify=false) {
      // do not allow second downlaod while one is in progress
      if(this.downloadIds){
        this.eventBus.emit('toast', {message: "Another download is in progress. Please wait.", variant: "warning", delay: 3000});
        return;
      }

      this.downloadIds = doc_ids;
      this.outputType = outputType;
      this.simplify = simplify;
      this.result= [null, null];
      this.progress = [0, 0];

      this.$refs.annotations.requestDownload(this.downloadIds);
      this.$refs.comments.requestDownload(this.downloadIds);
    },
    _simple(obj) {
      const simple = omitObjectAttributeSubset(obj, ["hash", "document", "annotationId", "commentId",
      "createdAt", "updatedAt"])
      return Object.fromEntries(Object.entries(simple).map(([k, v]) => {
        if(typeof v === "object" && v !== null){
          return [k, this._simple(v)];
        } else {
          return [k, v];
        }
      }));
    },
    exportDownloaded(annoExport, commExport) {
      if (!annoExport.success || !commExport.success) {
        this.eventBus.emit('toast', {
          title: "Export Failed",
          message: "Export failed for " + annoExport.documentId + ".",
          variant: "danger"
        });
        return;
      }

      const doc = this.$store.getters["document/getDocument"](annoExport.documentId);
      const docHash = doc ? doc.hash : null;

      let [merged, docComments] = mergeAnnotationsAndComments(
            annoExport.objs,
            commExport.objs
      );

      if(this.simplify) {
        merged = merged.map(i => this._simple(i));
        docComments = docComments.map(i => this._simple(i));
      }

      downloadObjectsAs(merged, `doc_${docHash ? docHash : annoExport.documentId}_annotations`, this.outputType);
      if(docComments.length > 0){
        downloadObjectsAs(docComments, `doc_${docHash ? docHash : annoExport.documentId}_notes`, this.outputType);
      }

      this.eventBus.emit('toast', {
          title: "Export Success",
          message: `Exported annotations for document ${docHash ? docHash : annoExport.documentId}`,
          variant: "success"
        });
    },
  }
}
</script>

<style scoped>

</style>