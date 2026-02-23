<template>
  <NavBar />
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-bold leading-6 text-gray-900 dark:text-white">{{ t('backtest_report.title') }}</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          <span v-if="strategyName">{{ t('backtest_report.strategy') }}: <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ strategyName }}</span></span>
          <span v-else-if="instanceId">{{ t('backtest_report.instance_id') }}: <span class="font-semibold text-indigo-600 dark:text-indigo-400">#{{ instanceId }}</span></span>
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

    <!-- Timestamp Selector (only show if multiple timestamps available) -->
    <div v-if="timestamps.length > 1" class="mt-8">
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
            @change="instanceId ? loadReportDataByInstanceId(instanceId, selectedTimestamp) : loadReportData()" 
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

      <!-- Final Open Positions Section -->
      <section v-if="openPositions && openPositions.length">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.open_positions_title') }}</h2>
        <div class="mt-4 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.symbol') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.side') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.quantity') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.avg_entry') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.mark') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.unrealized_pnl') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.open_time') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.holding_time') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    <tr v-for="(p, idx) in openPositions" :key="idx" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-200">{{ p.symbol }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-200">{{ formatPosSide(p.side) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatNum(p.quantity) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatNum(p.avg_entry) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatNum(p.mark) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm" :class="Number(p.unrealized_pnl) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                        {{ formatNum(p.unrealized_pnl) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatTs(p.open_ts) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatDuration(p.holding_ms) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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
import { useRoute } from 'vue-router'
import { getBacktestReportList, getBacktestReportData, getBacktestReportLog, deleteBacktestReport, getBacktestReportTimestampsByInstanceId, getBacktestReportDataByInstanceId } from '@/api'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import VueApexCharts from 'vue3-apexcharts'
import NavBar from '@/components/NavBar.vue'

const { t, locale } = useI18n()
const route = useRoute()

const props = defineProps({
  strategyName: {
    type: String,
    required: false
  },
  instanceId: {
    type: [String, Number],
    required: false
  }
})

const timestamps = ref([])
const selectedTimestamp = ref('')
const reportData = ref(null)
const logContent = ref('')
const loading = ref(false)
const error = ref(null)

// Get instanceId from props or route
const instanceId = computed(() => props.instanceId || route.params.instanceId)
const strategyName = computed(() => props.strategyName || route.params.strategyName)

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
    // Check if we're using instanceId-based route
    const currentInstanceId = instanceId.value
    if (currentInstanceId) {
      // Load reports by instance ID (from database)
      const response = await getBacktestReportTimestampsByInstanceId(currentInstanceId)
      // API interceptor extracts data field, so response is already the data array
      timestamps.value = Array.isArray(response) ? response : (response?.data || [])
      if (timestamps.value.length > 0) {
        selectedTimestamp.value = timestamps.value[0]
        await loadReportDataByInstanceId(currentInstanceId, selectedTimestamp.value)
      } else {
        // If no timestamps, try to load directly (single report scenario)
        await loadReportDataByInstanceId(currentInstanceId)
      }
    } else if (strategyName.value) {
      // Legacy: Load reports by strategy name (from file system)
      const response = await getBacktestReportList(strategyName.value)
      // API interceptor extracts data field
      timestamps.value = Array.isArray(response) ? response : (response?.data || [])
      if (timestamps.value.length > 0) {
        selectedTimestamp.value = timestamps.value[0]
        await loadReportData()
      }
    } else {
      error.value = 'Either strategyName or instanceId must be provided'
    }
  } catch (err) {
    error.value = `Failed to load backtest report list: ${err.message}`
  } finally {
    loading.value = false
  }
})

const loadReportData = async () => {
  if (!selectedTimestamp.value || !props.strategyName) return

  loading.value = true
  error.value = null
  reportData.value = null
  logContent.value = ''

  try {
    const dataResponse = await getBacktestReportData(props.strategyName, selectedTimestamp.value)
    reportData.value = dataResponse.data || dataResponse
    ordersToShow.value = 20 // Reset on new data load
    tradesToShow.value = 20 // Reset on new data load

    const logResponse = await getBacktestReportLog(props.strategyName, selectedTimestamp.value)
    const logData = logResponse.data || logResponse
    if (Array.isArray(logData)) {
      logContent.value = logData.join('\n')
    } else {
      logContent.value = logData || ''
    }
  } catch (err) {
    error.value = `Failed to load report data: ${err.message}`
    reportData.value = null
    logContent.value = ''
  } finally {
    loading.value = false
  }
}

