<template>
  <div>
  <canvas ref="chartCanvas"> </canvas>
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
  props: {
    chartInput: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      chartInstance: null,
      previousChartInput: null,
    };
  },
  mounted() {
    Chart.register(...registerables);
    //this.renderChart();
    const ctx = this.$refs.chartCanvas.getContext('2d');
      this.chartInstance = new Chart(ctx, {
        type: this.chartInput["type"],	
        data: this.chartInput["data"],
        options: this.chartInput["options"],
      });
      console.log("Instance",this.chartInstance);
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
    chartInput: {
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