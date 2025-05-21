<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
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

      const stepId = this.config.input.stepId;
      const datasource = this.config.input.dataSource;

      const chartElement = Object.values(this.studyData[stepId] || {}).find(item => item.key === datasource);

      const data = chartElement?.value;
      const labels = Object.keys(data);
      const dataset = Object.values(data);      
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: this.config.label || 'Dataset',
              data: dataset,
              backgroundColor: "rgba(255, 99, 132, 0.5)",
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
        },
      };
    },
  },  
  mounted() {
    Chart.register(...registerables);
    const ctx = this.$refs.chartCanvas.getContext('2d');
    this.chartInstance = new Chart(ctx, this.chartConfig);
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