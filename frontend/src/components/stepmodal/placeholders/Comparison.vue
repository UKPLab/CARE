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
      if (this.input.length !== 2) {
        return null;
      }

      const datasets = this.input.map((value, index) => {
        return {
          label: `Dataset ${index + 1}`,
          data: Object.values(value),
          backgroundColor: `rgba(${index === 0 ? '255, 99, 132' : '54, 162, 235'}, 0.5)`
        };
      });

      
      return {
        type: 'bar',
        data: {
          labels: Object.keys(this.input[0]),
          datasets,
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Comparison Chart',
            },
            indexAxis: "y",
          },
        },
      };
      
    },
  },
};
</script>

<style scoped>
.comparison-container {
  padding: 1rem;
}
</style>
