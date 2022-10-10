<template>
  <component :is="icon" :size="size"/>
</template>

<script>
import {defineAsyncComponent} from "vue";
import IconLoading from "./IconLoading.vue";
import IconQuestionCircle from "./IconQuestionCircle.vue";

export default {
  name: "LoadIcon",
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
    }
  },
  computed: {
    icon() {
      if (this.iconName === undefined) {
        this.iconName = "IconQuestionCircle";
      }
      return defineAsyncComponent(
          {
            loader: () => import("./" + this.iconName + ".vue"),
            loadingComponent: IconLoading,
            errorComponent: IconQuestionCircle
          });

    }
  },
}
</script>

<style scoped>

</style>