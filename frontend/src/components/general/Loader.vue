<template>
  <div v-if="loading" class="d-flex flex-column align-items-center justify-content-center">
    <div class="row">
      <div class="spinner-border text-dark" role="status">
        <span class="visually-hidden">{{ text }}</span>
      </div>
    </div>
    <div class="row">
      <strong>{{ text }}</strong>
    </div>
  </div>
</template>

<script>
/* These component is to display a loader */

export default {
  name: "Loader",
  props: {
    'loading': {
      type: Boolean,
      required: false,
      default: false
    },
    'text': {
      type: String,
      required: false,
      default: "Loading..."
    }
  },
}
</script>

<style scoped>

</style>