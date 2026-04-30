<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6">
      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-4">价差套利验证参数</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Z-Score 入场阈值以上做空 A 做多 B，以下做多 A 做空 B；验证段内 Z 回归到出口阈值止盈，突破止损阈值止损。数据来自 jbar，需指定时间区间。
          <span class="block mt-1">勾选<strong>成交量节拍</strong>（仅 Binance）时，锚点按 BTC 成交量节拍 K 线时间轴（<code class="text-xs">volume_sync/*_BTCVOLSYNC.jbar</code>），与上方「周期」下拉无关。</span>
          <span class="block mt-1 text-xs leading-relaxed">服务端增强（<code class="text-[10px]">pairs.research.*</code>）：流动性加权 Z、皮尔逊相关过滤、动态入场阈值、快节拍时间衰减平仓、缺失腿占比过滤；详见 <code class="text-[10px]">application.yml</code>。</span>
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end mb-4">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">交易所</label>
            <select v-model="query.exchange" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full min-w-0">
              <option value="binance">Binance</option>
              <option value="okx">OKX</option>
            </select>
          </div>
          <div class="flex flex-col justify-end">
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">成交量节拍 K 线</label>
            <label class="inline-flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input id="pairs-use-vol-sync" v-model="query.useVolumeSyncKline" type="checkbox" class="rounded border-gray-300" :disabled="query.exchange !== 'binance'" />
              <span class="text-sm">BTC 节拍对齐（Binance）</span>
            </label>
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">周期</label>
            <select v-model="query.timeframe" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full min-w-0">
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
              <option value="1H">1H</option>
              <option value="2H">2H</option>
              <option value="4H">4H</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">开始时间</label>
            <input v-model="query.startAt" type="datetime-local" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full mt-1" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">结束时间</label>
            <input v-model="query.endAt" type="datetime-local" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full mt-1" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">回看K线数</label>
            <input v-model.number="query.lookbackBars" type="number" min="60" max="500" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28 mt-1" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">验证K线数</label>
            <input v-model.number="query.validationEvalBars" type="number" min="6" max="72" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" title="等待均值回归的K线数，如 24=1天1H" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">Z 入场阈值</label>
            <input v-model.number="query.zEntryThreshold" type="number" min="1.5" max="4" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" placeholder="2.0" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">Z 止盈阈值</label>
            <input v-model.number="query.zExitThreshold" type="number" min="0" max="1" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" placeholder="0.5" title="|Z|≤ 此值平仓" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">Z 止损阈值</label>
            <input v-model.number="query.zStopLoss" type="number" min="2.5" max="5" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" placeholder="3.5" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">锚点 limit（0=全量）</label>
            <input v-model.number="query.limit" type="number" min="0" max="100000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28 mt-1" title="0 或未填：start～end 内每个周期一个锚点，全部计算；>0：只取区间末尾最近 N 个" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs"><strong>默认 0 = 全量区间</strong>。填正数则只算末尾 N 个锚点。服务端可选 pairs.research.max-anchors-per-request 做硬顶。</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-3 pt-2">
          <button
            @click="loadHistory"
            :disabled="loading"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ loading ? '加载中…' : '重算验证历史' }}
          </button>
        </div>
      </section>

      <div v-if="error" class="mb-4 text-red-600 dark:text-red-400">{{ error }}</div>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">验证曲线</h2>
        <apexcharts v-if="chartSeries.length" type="line" height="380" :options="chartOptions" :series="chartSeries" />
        <div v-else class="text-sm text-gray-500 py-6">请选择开始/结束时间并点击「重算验证历史」</div>
      </section>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">汇总</h2>
        <div class="mb-3 text-sm flex flex-wrap gap-4">
          <div>
            <span class="text-gray-500">样本合计:</span>
            <span class="font-semibold ml-1">{{ tableTotals.sampleCount }}</span>
          </div>
          <div>
            <span class="text-gray-500">盈利总点数:</span>
            <span class="font-semibold text-green-600 ml-1">{{ num(tableTotals.totalProfitPoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">亏损总点数:</span>
            <span class="font-semibold text-red-600 ml-1">{{ num(tableTotals.totalLossPoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">均值回归止盈次数:</span>
            <span class="font-semibold text-cyan-600 ml-1">{{ tableTotals.meanReversionExitCount }}</span>
          </div>
          <div>
            <span class="text-gray-500">协整破裂止损次数:</span>
            <span class="font-semibold text-amber-600 ml-1">{{ tableTotals.stopLossExitCount }}</span>
          </div>
          <div>
            <span class="text-gray-500">净点差（盈利－亏损）:</span>
            <span class="font-semibold ml-1" :class="tableTotals.netPoints >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ num(tableTotals.netPoints) }}%
            </span>
          </div>
          <div>
            <span class="text-gray-500">时间衰减平仓(合计):</span>
            <span class="font-semibold text-violet-600 ml-1">{{ tableTotals.timeDecayExitCount }}</span>
          </div>
        </div>
      </section>

      <section class="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">验证历史表</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4">计算时间</th>
                <th class="py-2 pr-4">周期</th>
                <th class="py-2 pr-4">配对数</th>
                <th class="py-2 pr-4">信号数</th>
                <th class="py-2 pr-4">盈利点数</th>
                <th class="py-2 pr-4">亏损点数</th>
                <th class="py-2 pr-4">命中率%</th>
                <th class="py-2 pr-4">均值回归止盈</th>
                <th class="py-2 pr-4">止损</th>
                <th class="py-2 pr-4">有效样本%</th>
                <th class="py-2 pr-4">r过滤</th>
                <th class="py-2 pr-4">缺失过滤</th>
                <th class="py-2 pr-4">时间衰减</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in tableRowsDesc" :key="r.ts" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-4">{{ formatTs(r.ts) }}</td>
                <td class="py-2 pr-4">{{ r.timeframe }}</td>
                <td class="py-2 pr-4">{{ r.scannedPairCount ?? '—' }}</td>
                <td class="py-2 pr-4">{{ r.sampleCount }}</td>
                <td class="py-2 pr-4 text-green-600">{{ num(r.totalProfitPoints) }}</td>
                <td class="py-2 pr-4 text-red-600">{{ num(r.totalLossPoints) }}</td>
                <td class="py-2 pr-4">{{ num(r.hitRatePct) }}%</td>
                <td class="py-2 pr-4 text-cyan-600">{{ r.meanReversionExitCount ?? '—' }}</td>
                <td class="py-2 pr-4 text-amber-600">{{ r.stopLossExitCount ?? '—' }}</td>
                <td class="py-2 pr-4">{{ num(r.effectiveSamplePct) }}%</td>
                <td class="py-2 pr-4">{{ r.correlationFilteredCount ?? '—' }}</td>
                <td class="py-2 pr-4">{{ r.missingVolumeFilteredCount ?? '—' }}</td>
                <td class="py-2 pr-4 text-violet-600">{{ r.timeDecayExitCount ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { getPairsValidationHistory } from '@/api'

const loading = ref(false)
const error = ref('')
const rows = ref([])

const query = ref({
  exchange: 'binance',
  timeframe: '1H',
  startAt: '',
  endAt: '',
  lookbackBars: 120,
  validationEvalBars: 24,
  zEntryThreshold: 2.0,
  zExitThreshold: 0.5,
  zStopLoss: 3.5,
  limit: 0,
  useVolumeSyncKline: false,
})

watch(
  () => query.value.exchange,
  (ex) => {
    if (ex !== 'binance') query.value.useVolumeSyncKline = false
  }
)

function toTimestampMs(v) {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function formatTs(ts) {
  if (ts == null) return '—'
  const d = new Date(Number(ts))
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function num(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toFixed(2)
}

const loadHistory = async () => {
  const startTime = toTimestampMs(query.value.startAt)
  const endTime = toTimestampMs(query.value.endAt)
  if (!startTime || !endTime || endTime <= startTime) {
    error.value = '请选择开始时间与结束时间，且结束时间大于开始时间'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const lim = Number(query.value.limit)
    const params = {
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      startTime,
      endTime,
      limit: Number.isFinite(lim) ? Math.floor(lim) : 0,
      lookbackBars: Math.max(60, Math.min(500, Number(query.value.lookbackBars) || 120)),
      validationEvalBars: Math.max(6, Math.min(72, Number(query.value.validationEvalBars) || 24)),
      zEntryThreshold: Number(query.value.zEntryThreshold) || 2.0,
      zExitThreshold: Number(query.value.zExitThreshold) || 0.5,
      zStopLoss: Number(query.value.zStopLoss) || 3.5,
    }
    if (query.value.exchange === 'binance' && query.value.useVolumeSyncKline) {
      params.useVolumeSyncKline = true
    }
    const res = await getPairsValidationHistory(params)
    const data = res?.data?.data ?? res?.data ?? res
    rows.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e)
    rows.value = []
  } finally {
    loading.value = false
  }
}

const tableRowsDesc = computed(() => [...rows.value].sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0)))

const tableTotals = computed(() => {
  const list = rows.value
  let sampleCount = 0
  let totalProfitPoints = 0
  let totalLossPoints = 0
  let meanReversionExitCount = 0
  let stopLossExitCount = 0
  let timeDecayExitCount = 0
  for (const r of list) {
    sampleCount += Number(r?.sampleCount ?? 0)
    totalProfitPoints += Number(r?.totalProfitPoints ?? 0)
    totalLossPoints += Number(r?.totalLossPoints ?? 0)
    meanReversionExitCount += Number(r?.meanReversionExitCount ?? 0)
    stopLossExitCount += Number(r?.stopLossExitCount ?? 0)
    timeDecayExitCount += Number(r?.timeDecayExitCount ?? 0)
  }
  return {
    sampleCount,
    totalProfitPoints,
    totalLossPoints,
    meanReversionExitCount,
    stopLossExitCount,
    timeDecayExitCount,
    netPoints: totalProfitPoints - totalLossPoints,
  }
})

const chartSeries = computed(() => [
  { name: '命中率%', data: rows.value.map(r => [r.ts, Number(r.hitRatePct)]) },
  { name: '盈利点数', data: rows.value.map(r => [r.ts, Number(r.totalProfitPoints)]) },
  { name: '亏损点数', data: rows.value.map(r => [r.ts, Number(r.totalLossPoints)]) },
  { name: '均值回归止盈', data: rows.value.map(r => [r.ts, Number(r.meanReversionExitCount)]) },
  { name: '止损', data: rows.value.map(r => [r.ts, Number(r.stopLossExitCount)]) },
])

const chartOptions = {
  chart: { toolbar: { show: true }, animations: { enabled: false } },
  xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
  yaxis: [
    { min: 0, max: 100, labels: { formatter: v => `${Number(v).toFixed(1)}%` }, title: { text: '比例/次数' } },
    { opposite: true, labels: { formatter: v => Number(v).toFixed(2) }, title: { text: '点数' } },
  ],
  stroke: { width: [2, 2, 2, 2, 2], curve: 'straight' },
  tooltip: {
    shared: true,
    x: { format: 'yyyy-MM-dd HH:mm' },
    y: { formatter: (v, { seriesIndex }) => (seriesIndex === 0 ? `${Number(v).toFixed(2)}%` : Number(v).toFixed(2)) },
  },
}
</script>
