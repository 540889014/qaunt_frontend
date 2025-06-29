<template>
  <div class="spread-tool-container">
    <NavBar />
    <div class="spread-tool">
      <h1 class="text-2xl font-bold mb-4">{{ $t('spread_tool.title') }}</h1>
      <div class="input-group relative">
        <label>{{ $t('spread_tool.select_leg_a') }}</label>
        <input type="text" id="input1" v-model="input1" @input="onInput1" @focus="onInput1" autocomplete="off" class="w-full p-2 border rounded-md" @blur="onBlur1" @click="onInput1" ref="input1Ref">
        <ul v-if="showDropdown1 && filtered1.length" class="dropdown-list w-full border rounded-md shadow-lg max-h-60 overflow-auto bg-white z-10 absolute top-full left-0 mt-1" @mousedown.prevent>
          <li v-for="item in filtered1" :key="item.instId" @click="select1(item)" class="px-4 py-2 hover:bg-gray-100 cursor-pointer">{{ item.instId }}</li>
        </ul>
      </div>
      <div class="input-group relative">
        <label>{{ $t('spread_tool.select_leg_b') }}</label>
        <input type="text" id="input2" v-model="input2" @input="onInput2" @focus="onInput2" autocomplete="off" class="w-full p-2 border rounded-md" @blur="onBlur2" @click="onInput2" ref="input2Ref">
        <ul v-if="showDropdown2 && filtered2.length" class="dropdown-list w-full border rounded-md shadow-lg max-h-60 overflow-auto bg-white z-10 absolute top-full left-0 mt-1" @mousedown.prevent>
          <li v-for="item in filtered2" :key="item.instId" @click="select2(item)" class="px-4 py-2 hover:bg-gray-100 cursor-pointer">{{ item.instId }}</li>
        </ul>
      </div>
      <div class="input-group">
        <label>{{ $t('spread_tool.data_type') }}</label>
        <select v-model="dataType" class="w-full p-2 border rounded-md">
          <option value="ohlc">{{ $t('spread_tool.ohlc') }}</option>
          <option value="depth">{{ $t('spread_tool.depth') }}</option>
        </select>
      </div>
      <div v-if="dataType==='ohlc'" class="input-group">
        <label>{{ $t('spread_tool.timeframe') }}</label>
        <select v-model="timeframe" class="w-full p-2 border rounded-md">
          <option v-for="option in timeframeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
      <button @click="calculateSpread" :disabled="!selected1 || !selected2" class="w-full p-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">{{ $t('spread_tool.calculate_spread') }}</button>
      <div v-if="spread.length > 0" class="chart-container">
        <ApexKLineChartDualAxis
          :series="[...multiLineSeries, ...zScoreSeries]"
          :height="650"
          class="mt-4"
        />
      </div>
      <div v-if="spread.length > 0">
        <h3>{{ $t('spread_tool.bollinger_bands') }}</h3>
        <div class="flex items-center gap-2">{{ $t('spread_tool.bollinger_params_label') }} <input type="number" v-model.number="bollPeriod" min="2" max="100" class="w-16 p-1 border rounded-md">，{{ $t('spread_tool.bollinger_std_dev_label') }} <input type="number" v-model.number="bollStd" min="0.1" max="10" step="0.1" class="w-16 p-1 border rounded-md"> <button @click="calculateBollingerBands" class="p-1 bg-blue-500 text-white rounded-md hover:bg-blue-700">{{ $t('spread_tool.refresh') }}</button></div>
      </div>
      <div v-if="error" class="error-message">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import ApexKLineChart from '../components/ApexKLineChart.vue'
import NavBar from '../components/NavBar.vue'
import { useAuthStore } from '../stores/auth'
import { useExchangeStore } from '../stores/exchange'
import ApexKLineChartDualAxis from '@/components/ApexKLineChartDualAxis.vue'
import { useI18n } from 'vue-i18n'

