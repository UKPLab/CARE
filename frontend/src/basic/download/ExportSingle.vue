<template>
  <DownloadSingle
    ref="downloader"
    :req-msg="reqMsg"
    :res-msg="resMsg"
    :name="name"
    @result="r => submitResult(r)"
  />
</template>

<script>
import {downloadObjectsAs} from "@/assets/utils";
import DownloadSingle from "./DownloadSingle.vue";

/* ExportSingle.vue - generic exporting component for a single download

Generic export logic for querying a single piece of information

Author: Nils Dycke
Source: -
*/
export default {
  name: "ExportSingle",
  components: {DownloadSingle},
  props: {
    name: {
      type: String,
      required: true
    },
    reqMsg: {
      type: String,
      required: true,
    },
    resMsg: {
      type: String,
      required: true,
    },
    postProcess: {
      type: Function,
      required: false,
      default: (x) => x
    }
  },
  data() {
    return {
      outputType: null
    }
  },
  methods: {
    submitResult(result) {
      this.exportDownloaded(result);
      this.reset();
    },
    reset() {
      this.$refs.downloader.reset();
    },
    requestExport(params, outputType) {
      this.$refs.downloader.requestDownload(params);
      this.outputType = outputType;
    },
    exportDownloaded(downloadedObj) {
      if (!downloadedObj.success){
        this.eventBus.emit('toast', {
          title: "Export Failed",
          message: "Export failed for " + downloadedObj.id + ".",
          variant: "danger"
        });
        return;
      }

      //post process (including merging, simplifying etc.)
      const toExport = this.postProcess(downloadedObj);
      downloadObjectsAs(toExport, `${this.name}`, this.outputType);

      this.eventBus.emit('toast', {
          title: "Export Success",
          message: `Exported ${downloadedObj.id}`,
          variant: "success"
        });
    },
  }
}
</script>

<style scoped>

</style>
