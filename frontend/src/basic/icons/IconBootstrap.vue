<template>
  <svg
    class="bi"
    fill="currentColor"
    :height="size"
    :width="size"
    :style="(color)?'color:'+color:''"
  >
    <use
      :xlink:href="`${iconUrl}`"
    />
  </svg>
</template>

<script>
/**
 * Display icons from bootstrap folder
 *
 * @author: Dennis Zyska
 */
import iconPath from 'bootstrap-icons/bootstrap-icons.svg';

export default {
  name: "IconBootstrap",
  props: {
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      default: 16,
      required: false,
    },
     color: {
      type: String,
      default: null,
      required: false
    }
  },
  computed: {
    iconUrl() {
      return iconPath + "#" + this.name;
    }
  },
}
</script>

<style scoped>

</style>