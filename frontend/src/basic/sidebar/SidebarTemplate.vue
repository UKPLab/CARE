<template>
  <slot name="content"/>
</template>

<script>
export default {
  name: "SidebarTemplate",
  props: {
    icon: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: false,
      default: "",
    },
    buttons: {
      type: Array,
      required: false,
      default: () => [],
    }

  },
}
</script>

<style scoped>

</style>