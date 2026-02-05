<template>
  <NavBar />
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-bold leading-6 text-gray-900 dark:text-white">{{ t('backtest_report.title') }}</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{ t('backtest_report.strategy') }}: <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ strategyName }}</span>
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          v-if="selectedTimestamp"
          @click="confirmDelete"
          type="button"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto transition-colors duration-200"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          {{ t('backtest_report.delete_report') }}
        </button>
      </div>
    </div>

    <!-- Timestamp Selector -->
    <div class="mt-8">
      <div class="relative">
        <label for="timestamp-select" class="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
          <svg class="inline w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          {{ t('backtest_report.select_report') }}
        </label>
        <div class="relative">
          <select 
            id="timestamp-select" 
            v-model="selectedTimestamp" 
            @change="loadReportData" 
            class="appearance-none block w-full pl-4 pr-12 py-3 text-base border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
          >
            <option disabled value="" class="text-gray-500">{{ t('backtest_report.select_report_placeholder') }}</option>
            <option v-for="ts in timestamps" :key="ts" :value="ts" class="py-2">
              {{ formatTimestamp(ts) }}
            </option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
        <div v-if="timestamps.length > 0" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ timestamps.length }} {{ t('backtest_report.available_reports') }}
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="mt-8 flex justify-center">
      <LoadingSpinner />
    </div>

    <div v-if="error" class="mt-8">
       <ErrorMessage :message="error" />
    </div>

    <div v-if="reportData" class="mt-8 space-y-12">
      <!-- Performance Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.summary_title') }}</h2>
        <div class="mt-4 overflow-hidden bg-white dark:bg-gray-800 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg" v-if="totalPerformance">
            <dl class="divide-y divide-gray-300 dark:divide-gray-700">
                <div v-for="(value, key) in totalPerformance" :key="key">
                    <div v-if="key !== 'symbol' && key !== 'result_id'" class="grid grid-cols-2 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 sm:grid-cols-3">
                        <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ formatKey(key) }}</dt>
                        <dd class="text-sm font-semibold text-gray-900 dark:text-white col-span-1 sm:col-span-2">{{ formatValue(value, key) }}</dd>
                    </div>
                </div>
            </dl>
        </div>
      </section>

      <!-- Performance by Symbol Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.by_symbol_title') }}</h2>
        <div class="mt-4 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th v-for="header in symbolPerformanceHeaders" :key="header" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ formatKey(header) }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                <tr v-for="perf in symbolPerformance" :key="perf.symbol" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td v-for="header in symbolPerformanceHeaders" :key="header" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatValue(perf[header], header) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      </section>

      <!-- Equity Curve Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.equity_curve_title') }}</h2>
        <div class="mt-4 p-4 bg-white dark:bg-gray-900 shadow rounded-lg">
          <VueApexCharts
            v-if="!loading"
            :key="`equity-${selectedTimestamp}`"
            type="line"
            height="400"
            :options="equityCurveOptions"
            :series="equityCurveSeries"
          />
        </div>
      </section>

      <!-- Daily Returns Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.daily_returns_title') }}</h2>
        <div class="mt-4 p-4 bg-white dark:bg-gray-900 shadow rounded-lg">
          <VueApexCharts
            v-if="!loading"
            :key="`daily-${selectedTimestamp}`"
            type="bar"
            height="350"
            :options="dailyReturnsOptions"
            :series="dailyReturnsSeries"
          />
        </div>
      </section>

      <!-- Orders Table Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.orders_title') }}</h2>
        <div class="mt-4 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th v-for="header in orderTableHeaders" :key="header.key" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ header.label }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    <tr v-for="order in paginatedOrders" :key="order.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td v-for="header in orderTableHeaders" :key="header.key" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ order[header.key] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="reportData.orders.length > ordersToShow" class="mt-4 text-center">
                  <button @click="showMoreOrders" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200">
                    {{ t('backtest_report.show_more') }} ({{ ordersToShow }} / {{ reportData.orders.length }})
                  </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Trades Table Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.trades_title') }}</h2>
        <div class="mt-4 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th v-for="header in tradeTableHeaders" :key="header.key" scope="col"
                                        class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{
                                        header.label }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                <tr v-for="trade in paginatedTrades" :key="trade.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td v-for="header in tradeTableHeaders" :key="header.key" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ trade[header.key] }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-if="reportData.trades.length > tradesToShow" class="mt-4 text-center">
                        <button @click="showMoreTrades" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200">
                            {{ t('backtest_report.show_more') }} ({{ tradesToShow }} / {{ reportData.trades.length }})
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </section>

      <!-- Periodic Performance & Log Section -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.periodic_performance_title') }}</h2>
          <div class="mt-4 flow-root">
            <div class="overflow-x-auto">
                <div class="inline-block min-w-full py-2 align-middle">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th v-for="header in periodicPerformanceHeaders" :key="header.key" scope="col"
                                        class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{
                                        header.label }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                <tr v-for="perf in reportData.periodicPerformance" :key="perf.year" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                     <td v-for="header in periodicPerformanceHeaders" :key="header.key" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatValue(perf[header.key], header.key) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </div>
        </div>
        
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.log_title') }}</h2>
          <div class="mt-4 flow-root">
            <div class="h-96 overflow-auto bg-gray-900 text-white font-mono text-sm p-4 rounded-lg shadow ring-1 ring-black ring-opacity-5">
              <pre>{{ logContent }}</pre>
            </div>
          </div>
        </div>
      </section>

    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBacktestReportList, getBacktestReportData, getBacktestReportLog, deleteBacktestReport } from '@/api'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import VueApexCharts from 'vue3-apexcharts'
