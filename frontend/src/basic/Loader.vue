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
/* Loader.vue - default component showing a loading spinner before showing the actual contents

Loading component to show a loading spinner before showing an actual component.

Include e.g.:

   <Loader :loading="isLoading" />
   ...
   isLoading = false;

Author: Dennis Zyska, Nils Dycke
Source: -
*/
export default {
  name: "BasicLoader",
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