<template>
  <div class="d-flex align-items-center">
    <BasicIcon icon-name="loading" :size="32"/>
    <span class="ms-3">{{ rotatingStatusText }}</span>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";

/** Owns the loading status rotation and releases its timers when the modal is removed. */
export default {
  name: "StudyLoadingProgress",
  components: {BasicIcon},
  data() { return {rotatingIndex: 0, rotatingTimer: null, rotatingLongTimer: null}; },
  computed: {
rotatingMessages() {
      return this.$tm('studies.loading.messages');
    },
rotatingTimerLong() {
      return this.$store.getters["settings/getValue"]('modal.nlp.rotation_timer.long');
    },
rotatingTimerShort() {
      return this.$store.getters["settings/getValue"]('modal.nlp.rotation_timer.short');
    },
rotatingStatusText() {
      return this.rotatingMessages[this.rotatingIndex];
    }
  },
  mounted() { this.startRotatingMessages(); },
  unmounted() { this.stopRotatingMessages(); },
  methods: {
startRotatingMessages() {
      this.rotatingIndex = Math.floor(Math.random() * this.rotatingMessages.length);
      this.rotatingTimer = setInterval(() => {
        this.rotatingIndex = (this.rotatingIndex + 1) % this.rotatingMessages.length;
      }, this.rotatingTimerShort);

      this.rotatingLongTimer = setTimeout(() => {
        clearInterval(this.rotatingTimer);
        this.rotatingTimer = setInterval(() => {
          this.rotatingIndex = (this.rotatingIndex + 1) % this.rotatingMessages.length;
        }, this.rotatingTimerLong);
      }, this.rotatingTimerShort * this.rotatingMessages.length);
    },
stopRotatingMessages() {
      clearInterval(this.rotatingTimer);
      clearTimeout(this.rotatingLongTimer);
    }
  },
};
</script>
