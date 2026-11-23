<template>
  <div class="page-loader">
    <Loader :loading="true" :text="text" />
  </div>
</template>

<script>
import Loader from './Loading.vue';

export default {
  name: 'ApplicationLoading',
  components: { Loader },
  props: { text: { type: String, required: true } },
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