const baseURL = import.meta.env.VITE_API_BASE_URL
const authStore = useAuthStore()
const exchangeStore = useExchangeStore()
const { t } = useI18n()

const input1 = ref('')
const input2 = ref('')
const selected1 = ref(null)
const selected2 = ref(null)
const showDropdown1 = ref(false)
const showDropdown2 = ref(false)
const filtered1 = ref([])
const filtered2 = ref([])
const allInstruments = ref([])
const dataType = ref('ohlc')
const timeframe = ref('1h')
const spread = ref([])
const spreadLoadingMore = ref(false)
const spreadPageStartTime = ref(null)
const error = ref('')
const input1Ref = ref(null)
const input2Ref = ref(null)
const dropdown1Top = ref(0)
const dropdown1Left = ref(0)
const dropdown2Top = ref(0)
const dropdown2Left = ref(0)

// ボリンジャーバンドパラメータ
const bollPeriod = ref(20)
const bollStd = ref(2)

const multiLineSeries = ref([])
const zScoreSeries = ref([])

const timeframeOptions = computed(() => [
  { value: '1m', label: t('spread_tool.timeframes.1m') },
  { value: '5m', label: t('spread_tool.timeframes.5m') },
  { value: '15m', label: t('spread_tool.timeframes.15m') },
  { value: '1h', label: t('spread_tool.timeframes.1h') },
  { value: '4h', label: t('spread_tool.timeframes.4h') },
  { value: '12h', label: t('spread_tool.timeframes.12h') },
  { value: '1d', label: t('spread_tool.timeframes.1d') }
])

const PAGE_SIZE = 1000

