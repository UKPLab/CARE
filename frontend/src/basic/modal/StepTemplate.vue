<template>
  <div class="step-template">
    <h5 v-if="title">{{ title }}</h5>
    <slot name="content" />
  </div>
</template>

<script>

/**
 * StepTemplate Component
 * 
 * A simple wrapper component that provides a slot for content.
 * Can be used in other components like GeneralStep to wrap content.
 */
export default {
  name: "StepTemplate",
  props: {
    title: {
      type: String,
      default: ""
    },
  },
};
</script>

<style scoped>
.step-template {
  width: 100%;
  height: 100%;
  padding: 1rem;
}

.step-template h5 {
  color: var(--bs-body-color, #495057);
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
}
</style>