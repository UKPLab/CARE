<template>
  <component
    :is="icon"
    :size="size"
    :color="color"
    :name="iconName"
    :cursor="cursor"
    :style="rotateStyle"
  />
</template>

<script>
/**
 * Dynamically load icons from bootstrap folder
 *
 * @author: Dennis Zyska, Nils Dycke
 */
import {defineAsyncComponent} from "vue";
import IconLoading from "./icon/IconLoading.vue";
import IconBootstrap from "./icon/IconBootstrap.vue";

export default {
  name: "BasicIcon",
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
    icon() {
      if (this.trueIconName === "loading") {
        return IconLoading;
      }
      return defineAsyncComponent(
          {
            loader: () => import("./icon/IconBootstrap.vue"),
            loadingComponent: IconLoading,
            errorComponent: IconBootstrap
          });

    }
  },
}
</script>

<style scoped>

</style>