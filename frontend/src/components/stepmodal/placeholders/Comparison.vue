<template>
    <div class="comparison-container">
      <Chart :chartInput="combinedInput" />
    </div>
  </template>
  
  <script>
  import Chart from "./Chart.vue";
  
  export default {
    name: "Comparison",
    components: { Chart },
    props: {
      title: {
        type: String,
        default: "Comparison Chart"
      },
      datasetA: {
        type: Object,
        required: true,
      },
      datasetB: {
        type: Object,
        required: true,
      },
    },
    computed: {
      combinedInput() {
        return {
          title: this.title,
          datasets: [this.datasetA, this.datasetB]
        };
      }
    }
  };
  </script>
  
  <style scoped>
  .comparison-container {
    padding: 1rem;
  }
  </style>
  