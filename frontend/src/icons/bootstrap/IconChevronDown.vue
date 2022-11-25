<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="size" :height="size" fill="currentColor" class="bi bi-chevron-down"
       viewBox="0 0 16 16">
    <path fill-rule="evenodd"
          d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
  </svg>
</template>

<script>
export default {
  name: "IconChevronDown",
  props: {
    size: {
      type: Number,
      default: 16,
      required: false,
    }
  }
}
</script>

<style scoped>

</style>