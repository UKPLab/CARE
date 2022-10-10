<template>
  <div class="spinner-grow" :style="'width: ' + size + 'px; height: ' + size + 'px;'" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>
</template>

<script>
export default {
  name: "IconLoading.vue",
  props: {
    size: {
      type: Number,
      default: 16,
      required: false,
    }
  }
}
</script>

<style scoped>

</style>