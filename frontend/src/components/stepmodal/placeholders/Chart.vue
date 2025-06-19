<template>
  <div class="chart-container">
    <canvas v-if="chartConfig" ref="chartCanvas"></canvas>
    <p v-else class="text-muted"> ~ Placeholder data missing or invalid ~ </p>
  </div>
</template>

<script>
import { Chart, registerables } from 'chart.js';
import { debounce } from 'lodash';


/**
 * Component to render a chart based on the provided data and options.
 * This is mainly based on chart.js component. Flexible graphs can be built according to the data.
 *
 * @author: Manu Sundar Raj Nandyal
 */
export default {
  name: 'ChartComponent',
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
  data() {
    return {
      chartInstance: null,
    };
  },  
  computed: {
    chartConfig() {
      if (this.config?.type && this.config?.data && this.config?.options) {
        return this.config;
      }
      const stepId = this.config?.input?.stepId;
      const datasource = this.config?.input?.dataSource;
      if (!stepId || !datasource || !this.studyData[stepId]) {
        return null;
      }
      const chartElement = Object.values(this.studyData[stepId] || {}).find(item => item.key === datasource);
      const data = chartElement?.value;
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        return null;
      }
      const labels = Object.keys(data);
      const dataset = Object.values(data);
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: this.config.label || 'Überarbeitung',
              data: dataset,
              backgroundColor: '#EB7E47',
            },
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
              text: this.config.title || 'Chart',
            },
          },
          indexAxis: 'y',
          scales: {
            x: {
              ticks: {
                stepSize: 1,
                callback: function(value) {
                  if (Number.isInteger(value)) {
                    return value;
                  }
                },
              }
            }
          }
        },
      };
    },
  },
  mounted() {
    Chart.register(...registerables);
    if (this.chartConfig) {
      const ctx = this.$refs.chartCanvas.getContext('2d');
      this.chartInstance = new Chart(ctx, this.chartConfig);
    }
  },
  beforeUnmount() {
    this.destroyChart();
  },
  methods: {
    renderChart: debounce(function () {
    }, 100),
    destroyChart() {
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
    },
  },  
  watch: {
    config: {
      handler: 'renderChart',
      deep: true,
    },
  },
};
</script>

<style scoped>
canvas {
  max-width: 100%;
  height: auto;
}
</style>