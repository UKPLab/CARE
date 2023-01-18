<template>
</template>

<script>
/* DownloadSingle.vue - generic downloading component for a sequence of items

Generic download logic for a single message

Author: Nils Dycke
Source: -
*/
import {arraysContainSameElements} from "../../assets/utils";

export default {
  name: "DownloadSingle.vue",
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
    }
  },
  emits: ["result"],
  data() {
    return {
      result: null,
      waiting: false,
      timeout: null,
    }
  },
  watch: {
    result(newVal) {
      if (newVal === null) {
        return;
      }

      // stop timeout
      clearTimeout(this.timeout);

      // stop listening to such events
      this.sockets.unsubscribe(this.resMsg);

      // emit result
      this.$emit("result", newVal);
    }
  },
  methods: {
    reset() {
      this.result = null;
      this.waiting = false;
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
          title: "Export aborted",
          message: "The server did not respond. Please try again later.",
          variant: "danger"
        });
    },
    requestDownload(params) {
      // do not allow second downlaod while one is in progress
      if(this.waiting){
        this.eventBus.emit('toast', {message: "Another download is in progress. Please wait.", variant: "warning", delay: 3000});
        return;
      }

      this.sockets.subscribe(this.resMsg, (r) => {
        this.result = r;
        this.waiting = false;
      });

      this.result = null;
      this.waiting = true;

      //send request
      this.$socket.emit(this.reqMsg, params);

      // set timer
      this.timeout = setTimeout(x => {
        if(this.result === null) {
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