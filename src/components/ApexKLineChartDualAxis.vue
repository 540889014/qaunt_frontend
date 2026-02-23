<template>
  <div ref="chartRef" :style="{ height: height, width: width }"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { PropType } from 'vue'
import ApexCharts from 'apexcharts'
import type { ApexOptions } from 'apexcharts'

interface SeriesData {
  name: string;
  data: { x: any; y: any }[] | [number, number][];
  yaxis?: string;
  type?: string;
}

const props = defineProps({
  series: {
    type: Array as PropType<SeriesData[]>,
    required: true,
    default: () => []
  },
  height: {
    type: [Number, String],
    default: 500
  },
  width: {
    type: [Number, String],
    default: '100%'
  }
})

const chartRef = ref<HTMLElement | null>(null);
const chartInstance = ref<ApexCharts | null>(null);

const getChartOptions = (currentSeries: SeriesData[]): ApexOptions => {
  // IMPORTANT:
  // - Do NOT create one y-axis per series. That makes each line use its own scale,
  //   and visually breaks "Mean in the middle of Upper/Lower".
  // - We keep exactly 2 y-axes: Spread (left) and Z Score (right).
  const spreadSeriesNames = currentSeries.filter(s => s.yaxis !== 'zscore').map(s => s.name);
  const zScoreSeriesNames = currentSeries.filter(s => s.yaxis === 'zscore').map(s => s.name);

  const yaxes: any[] = [
    {
      title: { text: 'Spread' },
      labels: { formatter: (val: number) => val != null ? `${(val * 100).toFixed(2)}%` : '' },
      ...(spreadSeriesNames.length ? { seriesName: spreadSeriesNames } : {}),
    },
  ];

  if (zScoreSeriesNames.length) {
    yaxes.push({
      opposite: true,
      title: { text: 'Z Score' },
      labels: { formatter: (val: number) => val != null ? val.toFixed(2) : '' },
      seriesName: zScoreSeriesNames,
    });
  }

  return {
    series: currentSeries,
    chart: {
      type: 'line',
      height: props.height,
      animations: { enabled: false },
      toolbar: { show: true },
    },
    colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#546E7A', '#26a69a', '#D10CE8'],
    stroke: {
      curve: 'straight',
      width: currentSeries.map(s => (s.name === 'Spread' || s.name === 'Z Score') ? 2 : 1.5),
      dashArray: currentSeries.map(s => (s.name.includes('Upper') || s.name.includes('Lower')) ? 5 : 0),
    },
    markers: { size: 0 },
    xaxis: { type: 'datetime' },
    yaxis: yaxes,
    tooltip: {
      shared: true,
      intersect: false,
      x: { format: 'yyyy-MM-dd HH:mm:ss' },
      y: {
        formatter: (value: number, { seriesIndex, w }) => {
          if (value == null) return 'N/A';
          const seriesName = w.globals.seriesNames[seriesIndex];
          const spreadSeriesNames = ['Spread', 'Mean', 'Upper Band', 'Lower Band'];
          if (spreadSeriesNames.includes(seriesName)) {
            return `${(value * 100).toFixed(2)}%`;
          }
          return value.toFixed(4);
        }
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'center',
    },
  }
}

const initChart = () => {
  if (chartRef.value && props.series.length > 0) {
    if (chartInstance.value) {
      chartInstance.value.destroy();
    }
    const options = getChartOptions(props.series);
    chartInstance.value = new ApexCharts(chartRef.value, options);
    chartInstance.value.render();
  }
}

onMounted(initChart);

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }
});

watch(() => props.series, () => {
  initChart();
}, { deep: true });

</script> 