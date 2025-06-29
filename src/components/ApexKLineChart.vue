<template>
  <div class="kline-chart">
    <apexcharts
      :options="chartOptions"
      :series="series"
      :width="width"
      :height="height"
      :type="chartType"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import ApexCharts from 'apexcharts'
app.use(VueApexCharts)
const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  width: {
    type: Number,
    default: 800
  },
  height: {
    type: Number,
    default: 400
  }
})

const emit = defineEmits(['pan'])

const chartType = computed(() => {
  // 多条线series
  if (props.data.length && props.data[0]?.name && props.data[0]?.data) {
    return 'line'
  }
  if (props.data.length && Array.isArray(props.data[0]?.y)) {
    return 'candlestick'
  }
  return 'line'
})

const isPercent = computed(() => {
  // 判断是否为比率数据（价差线）
  if (props.data.length && props.data[0]?.name === '价差') {
    // 检查数据中是否有y绝对值小于1的点，且不是K线
    return props.data[0].data.some(pt => Math.abs(pt.y) < 1 && pt.y !== null)
  }
  if (props.data.length && !props.data[0]?.name && typeof props.data[0]?.y === 'number') {
    return props.data.some(pt => Math.abs(pt.y) < 1 && pt.y !== null)
  }
  return false
})

const chartOptions = ref({
  chart: {
    animations: {
      enabled: false
    },
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true
      }
    },
    zoom: {
      enabled: true,
      type: 'x',
      autoScaleYaxis: true
    },
    events: {
      panned: (chartContext, { xaxis }) => {
        emit('pan', { detail: { xaxis } })
      }
    }
  },
  title: {
    text: computed(() => {
      if (props.data.length && props.data[0]?.name === 'Z Score') {
        return 'Z 分数线';
      }
      return chartType.value === 'candlestick' ? 'K线图' : '价差线';
    }),
    align: 'left'
  },
  xaxis: {
    type: 'datetime',
    labels: {
      datetimeUTC: false
    }
  },
  yaxis: computed(() => {
    const yAxes = [
      {
        title: {
          text: 'Spread'
        },
        tooltip: {
          enabled: true
        },
        labels: {
          formatter: val => isPercent.value && typeof val === 'number' ? (val * 100).toFixed(2) + '%' : val
        }
      },
      {
        opposite: true,
        title: {
          text: 'Z Score'
        },
        tooltip: {
          enabled: true
        },
        labels: {
          formatter: val => typeof val === 'number' ? val.toFixed(2) : val
        }
      }
    ];
    return yAxes;
  }),
  tooltip: {
    enabled: true,
    x: {
      format: 'yyyy-MM-dd HH:mm:ss'
    },
    y: {
      formatter: val => isPercent.value && typeof val === 'number' ? (val * 100).toFixed(2) + '%' : val
    }
  }
})

const series = ref([{
  data: []
}])

const chartData = computed(() => {
  // 多条线series
  if (props.data.length && props.data[0]?.name && props.data[0]?.data) {
    return props.data
  }
  // K线数据
  if (props.data.length && Array.isArray(props.data[0]?.y)) {
    return [{ data: props.data }]
  }
  // 单值数据（价差线/布林线）
  return [{ data: props.data }]
})

watch(() => props.data, (newData) => {
  if (newData && newData.length > 0) {
    series.value = chartData.value.map((serie, index) => {
      if (serie.yAxis === 'opposite') {
        return { ...serie, yAxisIndex: 1 };
      }
      return { ...serie, yAxisIndex: 0 };
    });
    // 自动设置线宽：主线2，其它1
    chartOptions.value.stroke = {
      width: Array.isArray(series.value)
        ? series.value.map((s, i) => i === 0 ? 2 : 1)
        : 2,
      curve: 'straight'
    }
  }
}, { deep: true })

onMounted(() => {
  if (props.data && props.data.length > 0) {
    series.value = chartData.value.map((serie, index) => {
      if (serie.yAxis === 'opposite') {
        return { ...serie, yAxisIndex: 1 };
      }
      return { ...serie, yAxisIndex: 0 };
    });
    chartOptions.value.stroke = {
      width: Array.isArray(series.value)
        ? series.value.map((s, i) => i === 0 ? 2 : 1)
        : 2,
      curve: 'straight'
    }
  }
})

// 更新图表系列
function updateSeries() {
  if (chartInstance.value) {
    const seriesData = props.series.map((s, index) => ({
      name: s.name,
      data: s.data,
      yAxisIndex: s.yAxis === 'opposite' ? 1 : 0
    }));
    
    console.log('Updating chart with series:', seriesData.map(s => `${s.name}: ${s.data.length} points`));
    
    // 更新系列数据
    chartInstance.value.updateSeries(seriesData.map(s => ({
      name: s.name,
      data: s.data
    })));
    
    // 更新 Y 轴配置，确保系列正确分配到对应的轴上
    chartInstance.value.updateOptions({
      yaxis: [{
        title: {
          text: 'Spread'
        },
        labels: {
          formatter: function (value) {
            return value.toFixed(2)
          }
        },
        seriesName: seriesData.filter(s => s.yAxisIndex === 0).map(s => s.name)
      }, {
        opposite: true,
        title: {
          text: 'Z Score'
        },
        labels: {
          formatter: function (value) {
            return value.toFixed(2)
          }
        },
        seriesName: seriesData.filter(s => s.yAxisIndex === 1).map(s => s.name)
      }]
    });
    
    console.log('Chart updated with dual Y-axis configuration, Z Score series assigned to opposite axis');
  }
}
</script>

<style scoped>
.kline-chart {
  width: 100%;
  height: 100%;
}
</style> 