<template>
  <LoadIcon :icon-name="value" />
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "TableIcon",
  components: {LoadIcon},
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
}
</script>

<style scoped>

</style>