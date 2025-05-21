<template>
  <div class="comparison-container">    <Chart v-if="chartConfig" :config="chartConfig" />
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
      
      const data1 = comparisonData[0] || {};
      const data2 = comparisonData[1] || {};
      
      const { labels, dataset1, dataset2 } = this.processComparisonData(data1, data2);
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: this.config.labels?.[0] || 'Dataset 1',
              data: dataset1,
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
            {
              label: this.config.labels?.[1] || 'Dataset 2',
              data: dataset2,
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
            }
          ],
        },
        options: {
          responsive: true,          plugins: {
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
            x: { stacked: true },
            y: { stacked: true },
          },
        },
      };
    },
  },
  methods: {
    processComparisonData(data1, data2) {
      const allKeys = Array.from(new Set([...Object.keys(data1 || {}), ...Object.keys(data2 || {})]));
      const dataset1 = [];
      const dataset2 = [];
      const stack = [];

      for (const key of allKeys) {
        const v1 = data1?.[key] ?? 0;
        const v2 = data2?.[key] ?? 0;
          if (v1 === v2) {
          // Case 1: Equal values - show first dataset completely, no stacking for second
          dataset1.push(v1);
          dataset2.push(0);
          stack.push(0);
        } else if (v1 < v2) {
          // Case 2: First is smaller - show first completely, second stacks the difference
          dataset1.push(v1);
          dataset2.push(v2 - v1);
          stack.push(1);
        } else {
          // Case 3: Second is smaller - show second completely, first stacks the difference
          dataset1.push(v1 - v2);
          dataset2.push(v2);
          stack.push(2);
        }
      }
      
      return { labels: allKeys, dataset1, dataset2, stack };
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
