<template>
  <component :is="icon" :size="size" :name="iconName"/>
</template>

<script>
/* Dynamic Load Icons from bootstrap folder

Author: Dennis Zyska (zyska@ukp...), Nils Dycke (dycke@ukp...)
 */
import {defineAsyncComponent} from "vue";
import IconLoading from "./IconLoading.vue";
import IconBootstrap from "./IconBootstrap.vue";

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
      let iconComponent = this.iconName;
      if (this.iconName === undefined || this.iconName === null) {
        iconComponent = "IconQuestionCircle";
      }
      if (this.iconName === "loading") {
        return IconLoading;
      }
      return defineAsyncComponent(
          {
            loader: () => import("./IconBootstrap.vue"),
            loadingComponent: IconLoading,
            errorComponent: IconBootstrap
          });

    }
  },
}
</script>

<style scoped>

</style>