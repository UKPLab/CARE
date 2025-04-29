<template>
    <div class="text-placeholder">
      <p v-if="text">{{ text }}</p>
      <p v-else class="text-muted"> ~ Placeholder data missing ~ </p>
    </div>
  </template>
  
  <script>
  /**
   * Text placeholder component to display dynamic text content.
   * 
   * @author: Manu Sundar Raj Nandyal
   */
  export default {
    name: "Text",
    props: {
      text: {
        type: String,
        required: false,
        default: '',
      },
    },
  };
  </script>
  
  <style scoped>
  .text-placeholder {
    font-size: 1rem;
    line-height: 1.5;
    color: #212529;
    background-color: #ffffff;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    border: 1px solid #dee2e6;
  }
  </style>
  