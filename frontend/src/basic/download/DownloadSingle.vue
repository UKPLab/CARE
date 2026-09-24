<template>
  <span hidden></span>
</template>

<script>

/**
 * Generic downloading component for a sequence of items
 *
 * Generic download logic for a single message
 *
 * @author: Nils Dycke
 */
export default {
  name: "DownloadSingle",
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
          title: this.$t('errors.download.exportAbortedTitle'),
          message: this.$t('errors.download.serverTimeout'),
          variant: "danger"
        });
    },
    requestDownload(params) {
      // do not allow second downlaod while one is in progress
      if(this.waiting){
        this.eventBus.emit('toast', {
          message: this.$t('errors.download.inProgress'), 
          variant: "warning", 
          delay: 3000});
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
      this.timeout = setTimeout(_x => {
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
