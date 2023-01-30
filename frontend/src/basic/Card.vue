<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <h5 class="card-title">{{ title }}</h5>
      <div>
        <slot name="headerElements"></slot>
      </div>
    </div>
    <div class="card-body">
      <slot name="body"></slot>
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: "Card.vue",
  props: {
    title: {
      type: String,
      required: false,
      default: ""
    },
  }
}
</script>

<style scoped>

</style>