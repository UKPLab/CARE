<template>
  <span
    v-if="help"
    ref="tooltip"
    class="btn btn-sm mt-0 pt-0 border-0"
    :class="buttonClass"
    :title="help"
    data-bs-html="true"
    data-bs-placement="top"
    data-bs-toggle="tooltip"
  >
    <LoadIcon
      :size="16"
      :icon-name="iconName"
    />
  </span>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import { Tooltip } from "bootstrap";

/**
 * Show help icon with tooltip if help is provided.
 */
export default {
  name: "FormHelp",
  components: {
    LoadIcon
  },
  props: {
    help: {
      type: String,
      required: false,
      default: null,
    },
    iconName: {
      type: String,
      default: "question-square-fill",
    },
    buttonClass: {
      type: [String, Object, Array],
      default: null,
    },
  },

   mounted() {
    if (!this.$refs.tooltip) return;

    this.tooltipInstance = new Tooltip(this.$refs.tooltip, {
      trigger: "hover focus",
      delay: 0,
    });
  },

  beforeUnmount() {
    this.tooltipInstance?.dispose();
  },
};
</script>


<style scoped>

</style>