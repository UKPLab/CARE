<template>
  <span :class="badgeClass" class="badge">
    {{ displayValue }}
  </span>
</template>

<script>
export default {
  name: "Badge.vue",
  props: {
    value: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      required: false,
      default: null
    }
  },
  computed: {
    badgeClass() {
      return (this.options && this.options.classMapping && this.options.classMapping[this.value])
          ? this.options.classMapping[this.value] : 'bg-black';
    },
    displayValue() {
      return (this.options && this.options.keyMapping && this.options.keyMapping[this.value])
          ? this.options.keyMapping[this.value] : this.value;
    }
  }
}
</script>

<style scoped>

</style>