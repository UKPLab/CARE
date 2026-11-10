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
    // A number shown on the tab button, e.g. the study step's number in the workflow
    number: {
      type: Number,
      required: false,
      default: null,
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