<template>
  <div ref="chart"></div>
</template>

<script>
import ApexCharts from 'apexcharts'
import { computed } from 'vue'

export default {
  name: 'BacktestResultChart',
  props: {
    chartData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      chart: null
    }
  },
  mounted() {
    this.renderChart()
  },
  watch: {
    chartData: {
      deep: true,
      handler() {
        this.renderChart()
      }
    }
  },
  setup(props) {
    const chartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        title: {
          display: true,
          text: 'ポートフォリオ資産曲線',
          font: {
            size: 18
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '時間'
          }
        },
        y: {
          title: {
            display: true,
            text: '総資産'
          }
        }
      }
    }));

    return {
      chartOptions
    }
  },
  methods: {
    renderChart() {
      const options = {
        chart: {
          type: 'line',
          height: 350
        },
        series: [{
          name: 'PNL',
          data: this.chartData
        }],
        xaxis: {
          type: 'datetime'
        },
        title: {
          text: 'Backtest PNL Over Time'
        }
      }
      if (this.chart) {
        this.chart.updateOptions(options)
      } else {
        this.chart = new ApexCharts(this.$refs.chart, options)
        this.chart.render()
      }
    }
  }
}
</script>

<style scoped>
</style> 