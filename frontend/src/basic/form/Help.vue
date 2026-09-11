<template>
  <span
    v-if="help"
    ref="tooltip"
    v-tooltip="!!help"
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
import { tooltip } from "@/assets/tooltip.js";

/**
 * Show help icon with tooltip if help is provided.
 */
 export default {
  name: "FormHelp",
  components: {
    LoadIcon
  },

  directives: {
    tooltip,
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
};
</script>


<style scoped>

</style>