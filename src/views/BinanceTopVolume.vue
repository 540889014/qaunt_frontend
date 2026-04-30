<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 min-h-screen dark:bg-gray-900">
    <div class="flex flex-col gap-4 mb-6">
      <div class="flex flex-wrap justify-between items-center gap-4">
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
          币安U本位永续合约 24小时成交量 Top {{ tableData.length || 150 }}
        </h1>
        <n-button type="primary" :loading="loading" @click="fetchData">刷新数据</n-button>
      </div>

      <div class="flex flex-wrap items-center gap-4 text-sm">
        <n-radio-group v-model:value="mode" size="small">
          <n-radio-button value="live">实时（Binance 24h ticker）</n-radio-button>
          <n-radio-button value="history">历史（本地 .jbar 汇总）</n-radio-button>
        </n-radio-group>

        <template v-if="mode === 'history'">
          <span class="text-gray-600 dark:text-gray-400">UTC 日</span>
          <n-date-picker
            v-model:value="historyDate"
            type="date"
            clearable
            class="w-44"
          />
          <span class="text-gray-600 dark:text-gray-400">K 线周期</span>
          <n-select
            v-model:value="historyInterval"
            :options="intervalOptions"
            class="w-28"
          />
        </template>
      </div>

      <p v-if="mode === 'history'" class="text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
        按所选<strong>日历日</strong>解释为 UTC 自然日（00:00–24:00 UTC），在
        <code class="px-1 rounded bg-gray-200 dark:bg-gray-700">data/history/binance</code>
        下读取 <code class="px-1 rounded bg-gray-200 dark:bg-gray-700">&lt;SYMBOL&gt;_{{
          historyInterval
        }}.jbar</code>
        内该日所有 K 线的 USDT 成交额并累加；无文件的合约不参与排名。请先通过「币安历史 K 线下载」生成对应周期数据。
      </p>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <n-data-table
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :bordered="false"
        striped
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, h } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { NButton, NDataTable, NRadioGroup, NRadioButton, NDatePicker, NSelect, useMessage } from 'naive-ui'
import { getBinanceTopVolumeContracts, getBinanceHistoryDayTopVolume } from '@/api'

const message = useMessage()
const tableData = ref([])
const loading = ref(false)
const mode = ref<'live' | 'history'>('live')
const historyInterval = ref('1h')
const intervalOptions = [
  { label: '1h', value: '1h' },
  { label: '15m', value: '15m' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' }
]

function defaultYesterdayLocalMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d.getTime()
}

const historyDate = ref<number | null>(defaultYesterdayLocalMs())

function formatPickerDateAsYmd(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const changeColTitle = computed(() => (mode.value === 'history' ? '日涨跌幅' : '24h涨跌幅'))

const formatVolume = (val: number) => {
  if (!val) return '0'
  if (val >= 100000000) {
    return (val / 100000000).toFixed(2) + ' 亿'
  } else if (val >= 10000) {
    return (val / 10000).toFixed(2) + ' 万'
  }
  return val.toFixed(2)
}

const formatPrice = (val: number) => {
  if (val === undefined || val === null) return '-'
  if (val < 0.001) return val.toFixed(6)
  if (val < 1) return val.toFixed(4)
  if (val < 10) return val.toFixed(3)
  return val.toFixed(2)
}

const columns = computed(() => [
  {
    title: '排名',
    key: 'rank',
    width: 80,
    align: 'center',
    render: (_: unknown, index: number) => index + 1
  },
  {
    title: '合约名称',
    key: 'symbol',
    render: (row: { symbol: string }) => h('strong', null, row.symbol)
  },
  {
    title: '最新价',
    key: 'lastPrice',
    align: 'right',
    render: (row: { lastPrice: number }) => formatPrice(row.lastPrice)
  },
  {
    title: changeColTitle.value,
    key: 'priceChangePercent',
    align: 'right',
    render: (row: { priceChangePercent: number }) => {
      const val = row.priceChangePercent
      const isUp = val >= 0
      return h(
        'span',
        { style: { color: isUp ? '#f56c6c' : '#67c23a' } },
        `${isUp ? '+' : ''}${val}%`
      )
    }
  },
  {
    title: mode.value === 'history' ? '当日成交额(USDT)' : '24h成交额(USDT)',
    key: 'quoteVolume',
    align: 'right',
    render: (row: { quoteVolume: number }) => formatVolume(Number(row.quoteVolume))
  }
])

watch(mode, () => {
  fetchData()
})

const fetchData = async () => {
  loading.value = true
  try {
    if (mode.value === 'live') {
      const response = await getBinanceTopVolumeContracts()
      tableData.value = Array.isArray(response) ? response : []
      return
    }
    if (historyDate.value == null) {
      message.warning('请选择历史统计日')
      tableData.value = []
      return
    }
    const date = formatPickerDateAsYmd(historyDate.value)
    const response = await getBinanceHistoryDayTopVolume({
      date,
      interval: historyInterval.value,
      limit: 150
    })
    tableData.value = Array.isArray(response) ? response : []
    if (tableData.value.length === 0) {
      message.warning('无数据：请确认该日、该周期下已存在 .jbar 文件')
    }
  } catch (error: any) {
    console.error('获取数据失败:', error)
    message.error('获取数据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>
