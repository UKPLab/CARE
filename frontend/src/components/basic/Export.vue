<template>
</template>

<script>
/* Export.vue - default anno and comment export component

Export logic

Author: Nils Dycke
Source: -
*/
import {mergeAnnotationsAndComments} from "../../assets/data";
import {arraysContainSameElements, downloadObjectsAs, omitObjectAttributeSubset} from "../../assets/utils";

export default {
  name: "Export.vue",
  props: [],
  data() {
    return {
      downloadAnnos: [],
      downloadComms: [],
      downloadIds: [],
      outputType: null,
      timeout: null,
      simplify: null,
    }
  },
  computed: {
    download_progress() {
      return [this.downloadAnnos.map(i => i.document_id), this.downloadComms.map(i => i.document_id)]
    }
  },
  watch: {
    download_progress(newVal) {
      if (this.downloadIds.length === 0) {
        return;
      }

      const annoDocIds = newVal[0];
      const commDocIds = newVal[1];
      if (annoDocIds.length !== this.downloadIds.length
          || commDocIds.length !== this.downloadIds.length
          || !arraysContainSameElements(annoDocIds, this.downloadIds)
          || !arraysContainSameElements(commDocIds, this.downloadIds)) {
        return;
      }

      // stop timeout
      clearTimeout(this.timeout);

      // stop listening to such events
      this.sockets.unsubscribe("annotationExport");
      this.sockets.unsubscribe("commentExport");

      // export for each document
      for (let i = 0; i < this.downloadIds.length; i++) {
        const downloadId = this.downloadIds[i];

        this.downloadExported(
            this.downloadAnnos.find(e => e.documentId === downloadId),
            this.downloadComms.find(e => e.documentId === downloadId),
            this.outputType,
            this.simplify);
      }

      this.downloadAnnos = [];
      this.downloadComms = [];
      this.downloadIds = [];
      this.outputType = null;
      this.simplify = null;
    }
  },
  methods: {
    abortExport() {
      // stop timeout
      clearTimeout(this.timeout);

      // stop listening
      this.sockets.unsubscribe("annotationExport");
      this.sockets.unsubscribe("commentExport");

      //clear vars
      this.downloadAnnos = [];
      this.downloadComms = [];
      this.downloadIds = [];
      this.outputType = null;

      //notify user
       this.eventBus.emit('toast', {
          title: "Export aborted",
          message: "The server did not respond. Please try again later.",
          variant: "danger"
        });
    },
    requestExport(doc_ids, outputType, simplify=false) {
      // do not allow second downlaod while one is in progress
      if(this.downloadIds.length > 0){
        this.eventBus.emit('toast', {message: "Another download is in progress. Please wait.", variant: "warning", delay: 3000});
        return;
      }

      this.sockets.subscribe("annotationExport", (r) => {
        if(this.downloadIds.includes(r.documentId)) {
          this.downloadAnnos.push(r);
        }
      });

      this.sockets.subscribe("commentExport", (r) => {
        if(this.downloadIds.includes(r.documentId)) {
          this.downloadComms.push(r);
        }
      });

      this.downloadAnnos = [];
      this.downloadComms = [];
      this.downloadIds = doc_ids;
      this.outputType = outputType;
      this.simplify = simplify;

      //in the future: do batching if necessary
      doc_ids.forEach(did => {
        this.$socket.emit("annotationExportByDocument", {"documentId": did});
        this.$socket.emit("commentExportByDocument", {"documentId": did});
      });

      // set timer
      this.timeout = setTimeout(x => {
        if(this.download_progress[0].length < this.downloadIds.length || this.download_progress[1].length < this.downloadIds.length) {
          this.abortExport();
        } else {
          clearTimeout(this.timeout);
        }
      }, 10000)
    },
    _simple(obj) {
      const simple = omitObjectAttributeSubset(obj, ["hash", "document", "referenceAnnotation", "referenceComment",
      "createdAt", "updatedAt"])
      return Object.fromEntries(Object.entries(simple).map(([k, v]) => {
        if(typeof v === "object" && v !== null){
          return [k, this._simple(v)];
        } else {
          return [k, v];
        }
      }));
    },
    downloadExported(annoExport, commExport, outputType, simplify=false) {
      if (!annoExport.success || !commExport.success) {
        this.eventBus.emit('toast', {
          title: "Export Failed",
          message: "Export failed for " + annoExport.document_id + ".",
          variant: "danger"
        });
        return;
      }

      let [merged, docComments] = mergeAnnotationsAndComments(
            annoExport.objs,
            commExport.objs
      );

      if(simplify) {
        merged = merged.map(i => this._simple(i));
        docComments = docComments.map(i => this._simple(i));
      }

      downloadObjectsAs(merged, `${annoExport.document_id}_annotations`, outputType);
      if(docComments.length > 0){
        downloadObjectsAs(docComments, `${annoExport.document_id}_notes`, outputType);
      }

      this.eventBus.emit('toast', {
          title: "Export Success",
          message: `Exported annotations for ${annoExport.document_id}`,
          variant: "success"
        });
    },
  }
}
</script>

<style scoped>

</style>