<template>
  <LoadIcon :icon-name="value" :color="color" />
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

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
    },
    color: {
      type: String,
      required: false,
      default: null
    }
  },
}
</script>

<style scoped>

</style>