<template>
</template>

<script>
/* Export.vue - default anno and comment export component

Export logic

Author: Nils Dycke
Source: -
*/
import {mergeAnnotationsAndComments} from "../../assets/data";
import {arraysContainSameElements, downloadObjectsAs} from "../../assets/utils";

export default {
  name: "Export.vue",
  props: [],
  data() {
    return {
      downloadAnnos: [],
      downloadComms: [],
      downloadIds: [],
      outputType: null
    }
  },
  computed: {
    download_progress() {
      return [this.downloadAnnos.map(i => i.document_id), this.downloadComms.map(i => i.document_id)]
    }
  },
  watch: {
    download_progress(newVal, oldVal) {
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

      // export for each document
      for (let i = 0; i < this.downloadIds.length; i++) {
        this.downloadExported(this.downloadAnnos[i], this.downloadComms[i], this.outputType);
      }

      this.downloadAnnos = [];
      this.downloadComms = [];
      this.downloadIds = [];
      this.outputType = null;
    }
  },
  methods: {
    requestExport(doc_ids, outputType) {
      this.sockets.subscribe("exportedAnnotations", (r) => {
        this.downloadAnnos.push(r);
        this.sockets.unsubscribe("exportedAnnotations");
      });

      this.sockets.subscribe("exportedComments", (r) => {
        this.downloadComms.push(r);
        this.sockets.unsubscribe("exportedComments");
      });

      this.downloadIds = doc_ids;
      this.outputType = outputType;

      //in the future: do batching if necessary
      doc_ids.forEach(did => {
        this.$socket.emit("exportAnnotationsByDocument", {"document_id": did});
        this.$socket.emit("exportCommentsByDocument", {"document_id": did});
      });
    },
    downloadExported(annoExport, commExport, outputType) {
      if (!annoExport.success || !commExport.success) {
        this.eventBus.emit('toast', {
          title: "Export Failed",
          message: "Export failed for " + annoExport.document_id + ".",
          variant: "danger"
        });
        return;
      }

      const merged = mergeAnnotationsAndComments(
            annoExport.objs, //opt: in the future subselect fields using utils.js methods
            commExport.objs  //opt: in the future subselect fields using utils.js methods
      );

      //todo possibly refine data structure depending on the output type (e.g. csv doesn't support recursive objs.)

      downloadObjectsAs(merged, annoExport.document_id, outputType)

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