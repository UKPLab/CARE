<template>
  <div v-if="show">
    {{ state }}
  </div>
</template>

<script>
/* Timer.vue - timing utilities

This module provides timing utilities for countdowns. Provides emit events. Supports different granualrities.

Include, for instance as:

  <Timer autostart show :resolution="1*1000" @timeStep="doSmth()" />
  ...
  doSmth(){console.log("yeay");

Author: Nils Dycke
Source: -
*/
export default {
  name: "Timer",
  components: {},
  props: {
    show: {
      type: Boolean,
      required: false,
      default: false
    },
    autostart: {
      type: Boolean,
      required: false,
      default: false
    },
    resolution: {
      type: Number,
      required: false,
      default: 60 * 1000
    }
  },
  emits: ["timeStep"],
  data() {
    return {
      state: -1,
      timer: null,
    }
  },
  watch: {
    state: {
      handler(val) {
        if (this.timer) {
          this.$emit("timeStep");
          this.setTimer();
        }
      },
      immediate: true
    }
  },
  mounted() {
    if (this.autostart) {
      this.start();
    }
  },
  methods: {
    start() {
      this.state = 0;
      this.setTimer();
    },
    stop() {
      this.clearTimer();
    },
    setTimer() {
      this.clearTimer();
      this.timer = setTimeout(() => {
        this.state++
      }, this.resolution);
    },
    clearTimer() {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = null;
    }
  }
}
</script>

<style scoped>

</style>