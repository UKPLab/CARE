<template>
  <span
    v-if="help"
    class="btn btn-sm mt-0 pt-0"
    :title="help"
    ref="tooltip"
    data-bs-html="true"
    data-bs-placement="top"
    data-bs-toggle="tooltip"
  >
    <LoadIcon
      :size="16"
      icon-name="question-square-fill"
    />
  </span>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
// as directive
import { VBTooltip } from 'bootstrap-vue-3';

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
  },
  mounted() {
    //new Tooltip(this.$refs.tooltip, {trigger: "click"});
    console.log("VBTOOLTIP", VBTooltip);
  }
}
</script>

<style scoped>

</style>