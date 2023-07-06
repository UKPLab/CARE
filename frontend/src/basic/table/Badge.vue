<template>
  <span
    v-tooltip="title && title.length > 0"
    :class="badgeClass"
    :title="title"
    class="badge"
    data-bs-html="true"
    data-bs-placement="top"
    data-bs-toggle="tooltip"
  >
    {{ text }}
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
    options: {
      type: Object,
      required: false,
      default: null
    }
  },
  computed: {
    badgeClass() {
      if(this.options && this.options.classMapping){
        return this.value in this.options.classMapping ? this.options.classMapping[this.value] : this.options.classMapping["default"];
      } else {
        return (this.value && this.value.class) ? this.value.class : 'bg-black';
      }
    },
    text() {
      if(this.options && this.options.keyMapping){
        return this.value in this.options.keyMapping ? this.options.keyMapping[this.value] : this.options.keyMapping["default"];
      } else {
        return this.value.text;
      }
    },
    title() {
      if(this.options && this.options.tooltip){
        return this.options.tooltip;
      } else if(this.value && this.value.tooltip){
        return this.value.tooltip;
      } else {
        return "";
      }
    }
  }
}
</script>

<style scoped>

</style>