// 取得したサブスクリプトコントラクト（重複を除く）
async function loadSubscribedInstruments() {
  try {
    const username = authStore.username || localStorage.getItem('username')
    const token = localStorage.getItem('token')
    if (!username || !token) {
      error.value = t('spread_tool.error_login_required')
      return
    }
    const res = await axios.get(`${baseURL}/api/v1/subscription/user?username=${username}&exchange=${exchangeStore.selectedExchange}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    // シンボルを抽出して重複を除く
    const contractsRaw = (res.data || []).map(sub => ({ instId: sub.symbol }))
    const seen = new Set()
    const contracts = contractsRaw.filter(item => {
      if (seen.has(item.instId)) return false
      seen.add(item.instId)
      return true
    })
    allInstruments.value = contracts
  } catch (e) {
    error.value = t('spread_tool.error_fetch_instruments')
    allInstruments.value = []
  }
}

// 外部クリックでドロップダウンを閉じる
function handleClickOutside(event) {
  const input1El = document.getElementById('input1')
  const input2El = document.getElementById('input2')
  const dropdown1El = input1El && input1El.nextElementSibling
  const dropdown2El = input2El && input2El.nextElementSibling
  if (input1El && !input1El.contains(event.target) && dropdown1El && !dropdown1El.contains(event.target)) {
    showDropdown1.value = false
  }
  if (input2El && !input2El.contains(event.target) && dropdown2El && !dropdown2El.contains(event.target)) {
    showDropdown2.value = false
  }
}

onMounted(() => {
  loadSubscribedInstruments()
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

function onInput1() {
  showDropdown1.value = true
  if (!input1.value) {
    filtered1.value = allInstruments.value
    return
  }
  filtered1.value = allInstruments.value.filter(item =>
    item.instId.toLowerCase().includes(input1.value.toLowerCase())
  )
}

function onInput2() {
  showDropdown2.value = true
  if (!input2.value) {
    filtered2.value = allInstruments.value
    return
  }
  filtered2.value = allInstruments.value.filter(item =>
    item.instId.toLowerCase().includes(input2.value.toLowerCase())
  )
}

function onBlur1() {
  setTimeout(() => {
    showDropdown1.value = false
  }, 200)
}

function onBlur2() {
  setTimeout(() => {
    showDropdown2.value = false
  }, 200)
}

function select1(item) {
  selected1.value = item
  input1.value = item.instId
  showDropdown1.value = false
}

function select2(item) {
  selected2.value = item
  input2.value = item.instId
  showDropdown2.value = false
}

function updateCalculationsAndSeries() {
  const values = spread.value.map(item => item.spread);
  const times = spread.value.map(item => item.timestamp);
  const period = bollPeriod.value;
  const stdMul = bollStd.value;

  const bollMiddleData = [];
  const bollUpperData = [];
  const bollLowerData = [];
  const zScoreData = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      bollMiddleData.push({ x: times[i], y: null });
      bollUpperData.push({ x: times[i], y: null });
      bollLowerData.push({ x: times[i], y: null });
      zScoreData.push({ x: times[i], y: null });
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    bollMiddleData.push({ x: times[i], y: mean });
    bollUpperData.push({ x: times[i], y: mean + std * stdMul });
    bollLowerData.push({ x: times[i], y: mean - std * stdMul });

    zScoreData.push({
      x: times[i],
      y: std !== 0 ? (values[i] - mean) / std : 0
    });
  }

  multiLineSeries.value = [
    { name: 'Spread', data: spread.value.map(item => ({ x: new Date(item.timestamp).getTime(), y: item.spread })) },
    { name: 'Mean', data: bollMiddleData.map(item => ({ x: new Date(item.x).getTime(), y: item.y })) },
    { name: 'Upper Band', data: bollUpperData.map(item => ({ x: new Date(item.x).getTime(), y: item.y })) },
    { name: 'Lower Band', data: bollLowerData.map(item => ({ x: new Date(item.x).getTime(), y: item.y })) }
  ];

  zScoreSeries.value = [
    { name: 'Z Score', data: zScoreData.map(item => ({ x: new Date(item.x).getTime(), y: item.y })) },
    { name: 'Z Score Mean', data: zScoreData.map(item => ({ x: new Date(item.x).getTime(), y: item.y === null ? null : 0 })) },
    { name: 'Z Score Upper', data: zScoreData.map(item => ({ x: new Date(item.x).getTime(), y: item.y === null ? null : stdMul })) },
    { name: 'Z Score Lower', data: zScoreData.map(item => ({ x: new Date(item.x).getTime(), y: item.y === null ? null : -stdMul })) }
  ];
  console.log('All chart series updated based on new calculations.');
}

// ボリンジャーバンドを計算
function calculateBollingerBands() {
  updateCalculationsAndSeries();
  console.log('Bollinger Bands and Z-Scores recalculated based on new parameters.')
}

async function calculateSpread(initial = true) {
  if (!selected1.value || !selected2.value) {
    error.value = t('spread_tool.error_select_pair')
    return
  }
  error.value = ''
  spreadLoadingMore.value = true
  try {
    const interval = getIntervalMs(timeframe.value)
    let endTime, startTime
    if (initial || !spread.value.length) {
      endTime = Date.now()
      startTime = endTime - interval * PAGE_SIZE
    } else {
      // ページネーションで以前のページをロード
      endTime = spreadPageStartTime.value
      startTime = endTime - interval * PAGE_SIZE
    }
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const exchange = exchangeStore.selectedExchange || 'okx'
    const url1 = `${baseURL}/api/v1/market/kline?symbol=${encodeURIComponent(selected1.value.instId)}&timeframe=${timeframe.value}&startTime=${startTime}&endTime=${endTime}&exchange=${exchange}`
    const url2 = `${baseURL}/api/v1/market/kline?symbol=${encodeURIComponent(selected2.value.instId)}&timeframe=${timeframe.value}&startTime=${startTime}&endTime=${endTime}&exchange=${exchange}`
    console.log('Requesting data for', selected1.value.instId, 'and', selected2.value.instId, 'from', startTime, 'to', endTime)
    const [resp1, resp2] = await Promise.all([
      axios.get(url1, { headers }),
      axios.get(url2, { headers })
    ])
    const kline1 = resp1.data || []
    const kline2 = resp2.data || []
    console.log('Received data:', kline1.length, 'for', selected1.value.instId, 'and', kline2.length, 'for', selected2.value.instId)
    if (kline1.length === 0 || kline2.length === 0) {
      error.value = t('spread_tool.error_fetch_data')
      return
    }
    
    // Mapを使用してデータを整列し、タイムスタンプが完全に一致することを確認
    const priceMap2 = new Map(kline2.map(item => [item.timestamp, item.closePrice]));
    
    let spreadData = [];
    for (const item1 of kline1) {
      if (priceMap2.has(item1.timestamp)) {
        const price1 = item1.closePrice;
        const price2 = priceMap2.get(item1.timestamp);
        const spreadValue = price2 !== 0 ? (price1 / price2) - 1 : 0;
        spreadData.push({
          timestamp: item1.timestamp,
          spread: spreadValue,
          upperBand: 0,
          lowerBand: 0,
          middleBand: 0
        });
      }
    }

    // タイムスタンプで昇順にソートしてデータの連続性を確保
    spreadData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log('Calculated spread points:', spreadData.length)
    if (initial || !spread.value.length) {
      spread.value = spreadData
    } else {
      // 前に追加
      spread.value = [...spreadData, ...spread.value]
    }
    if (spread.value.length > 0) {
      spreadPageStartTime.value = Math.min(...spread.value.map(item => item.timestamp))
    }
    
    updateCalculationsAndSeries();

    console.log('Spread data updated, total points:', spread.value.length)
    // スプレッドデータに異常値があるかどうかを確認
    const spreadValues = spread.value.map(item => item.spread)
    const minSpread = Math.min(...spreadValues)
    const maxSpread = Math.max(...spreadValues)
    console.log('Spread value range:', minSpread, 'to', maxSpread)
    // タイムスタンプが連続しているかどうかを確認
    const timestamps = spread.value.map(item => item.timestamp)
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < timestamps[i-1]) {
        console.warn('Timestamp discontinuity detected at index', i, ':', timestamps[i-1], 'to', timestamps[i])
      }
    }

    calculateBollingerBands()
  } catch (e) {
    console.error('スプレッドの計算に失敗しました:', e)
    error.value = t('spread_tool.error_calculation_fail', { error: e.message })
    spread.value = []
  } finally {
    spreadLoadingMore.value = false
  }
}

function onSpreadPan(direction) {
  if (spreadLoadingMore.value) return
  if (direction === 'left' && spread.value.length > 0) {
    calculateSpread(false)
  }
}

function getIntervalMs(tf) {
  const map = { '1m': 60*1000, '5m': 5*60*1000, '15m': 15*60*1000, '1h': 60*60*1000, '4h': 4*60*60*1000, '12h': 12*60*60*1000, '1d': 24*60*60*1000 }
  return map[tf] || 60*1000
}
</script>

<style scoped>
.spread-tool-container {
  @apply bg-gray-100 min-h-screen;
}

.spread-tool {
  @apply mx-auto p-4 sm:p-6;
}

h1 {
  @apply text-3xl font-bold mb-8 text-center text-gray-800;
}

h3 {
  @apply text-xl font-bold mt-6 mb-2 text-center text-gray-700;
}

.input-group {
  @apply mb-4 flex flex-col;
}

label {
  @apply text-sm font-medium text-gray-700 mb-1;
}

input, select {
  @apply mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50;
}

button {
  @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
}

.chart-container {
  @apply mt-6;
}

.error-message {
  @apply text-red-500 mt-4;
}

.dropdown-list {
  @apply absolute z-10 bg-white border rounded-md shadow-lg max-h-60 overflow-auto;
}

li {
  @apply px-4 py-2 hover:bg-gray-100 cursor-pointer;
}
</style> 