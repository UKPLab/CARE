<template>
  <div
    class="spinner-grow"
    :style="'width: ' + size + 'px; height: ' + size + 'px;'"
    role="status"
  >
    <span class="visually-hidden">Loading...</span>
  </div>
</template>

<script>
/**
 * A simple loading icon
 */
export default {
  name: "IconLoading",
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