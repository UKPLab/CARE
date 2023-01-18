<template>
  <DownloadSet v-if="isMultiExport"
                  :req-msg="reqMsg"
                  :res-msg="resMsg"
                  :name="name"
                  :ref="`downloader_${reqMsg}`">
  </DownloadSet>
  <DownloadSet v-else
                  v-for="r in reqMsg.length"
                  :req-msg="reqMsg[r]"
                  :res-msg="resMsg[r]"
                  :name="name"
                  :ref="`downloader_${reqMsg[r]}`">
  </DownloadSet>
</template>

<script>
/* ExportSet.vue - generic exporting component

Generic export logic for querying for a sequence of items by ids.

Author: Nils Dycke
Source: -
*/
import {downloadObjectsAs} from "../../assets/utils";
import DownloadSet from "./DownloadSet.vue"

export default {
  name: "ExportSet.vue",
  components: {DownloadSet},
  props: {
    name: {
      type: String,
      required: true
    },
    reqMsg: {
      required: true,
    },
    resMsg: {
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
      toDownload: []
    }
  },
  computed: {
    isMultiExport(){
      return Array.isArray(this.reqMsg) && Array.isArray(this.resMsg);
    },
    //todo fix usage of refs here --> use event-based updates
    downloaders() {
      if(this.isMultiExport()){
        return this.reqMsg.map(m => this.$refs[`downloader_${m}`]);
      } else {
        return [this.$refs[`downloader_${this.reqMsg}`]]
      }
    },
    progress() {
      return Math.min(...this.downloaders.maps(d => d.progress))
    },
    items() {
      return this.downloaders.maps(d => d.downloaded);
    },
  },
  watch: {
    progress(newVal) {
      if (newVal  === 1.0) {
        return;
      }

      // export for each id
      this.toDownload.forEach((iid) => {
        this.exportDownloaded(this.items.map(dt => dt.findAll(e => e.id === iid)));
      });

      this.reset();
    }
  },
  methods: {
    reset() {
      this.toDownload = [];
      this.downloaders.forEach(d => d.reset());
    },
    requestExport(ids, outputType) {
      // do not allow second downlaod while one is in progress
      if(this.toDownload.length > 0){
        this.eventBus.emit('toast', {message: "Another download is in progress. Please wait.", variant: "warning", delay: 3000});
        return;
      }

      this.toDownload = ids;
      this.downloaders.requestDownload(ids);
    },
    exportDownloaded(downloadObjs) {
      const success = downloadObjs.map(obj=> obj.success);
      if (success || downloadObjs.length === 0) {
        this.eventBus.emit('toast', {
          title: "Export Failed",
          message: "Export failed for " + downloadObjs[0].id + ".",
          variant: "danger"
        });
        return;
      }

      //post process (including merging, simplifying etc.)
      const toExport = this.postProcess(...downloadObjs);

      downloadObjectsAs(toExport, `${downloadObjs[0].id}_${this.name}`, this.outputType);

      this.eventBus.emit('toast', {
          title: "Export Success",
          message: `Exported ${downloadObjs[0].id}`,
          variant: "success"
        });
    },
  }
}
</script>

<style scoped>

</style>