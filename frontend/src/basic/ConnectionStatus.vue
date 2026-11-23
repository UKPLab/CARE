<template>
  <div v-if="disconnected" class="modal-backdrop fade show" style="opacity: 0.75">
    <Loader
text-class="text-light" class="text disconnect-error" :loading="true"
            :size="5" :text="$t('errors.connectionError')" />
  </div>
</template>

<script>
import Loader from './Loading.vue';

export default {
  name: 'ConnectionStatus',
  components: { Loader },
  props: { disconnected: { type: Boolean, default: false } },
};
</script>

<style scoped>
.disconnect-error {
  transform: translate(-50%, -50%);
  top: 50%;
  left: 50%;
  position: absolute;
  margin: 0;
}
</style>
