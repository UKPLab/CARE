<template>
  <IconLoading
    v-if="trueIconName === 'loading'"
    :size="size"
    :style="rotateStyle"
  />
  <!-- Rendered here directly instead of through IconBootstrap: one component per icon instead
       of two. Tables render several icons per row, so the extra layer added up on every page. -->
  <svg
    v-else
    class="bi"
    fill="currentColor"
    :height="size"
    :width="size"
    :cursor="cursor"
    :style="[color ? { color } : null, rotateStyle]"
  >
    <use :xlink:href="href" />
  </svg>
</template>

<script>
/**
 * Render an icon from the bootstrap sprite (or the loading spinner for "loading")
 *
 * @author: Dennis Zyska, Nils Dycke
 */
import IconLoading from "./icon/IconLoading.vue";
import { iconHref } from "./icon/iconSprite.js";

export default {
  name: "BasicIcon",
  components: { IconLoading },
  props: {
    size: {
      type: Number,
      default: 16,
      required: false,
    },
    iconName: {
      type: String,
      default: "IconQuestionCircle",
      required: false,
    },
    color: {
      type: String,
      default: null,
      required: false
    },
    cursor: {
      type: String,
      default: null,
      required: false
    },
    rotate: {
      type: Number,
      default: null,
      required: false
    }
  },
  computed: {
    trueIconName(){
      return this.iconName ? this.iconName : "question-circle";
    },
    rotateStyle() {
      return this.rotate ? { transform: `rotate(${this.rotate}deg)` } : {};
    },
    href() {
      return iconHref(this.trueIconName);
    },
  },
}
</script>

<style scoped>

</style>