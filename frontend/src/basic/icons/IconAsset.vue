<template>
  <img
    class="bi"
    fill="currentColor"
    :height="height ? height : ''"
    :width="width ? width : ''"
    :style="(color)?'color:'+color:''"
    :src="`/icons/${name}.svg`"
    alt="CARE"
  >
</template>

<script>
export default {
  name: "IconAsset",
  props: {
    name: {
      type: String,
      required: true,
    },
    height: {
      type: Number,
      default: null,
      required: false,
    },
    width: {
      type: Number,
      default: null,
      required: false,
    },
     color: {
      type: String,
      default: null,
      required: false
    }
  },
}
</script>

<style scoped>

</style>