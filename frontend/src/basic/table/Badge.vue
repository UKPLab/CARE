<template>
  <span
    :class="badgeClass"
    class="badge"
  >
    {{ displayValue }}
  </span>
</template>

<script>
export default {
  name: "Badge",
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
          ? this.options.classMapping[this.value] : this.defaultBadgeClass();
    },
    defaultBadgeClass() {
      return (this.options && this.options.classMapping && this.options.classMapping.default)
          ? this.options.classMapping.default : 'bg-black';
    },
    displayValue() {
      return (this.options && this.options.keyMapping && this.options.keyMapping[this.value])
          ? this.options.keyMapping[this.value] : this.defaultDisplayValue;
    },
    defaultDisplayValue() {
      return (this.options && this.options.keyMapping && this.options.keyMapping.default)
          ? this.options.keyMapping.default : this.value;
    }
  }
}
</script>

<style scoped>

</style>