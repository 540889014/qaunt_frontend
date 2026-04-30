<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 min-h-screen dark:bg-gray-900">
    <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">币安历史 K 线 → .jbar</h1>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
      从 data.binance.vision 拉取 U 本位<strong>月度</strong> ZIP，内存解压 CSV，写入
      <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">data/history/binance/{SYMBOL}_{周期}.jbar</code>
      （48 字节/根，volume 为 USDT 成交额，与现有 jbar 一致）。当月不完整数据需另行用日线或实时接口补齐。<br />
      <strong>写入方式：</strong>默认<strong>覆盖</strong>——文件内容仅为本次所选月份区间；勾选「合并已有」则读入旧 .jbar 与新区间合并，按时间<strong>升序去重</strong>后整文件重写（安全追加，禁止尾部裸追加以免乱序）。<br />
      <strong>UM 5m metrics：</strong>与上方 K 线不同，Vision 上<strong>仅有</strong>
      <a
        href="https://data.binance.vision/?prefix=data/futures/um/daily/metrics/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-indigo-600 dark:text-indigo-400 hover:underline"
        >daily/metrics</a>
      （按<strong>自然日</strong>一个 ZIP），<strong>没有</strong>类似 K 线的 monthly 整包；下方按起止日<strong>逐日</strong>拉取后合并写入
      <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{SYMBOL}_5m_metrics.jbar</code>
      （V3；槽位为 metrics 字段映射，非价格 K 线）。
    </p>

    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
      <div class="flex flex-wrap gap-6 items-end">
        <div>
          <label class="block text-sm font-medium mb-1">起始月</label>
          <input
            v-model="startMonth"
            type="month"
            class="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">结束月</label>
          <input
            v-model="endMonth"
            type="month"
            class="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div class="min-w-[240px] flex-1">
          <label class="block text-sm font-medium mb-1">K 线周期（多选）</label>
          <n-select
            v-model:value="intervals"
            multiple
            :options="intervalOptions"
            placeholder="如 15m、1h"
            class="w-full"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <n-checkbox v-model:checked="mergeExisting">合并已有 .jbar（与本次月份合并后升序去重重写）</n-checkbox>
        <n-checkbox v-model:checked="allPerpetual">全部 U 本位 USDT 永续（TRADING）</n-checkbox>
        <span v-if="symbolCount != null" class="text-sm text-gray-500">当前约 {{ symbolCount }} 个合约</span>
        <n-button size="small" quaternary @click="loadSymbolCount">刷新合约数</n-button>
      </div>

      <div v-if="!allPerpetual" class="space-y-2">
        <label class="block text-sm font-medium">指定合约（逗号或换行分隔，如 BTCUSDT）</label>
        <n-input
          v-model:value="symbolsText"
          type="textarea"
          placeholder="BTCUSDT&#10;ETHUSDT"
          :rows="4"
        />
      </div>

      <n-button
        type="primary"
        size="large"
        :loading="starting"
        :disabled="!canStart"
        @click="startDownload"
      >
        开始下载并写入 .jbar
      </n-button>

      <n-alert v-if="warnText" type="warning" :title="warnText" class="max-w-2xl" />

      <div v-if="jobId" class="space-y-3 border-t pt-4 dark:border-gray-600">
        <div class="flex items-center gap-4">
          <span class="text-sm font-mono">job: {{ jobId }}</span>
          <n-tag :type="phaseTag">{{ status?.phase }}</n-tag>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ status?.completedTasks ?? 0 }} / {{ status?.totalTasks ?? 0 }} 任务 ·
            {{ (status?.barsWritten ?? 0).toLocaleString() }} 根 K 线
          </span>
        </div>
        <n-progress
          type="line"
          :percentage="Math.min(100, Math.round(status?.progressPct ?? 0))"
          :status="status?.phase === 'FAILED' ? 'error' : status?.phase === 'COMPLETED' ? 'success' : 'default'"
        />
        <p v-if="status?.message" class="text-sm text-gray-700 dark:text-gray-300">{{ status.message }}</p>
        <div
          class="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-3 rounded max-h-64 overflow-y-auto whitespace-pre-wrap"
        >
          {{ logText }}
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6 mt-8">
      <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">UM 5m metrics（仅 daily 分包）→ 二进制 .jbar</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        官方只提供<strong>按日</strong>压缩包，路径形如
        <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">data/futures/um/daily/metrics/{SYMBOL}/{SYMBOL}-metrics-{yyyy-MM-dd}.zip</code>
        （无 monthly 汇总）。本页在区间内<strong>每天一个 HTTP 请求</strong>，解压 CSV 后合并写入
        <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">data/history/binance/{SYMBOL}_5m_metrics.jbar</code>。
        每条 5 分钟：open=sum_open_interest，high=sum_open_interest_value，low=count_toptrader_long_short_ratio，close=sum_toptrader_long_short_ratio，volume=count_long_short_ratio，taker_buy_base=sum_taker_long_short_vol_ratio。
      </p>
      <div class="flex flex-wrap gap-6 items-end">
        <div>
          <label class="block text-sm font-medium mb-1">起始日（UTC）</label>
          <input
            v-model="metricsStartDate"
            type="date"
            class="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">结束日（UTC）</label>
          <input
            v-model="metricsEndDate"
            type="date"
            class="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <n-checkbox v-model:checked="metricsMergeExisting">合并已有 _5m_metrics.jbar</n-checkbox>
        <n-checkbox v-model:checked="metricsAllPerpetual">全部 U 本位 USDT 永续</n-checkbox>
      </div>
      <div v-if="!metricsAllPerpetual" class="space-y-2">
        <label class="block text-sm font-medium">指定合约</label>
        <n-input
          v-model:value="metricsSymbolsText"
          type="textarea"
          placeholder="BTCUSDT&#10;ETHUSDT"
          :rows="3"
        />
      </div>
      <n-button
        type="primary"
        size="large"
        :loading="metricsStarting"
        :disabled="!canStartMetrics"
        @click="startVisionMetricsDownload"
      >
        下载 metrics 并写入 _5m_metrics.jbar
      </n-button>
      <n-alert v-if="metricsWarnText" type="warning" :title="metricsWarnText" class="max-w-2xl" />
      <div v-if="metricsJobId" class="space-y-3 border-t pt-4 dark:border-gray-600">
        <div class="flex items-center gap-4">
          <span class="text-sm font-mono">metrics job: {{ metricsJobId }}</span>
          <n-tag :type="metricsPhaseTag">{{ metricsStatus?.phase }}</n-tag>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ metricsStatus?.completedTasks ?? 0 }} / {{ metricsStatus?.totalTasks ?? 0 }} 合约 ·
            {{ (metricsStatus?.barsWritten ?? 0).toLocaleString() }} 行
          </span>
        </div>
        <n-progress
          type="line"
          :percentage="Math.min(100, Math.round(metricsStatus?.progressPct ?? 0))"
          :status="
            metricsStatus?.phase === 'FAILED'
              ? 'error'
              : metricsStatus?.phase === 'COMPLETED'
                ? 'success'
                : 'default'
          "
        />
        <p v-if="metricsStatus?.message" class="text-sm text-gray-700 dark:text-gray-300">{{ metricsStatus.message }}</p>
        <div
          class="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-3 rounded max-h-48 overflow-y-auto whitespace-pre-wrap"
        >
          {{ metricsLogText }}
        </div>
      </div>
    </div>

    <!-- K 线预览：读本地 .jbar -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4 mt-8">
      <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">K 线预览（二进制 .jbar）</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        读取目录与上表一致：<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">data/history/binance/{合约}_{周期}.jbar</code>
      </p>
      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-sm font-medium mb-1">合约</label>
          <n-input v-model:value="klineSymbol" placeholder="BTCUSDT" class="w-40" />
        </div>
        <div class="min-w-[140px]">
          <label class="block text-sm font-medium mb-1">周期</label>
          <n-select v-model:value="klineInterval" :options="intervalOptions" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">开始（本地时间）</label>
          <input
            v-model="klineStartLocal"
            type="datetime-local"
            class="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">结束</label>
          <input
            v-model="klineEndLocal"
            type="datetime-local"
            class="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div class="w-28">
          <label class="block text-sm font-medium mb-1">最多根数</label>
          <n-input-number v-model:value="klineLimit" :min="100" :max="50000" :step="500" class="w-full" />
        </div>
        <n-button type="primary" :loading="klineLoading" @click="loadKlineChart">查询并绘图</n-button>
      </div>
      <n-alert v-if="klineError" type="error" :title="klineError" />
      <p v-else-if="klineMeta" class="text-sm text-gray-600 dark:text-gray-400">
        已加载 {{ klineBars.length }} 根
        <span v-if="klineMeta.jbarPath" class="font-mono text-xs ml-2 break-all">{{ klineMeta.jbarPath }}</span>
      </p>
      <JbarKlineChart v-if="klineBars.length" :bars="klineBars" :height="460" />
      <p v-else-if="klineLoaded && !klineError" class="text-gray-500 text-sm">该区间内无数据，请调整时间或先下载历史。</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import {
  NAlert,
  NButton,
  NCheckbox,
  NInput,
  NInputNumber,
  NProgress,
  NSelect,
  NTag,
  useMessage,
} from 'naive-ui'
import {
  fetchBinanceHistorySymbols,
  startBinanceHistoryDownload,
  startBinanceVisionMetricsDownload,
  getBinanceHistoryJob,
  fetchBinanceHistoryKlineBars,
} from '@/api'

