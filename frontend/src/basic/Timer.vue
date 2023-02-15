<template>
  <div v-if="show">
    {{state}}
  </div>
</template>

<script>

export default {
  name: "Timer.vue",
  components: {},
  emits: ["timeStep"],
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
      default: 60*1000
    }
  },
  data() {
    return {
      state : -1,
      timer: null,
    }
  },
  mounted(){
    if(this.autostart){
      this.start();
    }
  },
  watch: {
    state: {
      handler(val){
        if(this.timer){
          this.$emit("timeStep");
          this.setTimer();
        }
      },
      immediate: true
    }
  },
  methods: {
    start(){
      this.state = 0;
      this.setTimer();
    },
    stop() {
      this.clearTimer();
    },
    setTimer(){
      this.clearTimer();
      this.timer = setTimeout(() => {this.state++}, this.resolution);
    },
    clearTimer() {
      if(this.timer){
        clearTimeout(this.timer);
      }
      this.timer = null;
    }
  }
}
</script>

<style scoped>

</style>