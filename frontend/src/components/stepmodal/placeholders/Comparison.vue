<template>
  <div class="comparison-container">
    <Chart v-if="combinedInput" :chartInput="combinedInput" />
    <p v-else class="text-muted"> ~ Placeholder data missing or invalid ~ </p>
  </div>
</template>

<script>
/**
 * Component to render a comparison chart based on the provided input data.
 * This component is designed to compare two datasets on horizontal stacked bar chart.
 * 
 * @author: Manu Sundar Raj Nandyal
*/
import Chart from "./Chart.vue";

export default {
  name: "Comparison",
  components: { Chart },
  props: {
    input: {
      type: Array,
      required: true,
    },
    studySteps: {
      type: Array,
      required: true,
    },
    studyData: {
      type: Object,
      required: true,
    },
  },
  computed: {
    combinedInput() {
      return null; // Placeholder logic removed as it is now handled in StepModal.vue
    },
  },
};
</script>

<style scoped>
.comparison-container {
  padding: 1rem;
}
</style>
