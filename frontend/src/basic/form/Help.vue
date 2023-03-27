<template>
  <span
    v-if="help"
    class="btn btn-sm mt-0 pt-0"
    :title="help"
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
import LoadIcon from "@/icons/LoadIcon.vue";

/**
 * Show help icon with tooltip if help is provided.
 */
export default {
  name: "FormHelp",
  components: {
    LoadIcon,
  },
  props: {
    help: {
      type: String,
      required: false,
      default: null,
    },
  },
}
</script>

<style scoped>

</style>