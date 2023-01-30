<template>
  <div class="text-center mt-5">
    <div class="spinner-border" role="status">
      <span class="visually-hidden">{{ text }}</span>
    </div>
    <div>{{ text }}</div>
  </div>
</template>

<script>
/* Loading.vue - default loading component

Loading component to show a loading spinner

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
export default {
  name: "Loading.vue",
  props: {
    text: {
      type: String,
      default: "Loading...",
      required: false,
    }
  }
}
</script>

<style scoped>

</style>