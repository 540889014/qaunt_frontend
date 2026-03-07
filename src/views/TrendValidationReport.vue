<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6">
      <div class="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.exchange') }}</label>
          <select v-model="query.exchange" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
            <option value="okx">OKX</option>
            <option value="binance">Binance</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.timeframe') }}</label>
          <select v-model="query.timeframe" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1H">1H</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">Limit(0=全部)</label>
          <input v-model.number="query.limit" type="number" min="0" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">单边手续费(%)</label>
          <input v-model.number="query.feeRatePct" type="number" min="0" max="1" step="0.001" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">重算止盈点(%)</label>
          <input v-model.number="query.recalcTpPct" type="number" min="0.1" max="20" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">开始时间</label>
          <input v-model="query.startAt" type="datetime-local" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">结束时间</label>
          <input v-model="query.endAt" type="datetime-local" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">回看K线数</label>
          <input v-model.number="query.lookbackBars" type="number" min="120" max="20000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">验证样本上限</label>
          <input v-model.number="query.recalcSampleLimit" type="number" min="1" max="5000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <button @click="loadHistory" :disabled="loading" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {{ loading ? $t('trend_research.loading') : $t('trend_research.refresh_history') }}
        </button>
        <button @click="recalculateHistory" :disabled="loading" class="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50">
          {{ loading ? $t('trend_research.loading') : '重算历史(快照)' }}
        </button>
        <button @click="recalculateHistoryByRange" :disabled="loading" class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {{ loading ? $t('trend_research.loading') : '按区间逐K重算(二进制)' }}
        </button>
      </div>

      <div v-if="error" class="mb-4 text-red-600 dark:text-red-400">{{ error }}</div>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.validation_history_chart') }}</h2>
        <apexcharts v-if="chartSeries.length" type="line" height="380" :options="chartOptions" :series="chartSeries" />
        <div v-else class="text-sm text-gray-500 py-6">No history data</div>
      </section>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">整体预期盈利（净值曲线）</h2>
        <apexcharts v-if="equitySeries.length" type="line" height="320" :options="equityChartOptions" :series="equitySeries" />
        <div v-else class="text-sm text-gray-500 py-6">No equity data</div>
      </section>

      <section class="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.validation_history_table') }}</h2>
        <div class="mb-3 text-sm flex flex-wrap gap-4">
          <div>
            <span class="text-gray-500">{{ $t('trend_research.validated_count') }}(合计):</span>
            <span class="font-semibold ml-1">{{ tableTotals.sampleCount }}</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('trend_research.total_profit_points') }}(合计):</span>
            <span class="font-semibold text-green-600 ml-1">{{ num(tableTotals.totalProfitPoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('trend_research.total_loss_points') }}(合计):</span>
            <span class="font-semibold text-red-600 ml-1">{{ num(tableTotals.totalLossPoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">挂单总手续费(估算):</span>
            <span class="font-semibold text-amber-600 ml-1">{{ num(tableTotals.totalFeePoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">最终预期盈利（1/50仓位的盈利）:</span>
            <span class="font-semibold ml-1" :class="tableTotals.expectedNetProfit >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ num(tableTotals.expectedNetProfit) }}%
            </span>
          </div>
          <div>
            <span class="text-gray-500">整体预期盈利:</span>
            <span class="font-semibold ml-1" :class="tableTotals.overallExpectedNetProfit >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ num(tableTotals.overallExpectedNetProfit) }}%
            </span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4">计算时间</th>
                <th class="py-2 pr-4">{{ $t('trend_research.timeframe') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.validated_count') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.total_profit_points') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.total_loss_points') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.median_max_profit_pct') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.hit_rate') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.ts" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-4">{{ formatTs(r.ts) }}</td>
                <td class="py-2 pr-4">{{ r.timeframe }}</td>
                <td class="py-2 pr-4">{{ r.sampleCount }}</td>
                <td class="py-2 pr-4 text-green-600">{{ num(r.totalProfitPoints) }}</td>
                <td class="py-2 pr-4 text-red-600">{{ num(r.totalLossPoints) }}</td>
                <td class="py-2 pr-4 text-green-600">{{ num(r.medianMaxProfitPct) }}%</td>
                <td class="py-2 pr-4">{{ num(r.hitRatePct) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { getTrendValidationHistory } from '@/api'

const loading = ref(false)
const error = ref('')
const rows = ref([])
const query = ref({
  exchange: 'okx',
  timeframe: '1H',
  limit: 0,
  feeRatePct: 0.05,
  recalcTpPct: 2.0,
  startAt: '',
  endAt: '',
  lookbackBars: 500,
  symbolLimit: 0,
  topN: 0,
  recalcSampleLimit: 80,
})

const loadHistory = async (withRecalc = false, byRange = false) => {
  loading.value = true
  error.value = ''
  try {
    const params = {
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      limit: query.value.limit,
    }
    if (withRecalc) {
      params.tpPct = query.value.recalcTpPct
    }
    if (byRange) {
      const startTime = toTimestampMs(query.value.startAt)
      const endTime = toTimestampMs(query.value.endAt)
      if (!startTime || !endTime || endTime <= startTime) {
        throw new Error('请选择正确的开始/结束时间，且结束时间要大于开始时间')
      }
      params.startTime = startTime
      params.endTime = endTime
      params.lookbackBars = Math.max(120, Number(query.value.lookbackBars) || 500)
      params.symbolLimit = Number(query.value.symbolLimit) || 0
      params.topN = Math.max(1, Number(query.value.recalcSampleLimit) || 80)
      params.tpPct = query.value.recalcTpPct
    }
    const data = await getTrendValidationHistory(params)
    rows.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const recalculateHistory = async () => {
  await loadHistory(true)
}

const recalculateHistoryByRange = async () => {
  await loadHistory(true, true)
}

const chartSeries = computed(() => ([
  { name: '整体命中率', data: rows.value.map(r => [r.ts, Number(r.hitRatePct)]) },
  { name: '盈利占比', data: rows.value.map(r => [r.ts, Number(r.profitRatePct)]) },
  { name: '亏损占比', data: rows.value.map(r => [r.ts, Number(r.lossRatePct)]) },
  { name: '盈利总点数', data: rows.value.map(r => [r.ts, Number(r.totalProfitPoints)]) },
  { name: '亏损总点数', data: rows.value.map(r => [r.ts, Number(r.totalLossPoints)]) },
]))

const chartOptions = {
  chart: { toolbar: { show: true }, animations: { enabled: false } },
  xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
  yaxis: [
    {
      min: 0,
      max: 100,
      labels: { formatter: (v) => `${Number(v).toFixed(1)}%` },
      title: { text: '比例(%)' },
    },
    {
      opposite: true,
      labels: { formatter: (v) => Number(v).toFixed(2) },
      title: { text: '点数' },
    },
  ],
  stroke: { width: [2, 2, 2, 2, 2], curve: 'straight' },
  tooltip: {
    shared: true,
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
    y: {
      formatter: (v, { seriesIndex }) => {
        if (seriesIndex <= 2) return `${Number(v).toFixed(2)}%`
        return Number(v).toFixed(2)
      },
    },
  },
}

const equitySeries = computed(() => {
  const sorted = [...rows.value].sort((a, b) => Number(a.ts) - Number(b.ts))
  const feeRatePct = Math.max(0, Number(query.value.feeRatePct) || 0)
  let cumulative = 0
  const data = sorted.map((r) => {
    const sampleCount = Number(r.sampleCount) || 0
    const profit = Number(r.totalProfitPoints) || 0
    const loss = Number(r.totalLossPoints) || 0
    const fee = sampleCount * feeRatePct * 2
    // Same definition as "整体预期盈利": one snapshot net divided by 50.
    const stepNetOverall = (profit - loss - fee) / 50
    cumulative += stepNetOverall
    return [Number(r.ts), cumulative]
  })
  return [{ name: '整体预期盈利(累计)', data }]
})

const equityChartOptions = {
  chart: { toolbar: { show: true }, animations: { enabled: false } },
  xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
  yaxis: {
    labels: { formatter: (v) => `${Number(v).toFixed(2)}%` },
    title: { text: '累计收益(%)' },
  },
  stroke: { width: 2, curve: 'straight' },
  colors: ['#059669'],
  tooltip: {
    shared: false,
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
    y: { formatter: (v) => `${Number(v).toFixed(2)}%` },
  },
}

const tableTotals = computed(() => {
  const sampleCount = rows.value.reduce((acc, r) => acc + (Number(r.sampleCount) || 0), 0)
  const totalProfitPoints = rows.value.reduce((acc, r) => acc + (Number(r.totalProfitPoints) || 0), 0)
  const totalLossPoints = rows.value.reduce((acc, r) => acc + (Number(r.totalLossPoints) || 0), 0)
  const feeRatePct = Math.max(0, Number(query.value.feeRatePct) || 0)
  // One contract per sample, round trip (open + close): two-sided fee.
  const totalFeePoints = sampleCount * feeRatePct * 2
  const expectedNetProfit = totalProfitPoints - totalLossPoints - totalFeePoints
  const overallExpectedNetProfit = expectedNetProfit / 50
  return { sampleCount, totalProfitPoints, totalLossPoints, totalFeePoints, expectedNetProfit, overallExpectedNetProfit }
})

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}
const formatTs = (ts) => {
  const n = Number(ts)
  if (!Number.isFinite(n)) return 'N/A'
  const d = new Date(n)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const toTimestampMs = (datetimeLocal) => {
  if (!datetimeLocal) return 0
  const ms = new Date(datetimeLocal).getTime()
  return Number.isFinite(ms) ? ms : 0
}

onMounted(loadHistory)
</script>
