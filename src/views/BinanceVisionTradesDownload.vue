<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 min-h-screen dark:bg-gray-900">
    <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">币安 UM 月度成交 → .jtrade</h1>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
      从
      <a
        href="https://data.binance.vision/?prefix=data/futures/um/monthly/trades/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-indigo-600 dark:text-indigo-400 underline"
      >data.binance.vision</a>
      按<strong>月份</strong>拉取 U 本位永续 <strong>trades</strong> ZIP，仅处理研究端
      <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">TrendLiquidityWhitelist</code>
      白名单合约（与趋势/成交量节拍同源）。解压 CSV 后写入二进制：
      <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded break-all">{{ outputHint }}</code>
      <br />
      单文件格式：16 字节头 <code class="text-xs">BTRD</code> + 每条 48 字节（id, timeMs, price, qty, quoteQty, flags）。
      输出目录由服务端 <code class="text-xs">binance.vision-trades.output-dir</code> 配置（默认外接盘路径）。
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
      </div>

      <n-checkbox v-model:checked="mergeExisting">合并已有 .jtrade（读旧文件 + 新 ZIP，按 trade id 去重重写）</n-checkbox>

      <n-alert type="info" title="合约范围" class="max-w-3xl">
        固定为后端白名单 <span class="font-mono">TrendLiquidityWhitelist.SYMBOLS</span>，不在前端选择合约。
        某月某合约无文件（404）会跳过并记日志，不视为整任务失败。
      </n-alert>

      <n-button
        type="primary"
        size="large"
        :loading="starting"
        :disabled="!canStart"
        @click="startDownload"
      >
        开始下载并写入 .jtrade
      </n-button>

      <div v-if="jobId" class="space-y-3 border-t pt-4 dark:border-gray-600">
        <div class="flex items-center gap-4 flex-wrap">
          <span class="text-sm font-mono">job: {{ jobId }}</span>
          <n-tag :type="phaseTag">{{ status?.phase }}</n-tag>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ status?.completedTasks ?? 0 }} / {{ status?.totalTasks ?? 0 }} 任务 ·
            {{ (status?.barsWritten ?? 0).toLocaleString() }} 条成交（累计写入）
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
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { NAlert, NButton, NCheckbox, NProgress, NTag, useMessage } from 'naive-ui'
import { startBinanceVisionTradesDownload, getBinanceVisionTradesJob } from '@/api'

const message = useMessage()
const outputHint = '{outputDir}/{SYMBOL}/{SYMBOL}-trades-yyyy-MM.jtrade'

const startMonth = ref(defaultStartMonth())
const endMonth = ref(defaultEndMonth())
const mergeExisting = ref(false)
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

const canStart = computed(() => !!(startMonth.value && endMonth.value))

const phaseTag = computed(() => {
  const p = status.value?.phase
  if (p === 'COMPLETED') return 'success'
  if (p === 'FAILED') return 'error'
  return 'info'
})

const logText = computed(() => (status.value?.recentLogs || []).join('\n'))

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollJob() {
  if (!jobId.value) return
  try {
    const data = await getBinanceVisionTradesJob(jobId.value)
    status.value = data
    if (data.phase === 'COMPLETED' || data.phase === 'FAILED') {
      stopPoll()
      if (data.phase === 'COMPLETED') message.success('Trades 下载任务已完成')
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
      mergeExisting: mergeExisting.value,
    }
    const res = await startBinanceVisionTradesDownload(body)
    jobId.value = res.jobId
    status.value = null
    await pollJob()
    pollTimer = setInterval(pollJob, 2000)
    message.info('任务已启动（白名单 × 月份），请等待进度刷新')
  } catch (e) {
    message.error(e?.message || e?.response?.data?.message || '启动失败')
  } finally {
    starting.value = false
  }
}

onUnmounted(() => stopPoll())
</script>
