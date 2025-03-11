<template>
  <canvas ref="chartCanvas" :id="chartType + JSON.stringify(chartOptions)"></canvas>
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
  props: {
    chartType: {
      type: String,
      required: true,
      validator: (value) => {
        return [
          'bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'bubble', 'scatter',
        ].includes(value);
      },
    },
    chartData: {
      type: Object,
      required: true,
    },
    chartOptions: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      chartInstance: null,
      previousChartData: null,
      previousChartType: null,
      previousChartOptions: null,
    };
  },
  mounted() {
    Chart.register(...registerables);
    this.renderChart();
  },
  beforeUnmount() {
    this.destroyChart();
  },
  methods: {
    renderChart: debounce(function () {
      if (
        this.previousChartData === this.chartData &&
        this.previousChartType === this.chartType &&
        this.previousChartOptions === this.chartOptions
      ) {
        return;
      }

      this.previousChartData = this.chartData;
      this.previousChartType = this.chartType;
      this.previousChartOptions = this.chartOptions;

      this.destroyChart();
      const ctx = this.$refs.chartCanvas.getContext('2d');
      this.chartInstance = new Chart(ctx, {
        type: this.chartType,
        data: this.chartData,
        options: this.chartOptions,
      });
    }, 100), 
    destroyChart() {
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
    },
  },
  watch: {
    chartData: {
      handler: 'renderChart',
      deep: true,
    },
    chartType: {
      handler: 'renderChart',
    },
    chartOptions: {
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