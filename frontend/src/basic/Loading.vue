<template>
  <div
    v-if="loading"
    class="d-flex flex-column align-items-center justify-content-center"
  >
    <div class="row">
      <div
        class="spinner-border text-dark"
        role="status"
      >
        <span class="visually-hidden">{{ text }}</span>
      </div>
    </div>
    <div class="row">
      <strong>{{ text }}</strong>
    </div>
  </div>
</template>

<script>

/**
 * Default loader component
 *
 * Include e.g.:
 *
 *    <Loader :loading="isLoading" />
 *    ...
 *    isLoading = false;
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "BasicLoader",
  props: {
    'loading': {
      type: Boolean,
      required: false,
      default: true
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