<template>
  <div ref="chartContainer" class="tv-chart-container"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createChart } from 'lightweight-charts'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  width: {
    type: Number,
    default: 900
  },
  height: {
    type: Number,
    default: 400
  }
})

const chartContainer = ref(null)
let chart = null
let candleSeries = null

const formatData = (data) => {
  // 期望格式: { time: 秒级时间戳, open, high, low, close }
  return data.map(k => ({
    time: Math.floor(new Date(k.timestamp).getTime() / 1000),
    open: k.openPrice,
    high: k.highPrice,
    low: k.lowPrice,
    close: k.closePrice
  }))
}

const renderChart = () => {
  if (chart) {
    chart.remove()
    chart = null
    candleSeries = null
  }
  chart = createChart(chartContainer.value, {
    width: props.width,
    height: props.height,
    layout: {
      background: { color: '#fff' },
      textColor: '#333'
    },
    grid: {
      vertLines: { color: '#eee' },
      horzLines: { color: '#eee' }
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false
    },
    rightPriceScale: {
      borderColor: '#ccc'
    }
  })
  candleSeries = chart.addCandlestickSeries()
  candleSeries.setData(formatData(props.data))
}

watch(() => props.data, () => {
  renderChart()
}, { deep: true })

onMounted(() => {
  renderChart()
})

onBeforeUnmount(() => {
  if (chart) {
    chart.remove()
    chart = null
    candleSeries = null
  }
})
</script>

<style scoped>
.tv-chart-container {
  width: 100%;
  min-width: 300px;
  min-height: 300px;
}
</style> 