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
  },  computed: {
    chartConfig() {
      // Default configuration
      const defaultConfig = {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: ' ',
              data: [],
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: '',
            },
          },
          indexAxis: 'y'
        },
      };

      // If the chart is already properly configured with type, data, and options, use it directly
      if (this.chartInput.type && this.chartInput.data && this.chartInput.options) {
        // Ensure responsive options are set
        const options = {
          ...this.chartInput.options,
          responsive: true,
          maintainAspectRatio: false
        };
        
        return {
          ...this.chartInput,
          options
        };
      }

      // Handle simplified data input
      if (this.chartInput.rawData) {
        const data = this.chartInput.rawData;
        
        return {
          type: this.chartInput.chartType || defaultConfig.type,
          data: {
            labels: data ? Object.keys(data) : [],
            datasets: [
              {
                label: this.chartInput.label || defaultConfig.data.datasets[0].label,
                data: data ? Object.values(data) : [],
                backgroundColor: this.chartInput.backgroundColor || defaultConfig.data.datasets[0].backgroundColor,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: this.chartInput.legendPosition || defaultConfig.options.plugins.legend.position,
              },
              title: {
                display: true,
                text: this.chartInput.title || defaultConfig.options.plugins.title.text,
              },
            },
            indexAxis: this.chartInput.indexAxis || defaultConfig.options.indexAxis
          },
        };
      }
      
      return this.chartInput;
    }
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