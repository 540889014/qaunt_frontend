<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 min-h-screen dark:bg-gray-900">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
        币安 ABO 动态白名单（换手率 Top {{ tableData.length || turnoverTopN }}）
      </h1>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-gray-600 dark:text-gray-300">排除市值前N（除BTC）</span>
        <n-select v-model:value="excludeTopN" size="small" :options="excludeOptions" class="w-24" />
        <span class="text-sm text-gray-600 dark:text-gray-300">换手率前N</span>
        <n-select v-model:value="turnoverTopN" size="small" :options="topNOptions" class="w-24" />
        <n-button type="primary" :loading="loading" @click="fetchData">刷新</n-button>
      </div>
    </div>

    <div class="mb-3 text-sm text-gray-600 dark:text-gray-300">
      <span class="mr-4">计算口径：24h成交额 / 市值（CoinGecko）</span>
      <span>可交易池：Binance USDT 永续（TRADING）</span>
    </div>
    <div class="mb-4 text-xs text-gray-500 dark:text-gray-400">
      已剔除市值前 {{ excludeTopN }}（除 BTC）：
      <span>{{ excludedPreview }}</span>
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
import { ref, onMounted, computed, h } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { NButton, NDataTable, NSelect, useMessage } from 'naive-ui'
import { fetchBinanceHistorySymbols } from '@/api'
import { resolveBinanceUsdtContract } from '@/constants/binanceSymbolAlias'

type Row = {
  rank: number
  symbol: string
  turnover: number
  marketCap: number
  totalVolume: number
}

const message = useMessage()
const loading = ref(false)
const tableData = ref<Row[]>([])
const excludedCapContracts = ref<string[]>([])
const excludeTopN = ref(20)
const turnoverTopN = ref(30)

const excludeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '30', value: 30 },
  { label: '50', value: 50 },
]
const topNOptions = [
  { label: '20', value: 20 },
  { label: '30', value: 30 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

const fmtMoney = (n: number) => {
  if (!Number.isFinite(n)) return '-'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}
const fmtPct = (n: number) => {
  if (!Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(2)}%`
}

const excludedPreview = computed(() => {
  if (!excludedCapContracts.value.length) return '-'
  const preview = excludedCapContracts.value.slice(0, 18).join(', ')
  if (excludedCapContracts.value.length <= 18) return preview
  return `${preview} ...`
})

const columns = [
  { title: '排名', key: 'rank', width: 80, align: 'center' as const },
  {
    title: '合约',
    key: 'symbol',
    width: 180,
    render: (row: Row) => h('strong', null, row.symbol),
  },
  {
    title: '换手率(24h成交额/市值)',
    key: 'turnover',
    align: 'right' as const,
    render: (row: Row) => fmtPct(row.turnover),
  },
  {
    title: '24h成交额(USD)',
    key: 'totalVolume',
    align: 'right' as const,
    render: (row: Row) => fmtMoney(row.totalVolume),
  },
  {
    title: '市值(USD)',
    key: 'marketCap',
    align: 'right' as const,
    render: (row: Row) => fmtMoney(row.marketCap),
  },
]

const fetchData = async () => {
  loading.value = true
  try {
    const allContracts = await fetchBinanceHistorySymbols()
    const contractSet = new Set(
      (Array.isArray(allContracts) ? allContracts : [])
        .map((s) => String(s || '').trim().toUpperCase())
        .filter(Boolean)
    )
    if (!contractSet.size) {
      message.warning('未加载到 Binance 合约列表')
      tableData.value = []
      return
    }

    const pages = [1, 2]
    const perPage = 250
    const allRows: any[] = []
    for (const page of pages) {
      const url =
        `https://api.coingecko.com/api/v3/coins/markets` +
        `?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`CoinGecko HTTP ${resp.status}`)
      const rows = await resp.json()
      if (Array.isArray(rows)) allRows.push(...rows)
    }

    const normalized = allRows
      .map((r) => ({
        symbol: String(r?.symbol || '').trim().toUpperCase(),
        marketCap: Number(r?.market_cap || 0),
        totalVolume: Number(r?.total_volume || 0),
      }))
      .filter(
        (r) =>
          r.symbol &&
          Number.isFinite(r.marketCap) &&
          Number.isFinite(r.totalVolume) &&
          r.marketCap > 0 &&
          r.totalVolume > 0
      )

    const capTop = normalized
      .filter((r) => r.symbol !== 'BTC')
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, Number(excludeTopN.value) || 20)

    const excluded = new Set(
      capTop
        .map((r) => resolveBinanceUsdtContract(r.symbol, contractSet))
        .filter(Boolean)
    )
    excluded.add('BTCUSDT')
    excludedCapContracts.value = [...excluded]

    const ranked = normalized
      .map((r) => ({ ...r, turnover: r.totalVolume / r.marketCap }))
      .sort((a, b) => b.turnover - a.turnover)

    const out: Row[] = []
    const seen = new Set<string>()
    const topN = Number(turnoverTopN.value) || 30
    for (const r of ranked) {
      const contract = resolveBinanceUsdtContract(r.symbol, contractSet)
      if (!contract) continue
      if (!contractSet.has(contract)) continue
      if (excluded.has(contract)) continue
      if (seen.has(contract)) continue
      seen.add(contract)
      out.push({
        rank: out.length + 1,
        symbol: contract,
        turnover: r.turnover,
        marketCap: r.marketCap,
        totalVolume: r.totalVolume,
      })
      if (out.length >= topN) break
    }
    tableData.value = out
  } catch (error: any) {
    console.error('ABO 动态白名单加载失败:', error)
    message.error(`加载失败: ${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

