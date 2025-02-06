<template>
    <div class="placeholder-container">
      <!-- Preview Before -->
      <p class="mb-2">
        <span class="text-dark">
          {{ placeholder.previewBefore.length > 100 ? placeholder.previewBefore.slice(0, 100) + '...' : placeholder.previewBefore }}
        </span>
      </p>
  
      <h6 class="text-secondary mb-3">Add here the information for the placeholder:</h6>
  
      <!-- Input Fields -->
      <div v-if="fields.length">
        <div v-for="field in fields" :key="field.name" class="mb-3">
          <label :for="'field-' + field.name + '-' + index" class="form-label">
            {{ field.label }}
          </label>
          <input
            type="text"
            class="form-control"
            :id="'field-' + field.name + '-' + index"
            :placeholder="field.placeholder"
            v-model="formData[field.name]" 
            :required="field.required"
          />
        </div>
      </div>
  
      <!-- Preview After -->
      <p class="mt-2">
        <span class="text-dark">
          {{ placeholder.previewAfter.length > 100 ? placeholder.previewAfter.slice(0, 100) + '...' : placeholder.previewAfter }}
        </span>
      </p>
    </div>
  </template>
  
  <script>
  export default {
    name: "Placeholder",
    props: {
      placeholder:
      { type: Object,
        required: true,
        default: ""
      },
      fields: {
        type: Array,
        required: true,
        default: []
      },
      index: {
        type: Number,
        required: true,
        default: 0
      },
      formData: {
        type: Object,
        required: true,
        default: {}
      }
    }
  };
  </script>
  
  <style scoped>
  .placeholder-container {
    padding: 10px;
    border-bottom: 1px solid #ddd;
  }
  .form-label {
    font-weight: bold;
  }
  </style>
  