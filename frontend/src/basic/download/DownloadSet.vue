<template>
  <!-- todo opt. show progress bar -->
</template>

<script>
import {arraysContainSameElements} from "@/assets/utils";

/* DownloadSet.vue - generic downloading component for a sequence of items

Generic download logic for a single stream of items with ids

Author: Nils Dycke
Source: -
*/
export default {
  name: "DownloadSet",
  props: {
    index: {
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
    }
  },
  emits: ["progress", "result"],
  data() {
    return {
      downloaded: [],
      toDownload: [],
      timeout: null,
    }
  },
  computed: {
    downloaded_ids() {
      return this.downloaded.map(i => i[`${this.index}Id`])
    },
    progress() {
      if(this.toDownload.length === 0){
        return -1;
      }

      return this.downloaded.length / this.toDownload.length;
    },
  },
  watch: {
    progress(newVal) {
      this.$emit("progress", newVal);
    },
    downloaded_ids(newVal) {
      if (this.toDownload.length === 0) {
        return;
      }

      if (newVal.length !== this.toDownload.length || !arraysContainSameElements(newVal, this.toDownload)) {
        return;
      }

      // stop timeout
      clearTimeout(this.timeout);

      // stop listening to such events
      this.sockets.unsubscribe(this.resMsg);

      //send result
      this.$emit("result", this.downloaded);
    }
  },
  methods: {
    reset() {
      this.downloaded = [];
      this.toDownload = [];
    },
    abortDownload() {
      // stop timeout
      clearTimeout(this.timeout);

      // stop listening
      this.sockets.unsubscribe(this.resMsg);

      //clear vars
      this.reset();

      //notify user
       this.eventBus.emit('toast', {
          title: "Download aborted",
          message: "The server did not respond. Please try again later.",
          variant: "danger"
        });
    },
    requestDownload(ids) {
      // do not allow second downlaod while one is in progress
      if(this.toDownload.length !== this.downloaded.length){
        this.eventBus.emit('toast', {message: "Another download is in progress. Please wait.", variant: "warning", delay: 3000});
        return;
      }

      this.sockets.subscribe(this.resMsg, (r) => {
        if(this.toDownload.includes(r[`${this.index}Id`])) {
          this.downloaded.push(r);
        }
      });

      this.downloaded = [];
      this.toDownload = ids;

      //in the future: do batching if necessary
      ids.forEach(iid => {
        let req = Object();
        req[`${this.index}Id`] = iid;

        this.$socket.emit(this.reqMsg, req);
      });

      // set timer
      this.timeout = setTimeout(x => {
        if(this.downloaded.length < this.toDownload.length) {
          this.abortDownload();
        } else {
          clearTimeout(this.timeout);
        }
      }, 10000)
    }
  }
}
</script>

<style scoped>

</style>