import NavBar from '@/components/NavBar.vue'

const { t, locale } = useI18n()

const props = defineProps({
  strategyName: {
    type: String,
    required: true
  }
})

const timestamps = ref([])
const selectedTimestamp = ref('')
const reportData = ref(null)
const logContent = ref('')
const loading = ref(false)
const error = ref(null)

const ordersToShow = ref(20)
const tradesToShow = ref(20)

const orderTableHeaders = computed(() => {
    const keys = ['time', 'symbol', 'order_side', 'order_type', 'price', 'qty', 'openclose', 'order_id'];
    return keys.map(key => ({
        key,
        label: t(`backtest_report.order_headers.${key}`)
    }));
});

const tradeTableHeaders = computed(() => {
    const keys = ['time', 'symbol', 'order_side', 'price', 'qty', 'status', 'order_id'];
    return keys.map(key => ({
        key,
        label: t(`backtest_report.trade_headers.${key}`)
    }));
});

const periodicPerformanceHeaders = computed(() => {
    const keys = ['year', 'total_pnl_rate', 'annualized_return_rate', 'sharpe_ratio', 'maximum_drawdown_rate'];
    return keys.map(key => ({
        key,
        label: t(`backtest_report.periodic_headers.${key}`)
    }));
});


const paginatedOrders = computed(() => {
  if (!reportData.value || !reportData.value.orders) {
    return []
  }
  return reportData.value.orders.slice(0, ordersToShow.value)
})

const paginatedTrades = computed(() => {
    if (!reportData.value || !reportData.value.trades) {
        return []
    }
    return reportData.value.trades.slice(0, tradesToShow.value)
})

const showMoreOrders = () => {
  ordersToShow.value += 20;
}

const showMoreTrades = () => {
    tradesToShow.value += 20;
}

const confirmDelete = () => {
  if (confirm(t('backtest_report.confirm_delete'))) {
    deleteReport();
  }
};

