<template>
  <div class="comparison-container">
    <Chart v-if="chartConfig" :chartInput="chartConfig" />
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
      type: Object,
      required: true,
    }
  },
  computed: {
    chartConfig() {
      if (!this.input || !Array.isArray(this.input.data)) {
        return null;
      }

      const comparisonData = this.input.data;
      
      // Create datasets for the chart
      const datasets = comparisonData.map((value, index) => {
        return {
          label: this.input.labels?.[index] || `Dataset ${index + 1}`,
          data: value ? Object.values(value) : [],
          backgroundColor: `rgba(${index === 0 ? '255, 99, 132' : '54, 162, 235'}, 0.5)`
        };
      });

      // Return chart configuration
      return {
        type: 'bar',
        data: {
          labels: Object.keys(comparisonData?.[0]),
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
              text: this.input.title || 'Comparison Chart',
            },
          },
          indexAxis: 'y',
          scales: {
            x: {
              stacked: true,
            },
            y: {
              stacked: true,
            },
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
  width: 100%;
}
</style>
