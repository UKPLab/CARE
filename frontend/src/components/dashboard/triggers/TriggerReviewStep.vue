<template>
  <div class="summary-container">
    <div
      v-for="section in sections"
      :key="section.title"
      class="mb-4"
    >
      <h6>{{ section.title }}</h6>
      <div
        v-for="item in section.items"
        :key="item.label"
        class="summary-item"
      >
        <strong>{{ item.label }}:</strong> {{ item.value }}
      </div>
    </div>
    <div class="alert alert-info mt-3">
      <i class="bi bi-info-circle"></i>
      Please review the information above before submitting.
    </div>
  </div>
</template>

<script>
export default {
  name: "TriggerReviewStep",
  props: {
    sections: {
      type: Array,
      required: true,
    },
  },
};
</script>

<style scoped>
.summary-container {
  padding: 1rem;
}

.summary-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.summary-item:last-of-type {
  border-bottom: none;
}

.summary-item strong {
  display: inline-block;
  min-width: 180px;
  color: #495057;
}
</style>