const deleteReport = async () => {
  if (!selectedTimestamp.value) return;

  loading.value = true;
  error.value = null;

  try {
    await deleteBacktestReport(props.strategyName, selectedTimestamp.value);
    
    // Remove the deleted timestamp from the list
    const index = timestamps.value.indexOf(selectedTimestamp.value);
    if (index > -1) {
      timestamps.value.splice(index, 1);
    }
    
    // Clear current data
    reportData.value = null;
    logContent.value = '';
    selectedTimestamp.value = '';
    
    // Select the first available timestamp if any
    if (timestamps.value.length > 0) {
      selectedTimestamp.value = timestamps.value[0];
      await loadReportData();
    }
    
    // Show success message
    alert(t('backtest_report.report_deleted'));
  } catch (err) {
    error.value = `Failed to delete report: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    const response = await getBacktestReportList(props.strategyName)
    timestamps.value = response
    if (timestamps.value.length > 0) {
      selectedTimestamp.value = timestamps.value[0]
      await loadReportData()
    }
  } catch (err) {
    error.value = `Failed to load backtest report list: ${err.message}`
  } finally {
    loading.value = false
  }
})

const loadReportData = async () => {
  if (!selectedTimestamp.value) return

  loading.value = true
  error.value = null
  reportData.value = null
  logContent.value = ''

  try {
    const dataResponse = await getBacktestReportData(props.strategyName, selectedTimestamp.value)
    reportData.value = dataResponse
    ordersToShow.value = 20 // Reset on new data load
    tradesToShow.value = 20 // Reset on new data load

    const logResponse = await getBacktestReportLog(props.strategyName, selectedTimestamp.value)
    if (Array.isArray(logResponse)) {
      logContent.value = logResponse.join('\n')
    } else {
      logContent.value = logResponse || ''
    }
  } catch (err) {
    error.value = `Failed to load report data: ${err.message}`
    reportData.value = null
    logContent.value = ''
  } finally {
    loading.value = false
  }
}

const equityCurveSeries = computed(() => {
  if (!reportData.value || !reportData.value.portfolioDetails) {
    return []
  }

  // Many backends emit multiple portfolioDetail rows with the same ts.
  // ApexCharts will draw vertical spikes when x is duplicated (same timestamp, different y).
  // We aggregate by ts to a single point per timestamp.
  const rows = [...reportData.value.portfolioDetails]
    .map(d => ({
      ts: parseInt(d.ts, 10),
      total: parseFloat(d.total_pnl),
      realized: parseFloat(d.realized_pnl),
      floating: parseFloat(d.floating_pnl),
    }))
    .filter(r => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts)

  const byTs = new Map()
  for (const r of rows) {
    // Keep the last total/floating for this timestamp; collect realized values to decide later.
    const prev = byTs.get(r.ts) || { ts: r.ts, total: NaN, floating: NaN, realizedVals: [] }
    if (Number.isFinite(r.total)) prev.total = r.total
    if (Number.isFinite(r.floating)) prev.floating = r.floating
    if (Number.isFinite(r.realized)) prev.realizedVals.push(r.realized)
    byTs.set(r.ts, prev)
  }

  const details = [...byTs.values()]
    .filter(d => Number.isFinite(d.total)) // need total to anchor the curve
    .sort((a, b) => a.ts - b.ts)

  const totalSeries = details.map(d => d.total)
  const realizedLast = details.map(d => (d.realizedVals.length ? d.realizedVals[d.realizedVals.length - 1] : 0))
  const realizedSumPerTs = details.map(d => d.realizedVals.reduce((acc, v) => acc + v, 0))

  // Heuristic: if realized is mostly 0 with spikes, treat it as delta-per-ts and accumulate the per-ts sums.
  const zeroishCount = realizedLast.filter(v => Math.abs(v) < 1e-12).length
  const looksLikeDelta = realizedLast.length > 10 && zeroishCount / realizedLast.length > 0.6

  const realizedDisplay = (() => {
    if (!looksLikeDelta) return realizedLast
    let acc = 0
    return realizedSumPerTs.map(v => {
      acc += v
      return acc
    })
  })()

  const floatingRaw = details.map(d => (Number.isFinite(d.floating) ? d.floating : NaN))
  const floatingValidCount = floatingRaw.filter(v => Number.isFinite(v)).length
  const derivedFloating = details.map((d, i) => d.total - realizedDisplay[i])
  const floatingDisplay =
    floatingValidCount === 0
      ? derivedFloating
      : floatingRaw.map((v, i) => (Number.isFinite(v) ? v : derivedFloating[i]))

  const totalPnlData = details.map((d, i) => [d.ts, totalSeries[i]])
  const realizedPnlData = details.map((d, i) => [d.ts, realizedDisplay[i]])
  const floatingPnlData = details.map((d, i) => [d.ts, floatingDisplay[i]])

  return [
    {
      name: t('backtest_report.total_pnl_series'),
      data: totalPnlData
    },
    {
      name: t('backtest_report.realized_pnl_series'),
      data: realizedPnlData
    },
    {
      name: t('backtest_report.floating_pnl_series'),
      data: floatingPnlData
    }
  ]
})

const equityCurveOptions = computed(() => {
  return {
    chart: {
      type: 'line',
      height: 400,
      zoom: {
        enabled: true
      },
      toolbar: {
        show: true
      }
    },
    colors: ['#546E7A', '#2E7D32', '#E91E63'],
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
      }
    },
    // Single Y axis: keep all PnL series on the same scale (no dual-axis).
    yaxis: {
      title: {
        text: t('backtest_report.pnl_axis'),
      },
      labels: {
        formatter: (value) => {
          if (typeof value !== 'number' || Number.isNaN(value)) return '0'
          return value.toFixed(2)
        },
      },
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy HH:mm:ss'
      },
    },
    stroke: {
      // Make realized PnL look like step changes when it updates discretely.
      curve: ['smooth', 'stepline', 'smooth'],
      width: 2,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
    },
    dataLabels: {
      enabled: false
    },
    noData: {
      text: 'No data available for the equity curve.'
    }
  }
})

const dailyReturnsSeries = computed(() => {
  if (!reportData.value || !reportData.value.dailyIndicators) {
    return []
  }
  const data = reportData.value.dailyIndicators.map(d => {
    const x = new Date(d.date).getTime();
    const y = parseFloat(d.daily_return);
    if (isNaN(x) || isNaN(y)) {
      return null;
    }
    return { x, y };
  }).filter(Boolean);

  return [{
    name: t('backtest_report.daily_return_series'),
    data
  }]
})

const dailyReturnsOptions = computed(() => ({
  chart: {
    type: 'bar',
    height: 350
  },
  title: {
    text: t('backtest_report.daily_returns_title'),
    align: 'left'
  },
  xaxis: {
    type: 'datetime'
  },
  yaxis: {
    title: {
      text: t('backtest_report.daily_pnl_axis')
    },
    labels: {
      formatter: (value) => {
        return typeof value === 'number' ? value.toFixed(2) : value
      }
    }
  },
  tooltip: {
    x: {
      format: 'dd MMM yyyy'
    },
    y: {
      formatter: (value) => {
        return typeof value === 'number' ? `${value.toFixed(2)}` : value
      }
    }
  }
}));

const formatValue = (value, key = '') => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return 'N/A';
  }

  const rateKeys = ['total_pnl_rate', 'win_rate', 'annualized_return_rate', 'maximum_drawdown_rate', 'trade_success_rate'];
  const num = parseFloat(value);

  if (isNaN(num)) {
    return value;
  }

  if (rateKeys.includes(key)) {
    return `${(num * 100).toFixed(2)}%`;
  }
  
  if (key.includes('ratio')) {
    return num.toFixed(3);
  }
  
  if (key.includes('time') && typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value)) {
    return value;
  }
  
  if (num % 1 === 0) {
    return num.toLocaleString();
  }
  
  return parseFloat(num.toFixed(4)).toLocaleString();
};

const formatKey = (key) => {
  if (!key) return '';
  const translation = t(`backtest_report.metrics.${key}`);
  // If translation is same as the key, it means no translation found, so format it.
  if (translation === `backtest_report.metrics.${key}`) {
      if (locale.value === 'en') return key; // For english, show raw key
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
  return translation;
};

const totalPerformance = computed(() => {
    if (!reportData.value || !Array.isArray(reportData.value.performance)) {
        return null;
    }
    return reportData.value.performance.find(p => p.symbol === 'Total');
});

const symbolPerformance = computed(() => {
    if (!reportData.value || !Array.isArray(reportData.value.performance)) {
        return [];
    }
    return reportData.value.performance.filter(p => p.symbol !== 'Total');
});

const symbolPerformanceHeaders = computed(() => {
    if (symbolPerformance.value.length === 0) {
        return [];
    }
    const headers = Object.keys(symbolPerformance.value[0]);
    // Move symbol to the front
    const symbolKey = 'symbol';
    if (headers.includes(symbolKey)) {
        return [symbolKey, ...headers.filter(h => h !== symbolKey)];
    }
    return headers;
});

const formatTimestamp = (ts) => {
  if (!ts || ts.length !== 14) return ts
  const year = ts.substring(0, 4)
  const month = ts.substring(4, 6)
  const day = ts.substring(6, 8)
  const hour = ts.substring(8, 10)
  const minute = ts.substring(10, 12)
  const second = ts.substring(12, 14)
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// Helper function for debugging data range
const getDataRange = (data) => {
  if (!data || data.length === 0) return { min: 'N/A', max: 'N/A' };
  const values = data.map(item => item[1]);
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
};

</script> 