const message = useMessage()
const startMonth = ref(defaultStartMonth())
const endMonth = ref(defaultEndMonth())
const intervals = ref(['15m', '1h'])
const intervalOptions = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '2h', value: '2h' },
  { label: '4h', value: '4h' },
  { label: '6h', value: '6h' },
  { label: '8h', value: '8h' },
  { label: '12h', value: '12h' },
  { label: '1d', value: '1d' },
  { label: '3d', value: '3d' },
  { label: '1w', value: '1w' },
  { label: '1M', value: '1M' },
  { label: '5m metrics（Vision 持仓/多空比）', value: '5m_metrics' },
]
const allPerpetual = ref(true)
const mergeExisting = ref(false)
const symbolsText = ref('')
const symbolCount = ref(null)
const starting = ref(false)
const jobId = ref('')
const status = ref(null)
let pollTimer = null

function defaultStartMonth() {
  const d = new Date()
  d.setMonth(d.getMonth() - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function defaultEndMonth() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const warnText = computed(() => {
  if (!allPerpetual.value || !symbolCount.value || !intervals.value?.length) return ''
  const tasks = symbolCount.value * intervals.value.length
  if (tasks > 200) {
    return `将并发下载约 ${tasks} 个「合约×周期」任务，耗时与流量较大，建议先缩小月份范围或减少周期。`
  }
  return ''
})

const canStart = computed(() => {
  if (!startMonth.value || !endMonth.value || !intervals.value?.length) return false
  if (!allPerpetual.value) {
    const syms = parseSymbols(symbolsText.value)
    if (!syms.length) return false
  }
  return true
})

const phaseTag = computed(() => {
  const p = status.value?.phase
  if (p === 'COMPLETED') return 'success'
  if (p === 'FAILED') return 'error'
  return 'info'
})

const logText = computed(() => (status.value?.recentLogs || []).join('\n'))

function parseSymbols(text) {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

async function loadSymbolCount() {
  try {
    const data = await fetchBinanceHistorySymbols()
    symbolCount.value = Array.isArray(data) ? data.length : 0
  } catch (e) {
    message.error(e?.message || '拉取合约列表失败')
  }
}

loadSymbolCount()

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollJob() {
  if (!jobId.value) return
  try {
    const data = await getBinanceHistoryJob(jobId.value)
    status.value = data
    if (data.phase === 'COMPLETED' || data.phase === 'FAILED') {
      stopPoll()
      if (data.phase === 'COMPLETED') message.success('下载任务已完成')
    }
  } catch (e) {
    console.error(e)
  }
}

async function startDownload() {
  starting.value = true
  stopPoll()
  try {
    const body = {
      startMonth: startMonth.value,
      endMonth: endMonth.value,
      intervals: intervals.value,
      allPerpetual: allPerpetual.value,
      mergeExisting: mergeExisting.value,
    }
    if (!allPerpetual.value) {
      body.symbols = parseSymbols(symbolsText.value)
    }
    const res = await startBinanceHistoryDownload(body)
    jobId.value = res.jobId
    status.value = null
    await pollJob()
    pollTimer = setInterval(pollJob, 2000)
    message.info('任务已启动，请等待进度刷新')
  } catch (e) {
    message.error(e?.response?.data?.message || e?.message || '启动失败')
  } finally {
    starting.value = false
  }
}

onUnmounted(() => {
  stopPoll()
  stopMetricsPoll()
})

function defaultMetricsEndDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function defaultMetricsStartDate() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const metricsStartDate = ref(defaultMetricsStartDate())
const metricsEndDate = ref(defaultMetricsEndDate())
const metricsMergeExisting = ref(false)
const metricsAllPerpetual = ref(false)
const metricsSymbolsText = ref('BTCUSDT')
const metricsStarting = ref(false)
const metricsJobId = ref('')
const metricsStatus = ref(null)
let pollMetricsTimer = null

const metricsWarnText = computed(() => {
  if (!metricsAllPerpetual.value || !symbolCount.value) return ''
  const days = metricsDaySpan.value
  if (days > 120) {
    return `将全部永续 × 约 ${days} 天逐日拉取 metrics，流量与耗时极大，建议缩短日期范围或改为指定合约。`
  }
  return ''
})

const metricsDaySpan = computed(() => {
  const a = Date.parse(metricsStartDate.value + 'T00:00:00Z')
  const b = Date.parse(metricsEndDate.value + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1
})

const canStartMetrics = computed(() => {
  if (!metricsStartDate.value || !metricsEndDate.value) return false
  if (metricsDaySpan.value <= 0) return false
  if (!metricsAllPerpetual.value) {
    const syms = parseSymbols(metricsSymbolsText.value)
    if (!syms.length) return false
  }
  return true
})

const metricsPhaseTag = computed(() => {
  const p = metricsStatus.value?.phase
  if (p === 'COMPLETED') return 'success'
  if (p === 'FAILED') return 'error'
  return 'info'
})

const metricsLogText = computed(() => (metricsStatus.value?.recentLogs || []).join('\n'))

function stopMetricsPoll() {
  if (pollMetricsTimer) {
    clearInterval(pollMetricsTimer)
    pollMetricsTimer = null
  }
}

async function pollMetricsJob() {
  if (!metricsJobId.value) return
  try {
    const data = await getBinanceHistoryJob(metricsJobId.value)
    metricsStatus.value = data
    if (data.phase === 'COMPLETED' || data.phase === 'FAILED') {
      stopMetricsPoll()
      if (data.phase === 'COMPLETED') message.success('metrics 下载任务已完成')
    }
  } catch (e) {
    console.error(e)
  }
}

async function startVisionMetricsDownload() {
  metricsStarting.value = true
  stopMetricsPoll()
  try {
    const body = {
      startDate: metricsStartDate.value,
      endDate: metricsEndDate.value,
      allPerpetual: metricsAllPerpetual.value,
      mergeExisting: metricsMergeExisting.value,
    }
    if (!metricsAllPerpetual.value) {
      body.symbols = parseSymbols(metricsSymbolsText.value)
    }
    const res = await startBinanceVisionMetricsDownload(body)
    metricsJobId.value = res.jobId
    metricsStatus.value = null
    await pollMetricsJob()
    pollMetricsTimer = setInterval(pollMetricsJob, 2000)
    message.info('metrics 任务已启动')
  } catch (e) {
    message.error(e?.response?.data?.message || e?.message || '启动失败')
  } finally {
    metricsStarting.value = false
  }
}

/* ---------- K 线预览 ---------- */
const klineSymbol = ref('BTCUSDT')
const klineInterval = ref('15m')
const klineLimit = ref(5000)
const klineLoading = ref(false)
const klineError = ref('')
const klineBars = ref([])
const klineMeta = ref(null)
const klineLoaded = ref(false)

function pad2(n) {
  return String(n).padStart(2, '0')
}
function toDatetimeLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const klineEndLocal = ref(toDatetimeLocal(new Date()))
const klineStartLocal = ref(
  toDatetimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
)

async function loadKlineChart() {
  klineError.value = ''
  klineMeta.value = null
  klineBars.value = []
  klineLoaded.value = false
  const startMs = new Date(klineStartLocal.value).getTime()
  const endMs = new Date(klineEndLocal.value).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    klineError.value = '请选择有效的时间范围'
    return
  }
  if (endMs <= startMs) {
    klineError.value = '结束时间须晚于开始时间'
    return
  }
  klineLoading.value = true
  try {
    const data = await fetchBinanceHistoryKlineBars({
      symbol: klineSymbol.value?.trim() || 'BTCUSDT',
      interval: klineInterval.value,
      startMs,
      endMs,
      limit: klineLimit.value || 5000,
    })
    klineMeta.value = data
    klineBars.value = data.bars || []
    klineLoaded.value = true
    if (!klineBars.value.length) {
      message.warning('区间内无 K 线数据')
    }
  } catch (e) {
    klineError.value = e?.message || '查询失败'
  } finally {
    klineLoading.value = false
  }
}
</script>
