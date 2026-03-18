<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-white">K 线同步到实盘环境</h1>
    </div>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      第一步可从交易所拉取历史 K 线到本库；第二步将本系统 kline_data 同步到实盘环境（max-quant-xasset）的 xasset_scm_kline_bar 表。
    </p>

    <!-- 第一步：从交易所拉取历史 K 线到本库 -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4 mb-6">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white">从交易所拉取历史 K 线到本库</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">从所选交易所拉取最近最多 1440 条/合约，写入本系统 kline_data。OKX 单页 300 条；Binance 单页最多 1000 条。</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">交易所</label>
          <select
            v-model="historyForm.exchange"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="okx">OKX</option>
            <option value="binance">Binance</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">合约（留空则拉取全部永续）</label>
          <input
            v-model="historyForm.symbols"
            type="text"
            :placeholder="historyForm.exchange === 'binance' ? 'BTCUSDT, ETHUSDT 或留空' : 'BTC-USDT-SWAP, ETH-USDT-SWAP 或留空'"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">周期</label>
          <select
            v-model="historyForm.timeframe"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="1m">1m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1H">1H</option>
            <option value="4H">4H</option>
            <option value="12H">12H</option>
            <option value="1D">1D</option>
          </select>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <label class="inline-flex items-center">
          <input v-model="historyForm.allPerpetual" type="checkbox" class="rounded border-gray-300" />
          <span class="ml-2 text-gray-700 dark:text-gray-300">全部永续合约（勾选时忽略上方合约输入）</span>
        </label>
      </div>
      <div class="flex items-center gap-4 pt-2">
        <button
          type="button"
          :disabled="historyLoading"
          @click="doFetchHistory"
          class="px-4 py-2 rounded-md font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ historyLoading ? '同步中…' : '同步历史' }}
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">每合约最多 1440 条，由接口内分页请求（OKX 单页 300 条；Binance 单页 1000 条）。</p>
    </div>
    <div v-if="historyResult" class="mb-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4" :class="historyResult.syncedSymbols >= 0 && historyResult.errors?.length === 0 ? 'border-green-500' : 'border-amber-500'">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">拉取历史结果</h2>
      <p class="text-gray-700 dark:text-gray-300">已同步合约数：{{ historyResult.syncedSymbols }}，总 bar 数：{{ historyResult.totalBars }}</p>
      <ul v-if="historyResult.errors?.length" class="mt-2 text-sm text-amber-600 dark:text-amber-400 space-y-1">
        <li v-for="(err, i) in historyResult.errors" :key="i">{{ err }}</li>
      </ul>
    </div>

    <!-- 研究端 K 线比对：数据库 vs 二进制 .jbar -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4 mb-6">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white">K 线数据比对（研究端）</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">比对本系统 kline_data 与 dataDir 下 .jbar 文件最近 200 条，按时间倒序展示。</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">合约</label>
          <input
            v-model="compareForm.symbol"
            type="text"
            placeholder="BTC-USDT-SWAP"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">周期</label>
          <select
            v-model="compareForm.timeframe"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="1m">1m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1H">1H</option>
            <option value="4H">4H</option>
            <option value="12H">12H</option>
            <option value="1D">1D</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">交易所</label>
          <input
            v-model="compareForm.exchange"
            type="text"
            placeholder="okx"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div class="flex items-end">
          <button
            type="button"
            :disabled="compareLoading || !compareForm.symbol?.trim()"
            @click="doCompareJbarDb"
            class="px-4 py-2 rounded-md font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ compareLoading ? '比对中…' : '比对' }}
          </button>
        </div>
      </div>
      <div v-if="compareError" class="text-sm text-red-600 dark:text-red-400">{{ compareError }}</div>
      <div v-if="compareResult && !compareResult.error" class="mt-4">
        <p class="text-gray-700 dark:text-gray-300 mb-2">
          jbar {{ compareResult.jbarCount }} 条，DB {{ compareResult.dbCount }} 条；一致 {{ compareResult.matchCount }}，仅 jbar {{ compareResult.onlyInJbarCount }}，仅 DB {{ compareResult.onlyInDbCount }}，数值差异 {{ compareResult.diffCount }}。
        </p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead class="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">
              <tr>
                <th class="px-2 py-1">时间(ts)</th>
                <th class="px-2 py-1">状态</th>
                <th class="px-2 py-1">jbar O/H/L/C</th>
                <th class="px-2 py-1">DB O/H/L/C</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in comparePaginatedRows"
                :key="row.ts"
                class="border-b border-gray-200 dark:border-gray-600"
                :class="{ 'bg-green-50 dark:bg-green-900/20': row.status === 'match', 'bg-amber-50 dark:bg-amber-900/20': row.status === 'diff', 'bg-gray-50 dark:bg-gray-800': row.status?.startsWith('only_') }"
              >
                <td class="px-2 py-1">{{ formatTs(row.ts) }}</td>
                <td class="px-2 py-1">{{ row.status }}</td>
                <td class="px-2 py-1">{{ formatOhlc(row.openJbar, row.highJbar, row.lowJbar, row.closeJbar) }}</td>
                <td class="px-2 py-1">{{ formatOhlc(row.openDb, row.highDb, row.lowDb, row.closeDb) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="compareResult.rows?.length > comparePageSize" class="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <button
            type="button"
            :disabled="comparePage <= 1"
            @click="comparePage = Math.max(1, comparePage - 1)"
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            上一页
          </button>
          <span>第 {{ comparePage }} / {{ compareTotalPages }} 页（每页 {{ comparePageSize }} 条）</span>
          <button
            type="button"
            :disabled="comparePage >= compareTotalPages"
            @click="comparePage = Math.min(compareTotalPages, comparePage + 1)"
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">实盘环境地址（必填）</label>
        <input
          v-model="form.liveBaseUrl"
          type="text"
          placeholder="http://192.168.1.100:8080 或 https://xasset.example.com"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">实盘 max-quant-xasset 服务根地址，不要以 / 结尾</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">同步周期</label>
        <div class="flex flex-wrap gap-4">
          <label class="inline-flex items-center">
            <input v-model="form.timeframes" type="checkbox" value="15m" class="rounded border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">15m</span>
          </label>
          <label class="inline-flex items-center">
            <input v-model="form.timeframes" type="checkbox" value="30m" class="rounded border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">30m</span>
          </label>
          <label class="inline-flex items-center">
            <input v-model="form.timeframes" type="checkbox" value="1h" class="rounded border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">1h</span>
          </label>
          <label class="inline-flex items-center mr-6">
            <input v-model="form.timeframes" type="checkbox" value="4h" class="rounded border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">4h</span>
          </label>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">不选则同步全部四种周期（15m/30m/1h/4h）</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">时间范围</label>
        <div class="flex flex-wrap gap-3 mb-3">
          <label class="inline-flex items-center">
            <input v-model="form.rangeMode" type="radio" value="bars" class="border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">按根数</span>
          </label>
          <label class="inline-flex items-center">
            <input v-model="form.rangeMode" type="radio" value="1d" class="border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">最近 1 天</span>
          </label>
          <label class="inline-flex items-center">
            <input v-model="form.rangeMode" type="radio" value="3d" class="border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">最近 3 天</span>
          </label>
          <label class="inline-flex items-center">
            <input v-model="form.rangeMode" type="radio" value="7d" class="border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">最近 7 天</span>
          </label>
          <label class="inline-flex items-center">
            <input v-model="form.rangeMode" type="radio" value="custom" class="border-gray-300" />
            <span class="ml-2 text-gray-700 dark:text-gray-300">自定义范围</span>
          </label>
        </div>
        <div v-if="form.rangeMode === 'bars'" class="mt-2">
          <input
            v-model.number="form.lookbackBars"
            type="number"
            min="100"
            max="5000"
            class="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span class="ml-2 text-gray-600 dark:text-gray-400">每个合约回看根数（100–5000）</span>
        </div>
        <div v-if="form.rangeMode === 'custom'" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">开始时间</label>
            <input
              v-model="form.startDatetime"
              type="datetime-local"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">结束时间</label>
            <input
              v-model="form.endDatetime"
              type="datetime-local"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 pt-2">
        <button
          type="button"
          :disabled="!form.liveBaseUrl.trim() || loading"
          @click="doSync"
          class="px-4 py-2 rounded-md font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? '同步中…' : '同步到实盘' }}
        </button>
        <button
          type="button"
          :disabled="!form.liveBaseUrl.trim() || refreshLoading"
          @click="doRefreshSubscribe"
          class="px-4 py-2 rounded-md font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ refreshLoading ? '刷新中…' : '刷新全市场订阅' }}
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">「刷新全市场订阅」：按 system 最新合约列表先退订再重订，应对上新/下架。实盘地址填 SCM 根地址（如 http://host:8092）。</p>
    </div>

    <div v-if="result" class="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md" :class="result.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">{{ result.success ? '同步成功' : '同步失败' }}</h2>
      <p class="text-gray-700 dark:text-gray-300">{{ result.message }}</p>
      <ul class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <li>分区数：{{ result.partitions }}</li>
        <li>发送 K 线条数：{{ result.barsSent }}</li>
        <li>实盘已写入条数：{{ result.barsUpserted }}</li>
      </ul>
    </div>

    <div v-if="refreshResult" class="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md" :class="refreshResult.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">{{ refreshResult.success ? '刷新订阅成功' : '刷新订阅失败' }}</h2>
      <p class="text-gray-700 dark:text-gray-300">{{ refreshResult.message }}</p>
      <template v-if="refreshResult.success && refreshResult.data">
        <ul class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>交易所：{{ refreshResult.data.exchange }}</li>
          <li>合约数：{{ refreshResult.data.symbolCount }}</li>
          <li>批次数：{{ (refreshResult.data.specKeys || []).length }}</li>
        </ul>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { syncKlineToLive, refreshFullMarketSubscribe, fetchHistoryCandles, compareKlineJbarDb } from '@/api'

const historyForm = reactive({
  exchange: 'okx',
  symbols: '',
  timeframe: '1H',
  allPerpetual: false
})
const historyLoading = ref(false)
const historyResult = ref(null)

const compareForm = reactive({ symbol: '', timeframe: '1H', exchange: 'okx' })
const compareLoading = ref(false)
const compareResult = ref(null)
const compareError = ref('')
const comparePage = ref(1)
const comparePageSize = 20
const compareTotalPages = computed(() =>
  compareResult.value?.rows?.length
    ? Math.max(1, Math.ceil(compareResult.value.rows.length / comparePageSize))
    : 1
)
const comparePaginatedRows = computed(() => {
  const rows = compareResult.value?.rows || []
  const start = (comparePage.value - 1) * comparePageSize
  return rows.slice(start, start + comparePageSize)
})
function formatTs (ts) {
  if (ts == null) return '-'
  const d = new Date(ts)
  return d.toISOString ? d.toISOString().slice(0, 19).replace('T', ' ') : String(ts)
}
function formatOhlc (o, h, l, c) {
  if (o == null && h == null && l == null && c == null) return '-'
  return [o, h, l, c].map(v => v != null ? Number(v).toFixed(4) : '-').join(' / ')
}
const doCompareJbarDb = async () => {
  if (!compareForm.symbol?.trim()) return
  compareLoading.value = true
  compareResult.value = null
  compareError.value = ''
  comparePage.value = 1
  try {
    const data = await compareKlineJbarDb({
      symbol: compareForm.symbol.trim(),
      timeframe: compareForm.timeframe || '1H',
      exchange: compareForm.exchange || 'okx'
    })
    compareResult.value = data
    if (data?.error) compareError.value = data.error
  } catch (e) {
    compareError.value = e?.response?.data?.message || e?.message || '请求失败'
  } finally {
    compareLoading.value = false
  }
}

const doFetchHistory = async () => {
  historyLoading.value = true
  historyResult.value = null
  try {
    const params = {
      exchange: historyForm.exchange || 'okx',
      timeframe: historyForm.timeframe || '1H',
      limit: 1440
    }
    if (historyForm.allPerpetual) {
      params.allPerpetual = true
    } else if (historyForm.symbols?.trim()) {
      params.symbols = historyForm.symbols.trim()
    } else {
      historyResult.value = { syncedSymbols: 0, totalBars: 0, errors: ['请填写合约（逗号分隔）或勾选「全部永续合约」'] }
      return
    }
    const res = await fetchHistoryCandles(params)
    const data = res?.data?.data ?? res?.data
    historyResult.value = data ? { syncedSymbols: data.syncedSymbols ?? 0, totalBars: data.totalBars ?? 0, errors: data.errors ?? [] } : { syncedSymbols: 0, totalBars: 0, errors: ['无返回数据'] }
  } catch (e) {
    historyResult.value = {
      syncedSymbols: 0,
      totalBars: 0,
      errors: [e?.response?.data?.message || e?.message || '请求失败']
    }
  } finally {
    historyLoading.value = false
  }
}

const form = reactive({
  liveBaseUrl: '',
  timeframes: ['15m', '30m', '1h', '4h'],
  rangeMode: '1d', // 'bars' | '1d' | '3d' | '7d' | 'custom'
  lookbackBars: 500,
  startDatetime: '',
  endDatetime: ''
})

const loading = ref(false)
const result = ref(null)
const refreshLoading = ref(false)
const refreshResult = ref(null)

function getTimeRange () {
  const mode = form.rangeMode
  const now = Date.now()
  if (mode === '1d') return { startTime: now - 24 * 60 * 60 * 1000, endTime: now }
  if (mode === '3d') return { startTime: now - 3 * 24 * 60 * 60 * 1000, endTime: now }
  if (mode === '7d') return { startTime: now - 7 * 24 * 60 * 60 * 1000, endTime: now }
  if (mode === 'custom' && form.startDatetime && form.endDatetime) {
    const start = new Date(form.startDatetime).getTime()
    const end = new Date(form.endDatetime).getTime()
    if (start < end) return { startTime: start, endTime: end }
  }
  return { startTime: null, endTime: null }
}

const doSync = async () => {
  const url = form.liveBaseUrl.trim()
  if (!url) return
  loading.value = true
  result.value = null
  try {
    const { startTime, endTime } = getTimeRange()
    const body = {
      liveBaseUrl: url,
      timeframes: Array.isArray(form.timeframes) && form.timeframes.length > 0 ? form.timeframes : ['15m', '30m', '1h', '4h']
    }
    if (startTime != null && endTime != null) {
      body.startTime = startTime
      body.endTime = endTime
    } else {
      body.lookbackBars = Math.max(100, Math.min(5000, form.lookbackBars || 500))
    }
    const data = await syncKlineToLive(body)
    result.value = data
  } catch (e) {
    result.value = {
      success: false,
      message: e?.message || '请求失败',
      partitions: 0,
      barsSent: 0,
      barsUpserted: 0
    }
  } finally {
    loading.value = false
  }
}

const doRefreshSubscribe = async () => {
  const url = form.liveBaseUrl.trim()
  if (!url) return
  refreshLoading.value = true
  refreshResult.value = null
  try {
    const res = await refreshFullMarketSubscribe(url)
    const wrap = res?.data
    const scmBody = wrap?.data
    const payload = scmBody?.data ?? scmBody
    const ok = wrap?.code === 200 && (scmBody?.code === undefined || scmBody?.code === 200)
    refreshResult.value = {
      success: ok,
      message: ok ? `已按最新合约列表刷新，共 ${payload?.symbolCount ?? 0} 个合约` : (scmBody?.message || wrap?.message || '刷新失败'),
      data: payload
    }
  } catch (e) {
    refreshResult.value = {
      success: false,
      message: e?.response?.data?.message || e?.message || '请求失败'
    }
  } finally {
    refreshLoading.value = false
  }
}
</script>
