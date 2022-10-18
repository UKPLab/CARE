<template>
  <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M29.71,15.29l-3-3h0l-10-10a1,1,0,0,0-1.42,0l-10,10h0l-3,3a1,1,0,0,0,0,1.42,1,1,0,0,0,1.42,0L5,15.41V29a1,1,0,0,0,1,1H26a1,1,0,0,0,1-1V15.41l1.29    ,1.3a1,1,0,0,0,1.42,0A1,1,0,0,0,29.71,15.29ZM25,28H7V13.41l9-9,9,9Z"/>
  </svg>
</template>

<script>
export default {
  name: "HomeIcon.vue",
  props: {
    size: {
      type: Number,
      default: 16,
      required: false,
    }
  }
}
</script>
