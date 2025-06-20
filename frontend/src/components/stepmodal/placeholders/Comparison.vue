<template>
  <div class="comparison-container">
    <Chart v-if="chartConfig" :config="chartConfig" />
    <p v-else class="text-muted"> ~ Placeholder data missing or invalid ~ </p>
  </div>
</template>

<script>
/**
 * Component to render a comparison chart based on the provided input data.
 * This component is designed to compare two datasets on a stacked bar chart.
 * 
 * @author: Manu Sundar Raj Nandyal
*/
import Chart from "./Chart.vue";

export default {
  name: "Comparison",
  components: { Chart },
  inject: {
    studyData: {
      type: Object,
      required: true,
      default: () => null,
    },
  },  
  props: {
    config: {
      type: Object,
      required: true,
    },
  },
  computed: {    
    chartConfig() {
      if (!this.config || !Array.isArray(this.config.input) || !this.studyData) {
        return null;
      }
      const comparisonData = this.config.input.map(({ stepId, dataSource }) => {
        const comparisonElement = Object.values(this.studyData[stepId] || {}).find(item => item.key === dataSource);
        return comparisonElement?.value || null;
      });
      const data1 = comparisonData[0];
      const data2 = comparisonData[1];
      if (
        (!data1 || typeof data1 !== 'object' || Array.isArray(data1) || Object.keys(data1).length === 0) ||
        (!data2 || typeof data2 !== 'object' || Array.isArray(data2) || Object.keys(data2).length === 0)
      ) {
        return null;
      }
      const labels = Array.from(new Set([...Object.keys(data1), ...Object.keys(data2)]));
      const dataset1 = labels.map(label => data1[label] ?? 0);
      const dataset2 = labels.map(label => data2[label] ?? 0);
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: this.config.labels?.[0] || 'Überarbeitung 1',
              data: dataset1,
              backgroundColor: '#EB7E47',
            },
            {
              label: this.config.labels?.[1] || 'Überarbeitung 2',
              data: dataset2,
              backgroundColor: '#4BD0FF',
            }
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: this.config.title || 'Comparison Chart',
            },
          },
          indexAxis: 'y',
          scales: {
            x: { 
              stacked: true,
              ticks: {
                stepSize: 1,
                callback: function(value) {
                  if (Number.isInteger(value)) {
                    return value;
                  }
                },
              }
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
