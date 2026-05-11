<template>
  <LoadIcon v-tooltip :icon-name="value" :color="color" :title="title" :size="size"/>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import { tooltip } from "@/assets/tooltip.js";

export default {
  name: "TableIcon",
  components: {LoadIcon},
  directives: { tooltip },
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
    },
    title: {
      type: String,
      required: false,
      default: null
    },
    size: {
      type: Number,
      required: false,
      default: 16
    }
  },
}
</script>

<style scoped>

</style>