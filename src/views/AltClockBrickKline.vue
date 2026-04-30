<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-6xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        山寨合约驱动砖石 K 线（独立主时钟）
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        以驱动合约（如 ADAUSDT）为主时钟：当驱动合约涨跌达到阈值时，目标合约与 BTC 同步切一根砖。
        图上支持 ABO（目标 vs BTC 参考）展示。
      </p>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">查询参数</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">驱动合约</label>
            <input v-model="form.clockSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="ADAUSDT" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">目标合约</label>
            <input v-model="form.targetSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="ADAUSDT" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">BTC 参考</label>
            <input v-model="form.btcSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">驱动阈值（%，2=2%）</label>
            <input v-model.number="form.clockMovePercent" type="number" min="0.05" max="50" step="0.05" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">起始时间</label>
            <input v-model="form.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">结束时间</label>
            <input v-model="form.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">limit</label>
            <input v-model.number="form.limit" type="number" min="100" max="50000" step="100" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
        </div>
        <div class="mt-4">
          <button
            @click="doQuery"
            :disabled="loading"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ loading ? '加载中…' : '查询并绘图' }}
          </button>
        </div>
        <div v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
        <div v-if="meta" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          已加载 {{ meta.count || 0 }} 根，驱动={{ meta.clockSymbol }}，目标={{ meta.targetSymbol }}，BTC参考={{ meta.btcSymbol }}
        </div>
      </section>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">ABO 指标</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div class="flex items-center gap-2">
            <input id="show-abo" v-model="indicatorForm.showAbo" type="checkbox" class="rounded border-gray-300" />
            <label for="show-abo" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">展示模式</label>
            <select v-model="indicatorForm.aboDisplayMode" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
              <option value="fast">快线柱状</option>
              <option value="slow">慢线柱状</option>
              <option value="both">快慢双线</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 快线周期</label>
            <input v-model.number="indicatorForm.aboFastPeriod" type="number" min="1" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 慢线周期</label>
            <input v-model.number="indicatorForm.aboSlowPeriod" type="number" min="1" max="300" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
        </div>
      </section>

      <section class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">K 线图</h2>
        <div v-if="bars.length">
          <JbarKlineChart
            :bars="bars"
            :height="680"
            :show-rsi="true"
            :rsi-period="14"
            :show-macd="true"
            :show-bollinger="false"
            :show-super-trend="false"
            :show-atr="false"
            :show-ma="false"
            :show-abo="indicatorForm.showAbo"
            :abo-display-mode="indicatorForm.aboDisplayMode"
            :abo-fast-period="indicatorForm.aboFastPeriod"
            :abo-slow-period="indicatorForm.aboSlowPeriod"
            :abo-threshold="0.5"
            :abo-benchmark-bars="aboBenchmarkBars"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-8">暂无数据，请先查询。</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import { fetchAltClockBrickKlineBars } from '@/api'

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toTimestampMs(v) {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

const now = Date.now()
const defaultEnd = new Date(now - 60 * 1000)
const defaultStart = new Date(now - 7 * 24 * 60 * 60 * 1000)

const form = ref({
  clockSymbol: 'ADAUSDT',
  targetSymbol: 'ADAUSDT',
  btcSymbol: 'BTCUSDT',
  clockMovePercent: 2.0,
  startAt: toLocalInputValue(defaultStart),
  endAt: toLocalInputValue(defaultEnd),
  limit: 5000,
})

const indicatorForm = ref({
  showAbo: true,
  aboDisplayMode: 'both',
  aboFastPeriod: 7,
  aboSlowPeriod: 21,
})

const loading = ref(false)
const error = ref('')
const meta = ref(null)
const bars = ref([])
const aboBenchmarkBars = ref([])

async function doQuery() {
  error.value = ''
  meta.value = null
  bars.value = []
  aboBenchmarkBars.value = []
  const startMs = toTimestampMs(form.value.startAt)
  const endMs = toTimestampMs(form.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }
  loading.value = true
  try {
    const data = await fetchAltClockBrickKlineBars({
      clockSymbol: (form.value.clockSymbol || '').trim().toUpperCase(),
      targetSymbol: (form.value.targetSymbol || '').trim().toUpperCase(),
      btcSymbol: (form.value.btcSymbol || 'BTCUSDT').trim().toUpperCase(),
      startMs,
      endMs,
      clockMovePercent: form.value.clockMovePercent,
      limit: form.value.limit,
    })
    meta.value = data || null
    bars.value = Array.isArray(data?.bars) ? data.bars : []
    aboBenchmarkBars.value = Array.isArray(data?.benchmarkBars) ? data.benchmarkBars : []
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>

