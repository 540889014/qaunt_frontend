<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {{ $t('spread_synthetic_kline.title') }}
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {{ $t('spread_synthetic_kline.intro') }}
      </p>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">{{ $t('spread_synthetic_kline.section_params') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">{{ $t('spread_synthetic_kline.source_type') }}</label>
            <select v-model="form.sourceType" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
              <option value="brick">{{ $t('spread_synthetic_kline.source_brick') }}</option>
              <option value="volume">{{ $t('spread_synthetic_kline.source_volume') }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">{{ $t('spread_synthetic_kline.leg_a') }}</label>
            <input v-model="form.symbolA" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">{{ $t('spread_synthetic_kline.leg_b') }}</label>
            <input v-model="form.symbolB" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="ETHUSDT" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">limit</label>
            <input v-model.number="form.limit" type="number" min="100" max="50000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">{{ $t('spread_synthetic_kline.start') }}</label>
            <input v-model="form.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">{{ $t('spread_synthetic_kline.end') }}</label>
            <input v-model="form.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div class="sm:col-span-2 flex gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              :disabled="loading"
              @click="loadSpread"
            >
              {{ loading ? $t('spread_synthetic_kline.loading') : $t('spread_synthetic_kline.load') }}
            </button>
          </div>
        </div>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">{{ $t('spread_synthetic_kline.hint_build') }}</p>
        <div v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
        <div v-if="meta" class="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
          {{ meta }}
        </div>
      </section>

      <!-- 指标面板：与砖石图 / 成交量节拍页一致 -->
      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">{{ $t('spread_synthetic_kline.section_indicators') }}</h2>

        <div class="mb-4">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <label class="inline-flex items-center gap-2">
              <input id="ma-spread" v-model="indicatorForm.showMa" type="checkbox" class="rounded border-gray-300" />
              <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ $t('spread_synthetic_kline.show_ma') }}</span>
            </label>
            <button
              type="button"
              class="text-sm px-2 py-1 rounded border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-40"
              :disabled="!indicatorForm.showMa"
              @click="addMaRow"
            >
              + {{ $t('spread_synthetic_kline.add_ma') }}
            </button>
          </div>
          <div
            v-if="indicatorForm.showMa"
            class="rounded-md border border-gray-200 dark:border-gray-600 divide-y divide-gray-200 dark:divide-gray-600 overflow-hidden"
          >
            <div
              v-for="(row, idx) in indicatorForm.maRows"
              :key="row.id"
              class="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 bg-gray-50/80 dark:bg-gray-900/40"
            >
              <label class="inline-flex items-center gap-1.5 shrink-0">
                <input v-model="row.enabled" type="checkbox" class="rounded border-gray-300" />
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('spread_synthetic_kline.ma_show') }}</span>
              </label>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ $t('spread_synthetic_kline.ma_period') }}</span>
                <input
                  v-model.number="row.period"
                  type="number"
                  min="2"
                  max="500"
                  class="w-20 px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-sm"
                  :disabled="!row.enabled"
                />
              </div>
              <select v-model="row.type" class="px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-sm" :disabled="!row.enabled">
                <option value="sma">SMA</option>
                <option value="ema">EMA</option>
                <option value="aema">AEMA</option>
              </select>
              <button
                type="button"
                class="text-xs text-red-600 hover:underline ml-auto"
                :disabled="indicatorForm.maRows.length <= 1"
                @click="removeMaRow(idx)"
              >
                {{ $t('spread_synthetic_kline.remove') }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">AEMA</label>
            <input v-model.number="indicatorForm.maAccelerationFactor" type="number" min="0" max="2" step="0.1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">{{ $t('spread_synthetic_kline.chart_height') }}</label>
            <input v-model.number="indicatorForm.chartHeight" type="number" min="500" max="900" step="10" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="rsi-spread" v-model="indicatorForm.showRsi" type="checkbox" class="rounded border-gray-300" />
            <label for="rsi-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">RSI</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">RSI</label>
            <input v-model.number="indicatorForm.rsiPeriod" type="number" min="2" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showRsi" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">RSI {{ $t('spread_synthetic_kline.damp') }}</label>
            <input v-model.number="indicatorForm.rsiDampeningFactor" type="number" min="0" max="2" step="0.05" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showRsi" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">RSI {{ $t('spread_synthetic_kline.rev') }}</label>
            <input v-model.number="indicatorForm.rsiReversalFactor" type="number" min="0" max="5" step="0.1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showRsi" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="bb-spread" v-model="indicatorForm.showBollinger" type="checkbox" class="rounded border-gray-300" />
            <label for="bb-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">BB</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">BB</label>
            <input v-model.number="indicatorForm.bollingerPeriod" type="number" min="2" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showBollinger" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">BB mult</label>
            <input v-model.number="indicatorForm.bollingerMult" type="number" min="0.5" max="6" step="0.1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showBollinger" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="st-spread" v-model="indicatorForm.showSuperTrend" type="checkbox" class="rounded border-gray-300" />
            <label for="st-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">SuperTrend</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ST ATR</label>
            <input v-model.number="indicatorForm.superTrendAtrPeriod" type="number" min="2" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showSuperTrend" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ST ×</label>
            <input v-model.number="indicatorForm.superTrendMultiplier" type="number" min="0.5" max="20" step="0.5" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showSuperTrend" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="zscore-spread" v-model="indicatorForm.showZscore" type="checkbox" class="rounded border-gray-300" />
            <label for="zscore-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">Z-Score</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Z N</label>
            <input v-model.number="indicatorForm.zscorePeriod" type="number" min="2" max="1000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showZscore" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="macd-spread" v-model="indicatorForm.showMacd" type="checkbox" class="rounded border-gray-300" />
            <label for="macd-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">MACD</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">MACD f</label>
            <input v-model.number="indicatorForm.macdFastPeriod" type="number" min="2" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showMacd" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">MACD s</label>
            <input v-model.number="indicatorForm.macdSlowPeriod" type="number" min="3" max="300" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showMacd" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">MACD sig</label>
            <input v-model.number="indicatorForm.macdSignalPeriod" type="number" min="2" max="100" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showMacd" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">AMACD boost</label>
            <input v-model.number="indicatorForm.macdBoostFactor" type="number" min="0" max="0.3" step="0.01" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showMacd" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">AMACD rev</label>
            <input v-model.number="indicatorForm.macdReversalFactor" type="number" min="0" max="3" step="0.05" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showMacd" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="atr-spread" v-model="indicatorForm.showAtr" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">ATR</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ATR N</label>
            <input v-model.number="indicatorForm.atrPeriod" type="number" min="2" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAtr" />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="atr-norm-spread" v-model="indicatorForm.atrNormalize" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-norm-spread" class="text-sm font-medium text-gray-800 dark:text-gray-200">ATR 0–1</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ATR win</label>
            <input v-model.number="indicatorForm.atrNormPeriod" type="number" min="2" max="2000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAtr || !indicatorForm.atrNormalize" />
          </div>
        </div>

        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {{ $t('spread_synthetic_kline.indicator_note') }}
        </p>
      </section>

      <section class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">{{ $t('spread_synthetic_kline.section_chart') }}</h2>
        <div v-if="bars.length">
          <JbarKlineChart
            :bars="bars"
            main-series-type="line"
            :height="Math.max(500, Math.min(900, Number(indicatorForm.chartHeight) || 620))"
            :price-decimals="5"
            :ma-lines="maLinesForChart"
            :ma-acceleration-factor="indicatorForm.maAccelerationFactor"
            :show-bollinger="indicatorForm.showBollinger"
            :bollinger-period="indicatorForm.bollingerPeriod"
            :bollinger-mult="indicatorForm.bollingerMult"
            :show-rsi="indicatorForm.showRsi"
            :rsi-period="indicatorForm.rsiPeriod"
            rsi-smoothing="spring-reversal"
            :rsi-dampening-factor="indicatorForm.rsiDampeningFactor"
            :rsi-reversal-factor="indicatorForm.rsiReversalFactor"
            :show-macd="indicatorForm.showMacd"
            :macd-fast-period="indicatorForm.macdFastPeriod"
            :macd-slow-period="indicatorForm.macdSlowPeriod"
            :macd-signal-period="indicatorForm.macdSignalPeriod"
            :macd-boost-factor="indicatorForm.macdBoostFactor"
            :macd-reversal-factor="indicatorForm.macdReversalFactor"
            :show-atr="indicatorForm.showAtr"
            :atr-period="indicatorForm.atrPeriod"
            :atr-normalize="indicatorForm.atrNormalize"
            :atr-norm-period="indicatorForm.atrNormPeriod"
            :show-super-trend="indicatorForm.showSuperTrend"
            :super-trend-atr-period="indicatorForm.superTrendAtrPeriod"
            :super-trend-multiplier="indicatorForm.superTrendMultiplier"
            :show-zscore="indicatorForm.showZscore"
            :zscore-period="indicatorForm.zscorePeriod"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-8">{{ $t('spread_synthetic_kline.empty') }}</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import { fetchBtcPointBrickKlineBars, fetchBtcVolumeSyncKlineBars } from '@/api'

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const meta = ref('')
const bars = ref([])

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const now = Date.now()
const defaultEnd = new Date(now - 60 * 1000)
const defaultStart = new Date(now - 14 * 24 * 60 * 60 * 1000)

const form = ref({
  sourceType: 'brick',
  symbolA: 'BTCUSDT',
  symbolB: 'ETHUSDT',
  limit: 8000,
  startAt: toLocalInputValue(defaultStart),
  endAt: toLocalInputValue(defaultEnd),
})

function normalizeBinanceSymbol(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const s = raw.trim().toUpperCase()
  if (s.endsWith('-USDT-SWAP')) return s.slice(0, -'-USDT-SWAP'.length) + 'USDT'
  return s.replace(/-/g, '').replace(/_/g, '')
}

function toTimestampMs(v) {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * 收盘价对数价差：spread = ln(closeA) - ln(closeB) = ln(closeA / closeB)。
 * 主图用折线，仅依赖 close；为复用指标组件，OHLC 都填同一个 spread 值。
 */
function mergeSpreadBars(barsA, barsB) {
  const listA = Array.isArray(barsA) ? barsA : []
  const listB = Array.isArray(barsB) ? barsB : []
  const mapB = new Map()
  for (const b of listB) {
    const t = Number(b.t)
    if (Number.isFinite(t)) mapB.set(t, b)
  }
  const out = []
  for (const a of listA) {
    const t = Number(a.t)
    const bb = mapB.get(t)
    if (!bb) continue
    const ac = Number(a.c)
    const bc = Number(bb.c)
    if (![ac, bc].every((x) => Number.isFinite(x) && x > 0)) continue
    const c = Math.log(ac) - Math.log(bc)
    const o = c
    const high = c
    const low = c
    const v = (Number(a.v) || 0) + (Number(bb.v) || 0)
    out.push({ t, o, h: high, l: low, c, v })
  }
  out.sort((x, y) => x.t - y.t)
  return out
}

let nextMaRowId = 4
const indicatorForm = ref({
  showMa: true,
  maRows: [
    { id: 1, period: 5, type: 'sma', enabled: true },
    { id: 2, period: 20, type: 'sma', enabled: true },
    { id: 3, period: 60, type: 'sma', enabled: true },
  ],
  showBollinger: true,
  bollingerPeriod: 20,
  bollingerMult: 2,
  maAccelerationFactor: 0.5,
  chartHeight: 620,
  showRsi: true,
  rsiPeriod: 14,
  rsiDampeningFactor: 0.5,
  rsiReversalFactor: 0.45,
  showMacd: true,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  macdBoostFactor: 0.05,
  macdReversalFactor: 0.45,
  showAtr: true,
  atrPeriod: 20,
  atrNormalize: true,
  atrNormPeriod: 100,
  showSuperTrend: true,
  superTrendAtrPeriod: 10,
  superTrendMultiplier: 3,
  showZscore: true,
  zscorePeriod: 60,
})

const maLinesForChart = computed(() => {
  if (!indicatorForm.value.showMa) return []
  return indicatorForm.value.maRows
    .filter((r) => r.enabled)
    .map((r) => ({
      period: Math.max(2, Math.min(500, Math.floor(Number(r.period)) || 2)),
      type: r.type === 'ema' ? 'ema' : r.type === 'aema' ? 'aema' : 'sma',
      enabled: true,
    }))
})

function addMaRow() {
  indicatorForm.value.maRows.push({
    id: nextMaRowId++,
    period: 30,
    type: 'sma',
    enabled: true,
  })
}

function removeMaRow(index) {
  if (indicatorForm.value.maRows.length <= 1) return
  indicatorForm.value.maRows.splice(index, 1)
}

async function loadSpread() {
  error.value = ''
  meta.value = ''
  bars.value = []
  const startMs = toTimestampMs(form.value.startAt)
  const endMs = toTimestampMs(form.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = t('spread_synthetic_kline.err_time')
    return
  }
  const symA = normalizeBinanceSymbol(form.value.symbolA)
  const symB = normalizeBinanceSymbol(form.value.symbolB)
  if (!symA || !symB) {
    error.value = t('spread_synthetic_kline.err_symbol')
    return
  }
  if (symA === symB) {
    error.value = t('spread_synthetic_kline.err_same')
    return
  }
  const limit = Math.max(100, Math.min(50000, Math.floor(Number(form.value.limit)) || 8000))
  const fetcher = form.value.sourceType === 'volume' ? fetchBtcVolumeSyncKlineBars : fetchBtcPointBrickKlineBars
  loading.value = true
  try {
    const params = { symbol: symA, startMs, endMs, limit }
    const paramsB = { symbol: symB, startMs, endMs, limit }
    const [dataA, dataB] = await Promise.all([fetcher(params), fetcher(paramsB)])
    const rawA = Array.isArray(dataA?.bars) ? dataA.bars : []
    const rawB = Array.isArray(dataB?.bars) ? dataB.bars : []
    const merged = mergeSpreadBars(rawA, rawB)
    bars.value = merged
    meta.value = t('spread_synthetic_kline.meta_fmt', {
      symA,
      symB,
      nA: rawA.length,
      nB: rawB.length,
      n: merged.length,
      mode: form.value.sourceType === 'volume' ? 'BTCVOLSYNC' : 'BTCPOINTBRICK',
    })
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
    bars.value = []
  } finally {
    loading.value = false
  }
}
</script>
