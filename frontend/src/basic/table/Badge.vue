<template>
  <span
      v-tooltip="'tooltip' in value"
      :class="badgeClass"
      :title="'tooltip' in value ? value.tooltip : ''"
      class="badge"
      data-bs-html="true"
      data-bs-placement="top"
      data-bs-toggle="tooltip"
  >
    {{ value.text }}
  </span>
</template>

<script>
import {tooltip} from "@/assets/tooltip.js";

export default {
  name: "TableColumnBadge",
  directives: {
    'tooltip': tooltip
  },
  props: {
    value: {
      type: Object,
      required: true
    },
  },
  computed: {
    badgeClass() {
      return (this.value && this.value.class)
          ? this.value.class : 'bg-black';
    },
  }
}
</script>

<style scoped>

</style>