const loadReportDataByInstanceId = async (instanceIdParam, timestampParam = null) => {
  loading.value = true
  error.value = null
  reportData.value = null
  logContent.value = ''

  try {
    const dataResponse = await getBacktestReportDataByInstanceId(instanceIdParam, timestampParam)
    // API interceptor extracts data field, so dataResponse is already the BacktestReportDto
    reportData.value = dataResponse
    ordersToShow.value = 20 // Reset on new data load
    tradesToShow.value = 20 // Reset on new data load
    
    // Log content is not available from database yet, set empty
    logContent.value = 'Log content not available for database-backed reports.'
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
    // Prefer USDT PnL for charting to avoid unit confusion.
    // Fallback to daily_return (rate) for backward compatibility.
    const yRaw = d.daily_pnl_usdt ?? d.daily_pnl ?? d.daily_return;
    const y = parseFloat(yRaw);
    if (isNaN(x) || isNaN(y)) {
      return null;
    }
    return { x, y };
  }).filter(Boolean);

  return [{
    name: t('backtest_report.daily_pnl_usdt_series'),
    data
  }]
})

const dailyReturnsOptions = computed(() => ({
  chart: {
    type: 'bar',
    height: 350
  },
  dataLabels: {
    enabled: false
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
        return typeof value === 'number' ? `${value.toFixed(2)} USDT` : value
      }
    }
  }
}));

const openPositions = computed(() => {
  return reportData.value?.openPositions || []
})

const formatNum = (v) => {
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return 'N/A'
  return n.toFixed(4)
}

const formatTs = (ts) => {
  const n = parseInt(ts, 10)
  if (!Number.isFinite(n) || n <= 0) return 'N/A'
  return new Date(n).toLocaleString()
}

const formatDuration = (ms) => {
  const n = parseInt(ms, 10)
  if (!Number.isFinite(n) || n <= 0) return '0'
  const sec = Math.floor(n / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const formatPosSide = (side) => {
  if (!side) return 'N/A'
  const s = String(side).toUpperCase()
  if (s === 'LONG') return t('backtest_report.long')
  if (s === 'SHORT') return t('backtest_report.short')
  return s
}

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
  // Try to get translation from metrics
  const translation = t(`backtest_report.metrics.${key}`, null);
  // If translation exists and is different from the key path, use it
  if (translation && translation !== `backtest_report.metrics.${key}`) {
    return translation;
  }
  // Fallback: format the key for Chinese locale
  if (locale.value === 'zh') {
    // Chinese key mappings for common fields
    const chineseMap = {
      'symbol': '交易对',
      'total_pnl_rate': '总盈亏率',
      'annualized_return_rate': '年化收益率',
      'sharpe_ratio': '夏普比率',
      'calmar_ratio': '卡玛比率',
      'sortino_ratio': '索提诺比率',
      'win_rate': '胜率',
      'profit_factor': '盈亏比',
      'average_win': '平均盈利',
      'average_loss': '平均亏损',
      'largest_win': '最大盈利',
      'largest_loss': '最大亏损',
      'maximum_drawdown_rate': '最大回撤率',
      'total_trades': '总交易数',
      'winning_trades': '盈利交易数',
      'losing_trades': '亏损交易数',
      'total_fees': '总手续费',
      'final_equity': '最终权益',
      'initial_balance': '初始余额'
    };
    if (chineseMap[key]) {
      return chineseMap[key];
    }
    // Fallback: format key with spaces and capitalize
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  // For English, show formatted key
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  if (!ts) return ts
  // Handle timestamp format: yyyyMMddHHmmss (14 digits)
  if (typeof ts === 'string' && ts.length === 14 && /^\d+$/.test(ts)) {
    const year = ts.substring(0, 4)
    const month = ts.substring(4, 6)
    const day = ts.substring(6, 8)
    const hour = ts.substring(8, 10)
    const minute = ts.substring(10, 12)
    const second = ts.substring(12, 14)
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
  // Handle numeric timestamp (Unix timestamp in milliseconds)
  if (typeof ts === 'number' || (typeof ts === 'string' && /^\d+$/.test(ts) && ts.length > 14)) {
    const date = new Date(parseInt(ts))
    return date.toLocaleString()
  }
  return ts
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