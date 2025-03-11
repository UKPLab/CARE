  <template>
    <canvas ref="chartCanvas" :id="chartType+chartOptions"></canvas>
  </template>
  
  <script>
  import { Chart, registerables } from 'chart.js';
  
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
    mounted() {
      Chart.register(...registerables);
      this.renderChart();
    },
    beforeUnmount() {
      this.$refs.chartCanvas.remove();
    },
    methods: {
      renderChart() {
        const ctx = this.$refs.chartCanvas.getContext('2d');
        new Chart(ctx, {
          type: this.chartType,
          data: this.chartData,
          options: this.chartOptions,
        });
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