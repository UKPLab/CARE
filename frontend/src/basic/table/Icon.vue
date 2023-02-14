<template>
  <LoadIcon :iconName="value"></LoadIcon>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Icon.vue",
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