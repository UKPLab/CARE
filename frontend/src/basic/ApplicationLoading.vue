<template>
  <div class="page-loader">
    <Loader :loading="true" :text="appLoadText" />
  </div>
</template>

<script>
import Loader from './Loading.vue';

export default {
  name: 'ApplicationLoading',
  components: { Loader },
  props: {
    stages: { type: Object, required: true },
    connected: { type: Boolean, required: true },
  },
  computed: {
    appLoadPercent() {
      const stages = Object.values(this.stages);
      return stages.filter(Boolean).length / stages.length * 100;
    },
    appLoadStep() {
      return Object.keys(this.stages).find((k) => !this.stages[k]);
    },
    appLoadText() {
      if (!this.connected) {
        return this.$t('common.connecting');
      }
      if (this.appLoadPercent < 100) {
        return this.$t('common.loadingProgress', {
          appLoadStep: this.appLoadStep,
          percent: this.appLoadPercent,
        });
      }
      return this.$t('common.loading');
    },
  },
};
</script>

<style scoped>
.page-loader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
