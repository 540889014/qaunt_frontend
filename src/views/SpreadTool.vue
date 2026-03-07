<template>
  <div class="page-container">
    <NavBar />
    <div class="content-container">
      <h1 class="text-2xl font-bold mb-4">{{ $t('spread_tool.title') }}</h1>
      
      <div class="tabs">
        <button
          v-for="asset in assetTypes"
          :key="asset.type"
          @click="activeAssetTypeTab = asset.type"
          :class="['tab-button', { 'active': activeAssetTypeTab === asset.type, 'disabled': asset.disabled }]"
          :disabled="asset.disabled"
        >
          {{ $t(asset.label) }}
        </button>
      </div>

      <div class="form-container mb-4 p-4 border rounded-lg shadow-sm bg-white">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div class="form-group">
            <label for="leg1_symbol">{{ $t('spread_tool.select_leg_a') }}</label>
            <input type="text" id="leg1_symbol" v-model="form.leg1.symbol" @input="onInput('leg1')" @focus="onInput('leg1')" autocomplete="off" class="w-full p-2 border rounded-md" @blur="onBlur('leg1')">
            <ul v-if="showDropdown.leg1 && filteredSymbols.leg1.length" class="dropdown-list">
              <li v-for="item in filteredSymbols.leg1" :key="item.key" @click="select('leg1', item)" class="px-4 py-2 hover:bg-gray-100 cursor-pointer">{{ item.display }}</li>
            </ul>
          </div>
          <div class="form-group">
            <label for="leg2_symbol">{{ $t('spread_tool.select_leg_b') }}</label>
            <input type="text" id="leg2_symbol" v-model="form.leg2.symbol" @input="onInput('leg2')" @focus="onInput('leg2')" autocomplete="off" class="w-full p-2 border rounded-md" @blur="onBlur('leg2')">
            <ul v-if="showDropdown.leg2 && filteredSymbols.leg2.length" class="dropdown-list">
              <li v-for="item in filteredSymbols.leg2" :key="item.key" @click="select('leg2', item)" class="px-4 py-2 hover:bg-gray-100 cursor-pointer">{{ item.display }}</li>
            </ul>
          </div>
          <div v-if="activeAssetTypeTab === 'CRYPTO'" class="form-group">
            <label for="exchange">{{ $t('subscriptions.exchange') }}</label>
            <select id="exchange" v-model="form.exchange" class="w-full p-2 border rounded-md">
              <option v-for="ex in exchangeStore.exchanges" :key="ex" :value="ex">{{ ex }}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="timeframe">{{ $t('spread_tool.timeframe') }}</label>
            <select id="timeframe" v-model="form.timeframe" class="w-full p-2 border rounded-md">
              <option v-for="option in timeframeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div v-if="activeAssetTypeTab === 'FOREX'" class="form-group">
            <label for="startTime">{{ $t('spread_tool.start_time') }}</label>
            <input type="date" id="startTime" v-model="form.startTime" class="w-full p-2 border rounded-md">
          </div>
          <div v-if="activeAssetTypeTab === 'FOREX'" class="form-group">
            <label for="endTime">{{ $t('spread_tool.end_time') }}</label>
            <input type="date" id="endTime" v-model="form.endTime" class="w-full p-2 border rounded-md">
          </div>
          <div class="form-group">
            <button @click="fetchData" :disabled="!form.leg1.symbol || !form.leg2.symbol || loading" class="w-full p-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">
              <span v-if="loading">{{ $t('spread_tool.loading') }}</span>
              <span v-else>{{ $t('spread_tool.calculate_spread') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="bollingerChartSeries.length > 0" class="chart-container">
        <h3 class="font-bold mb-2">{{ $t('spread_tool.chart_bollinger_title') }}</h3>
        <ApexKLineChartDualAxis
          :series="bollingerChartSeries"
          :height="420"
          class="mt-2"
        />
      </div>

      <div v-if="zScoreChartSeries.length > 0" class="chart-container">
        <h3 class="font-bold mb-2">{{ $t('spread_tool.chart_zscore_title') }}</h3>
        <ApexKLineChartDualAxis
          :series="zScoreChartSeries"
          :height="420"
          class="mt-2"
        />
      </div>
       <div v-if="bollingerChartSeries.length > 0" class="controls-container mt-4 p-4 border rounded-lg shadow-sm bg-white">
        <h3 class="font-bold mb-2">{{ $t('spread_tool.bollinger_bands') }}</h3>
        <div class="flex flex-wrap items-center gap-2">
          <span>{{ $t('spread_tool.spread_mode_label') }}</span>
          <select v-model="spreadMode" class="p-1 border rounded-md">
            <option value="ratio">{{ $t('spread_tool.spread_mode_ratio') }}</option>
            <option value="anchor_return_diff">{{ $t('spread_tool.spread_mode_anchor_return_diff') }}</option>
          </select>
          <span>{{ $t('spread_tool.bollinger_params_label') }}</span>
          <input type="number" v-model.number="bollPeriod" min="2" max="100" class="w-16 p-1 border rounded-md">
          <span>{{ $t('spread_tool.bollinger_std_dev_label') }}</span>
          <input type="number" v-model.number="bollStd" min="0.1" max="10" step="0.1" class="w-16 p-1 border rounded-md">
          <span>{{ $t('spread_tool.z_score_line_label') }}</span>
          <input type="number" v-model.number="zScoreLine" min="0.1" max="10" step="0.1" class="w-16 p-1 border rounded-md">
          <span>{{ $t('spread_tool.grid_step_points_label') }}</span>
          <input type="number" v-model.number="gridStepPoints" min="0.0001" max="1" step="0.0001" class="w-20 p-1 border rounded-md">
          <span>{{ $t('spread_tool.close_z_threshold_label') }}</span>
          <input type="number" v-model.number="closeZThreshold" min="0" max="2" step="0.01" class="w-20 p-1 border rounded-md">
          <span>{{ $t('spread_tool.max_grid_levels_label') }}</span>
          <input type="number" v-model.number="maxGridLevelsVis" min="1" max="12" step="1" class="w-16 p-1 border rounded-md">
          <button
            @click="applyChartParams"
            type="button"
            class="px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {{ $t('spread_tool.apply_params') }}
          </button>
        </div>
      </div>
      <div v-if="error" class="error-message">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import NavBar from '../components/NavBar.vue';
import ApexKLineChartDualAxis from '../components/ApexKLineChartDualAxis.vue';
import { getKlineData, getAllForexMetadata, getMarketInstruments } from '../api';
import { useExchangeStore } from '../stores/exchange';
import { useSubscriptionStore } from '../stores/subscription';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const exchangeStore = useExchangeStore();
const subscriptionStore = useSubscriptionStore();

const loading = ref(false);
const error = ref('');
const chartData = ref({ leg1: [], leg2: [], aligned: [], spread: [] });
const bollingerChartSeries = ref([]);
const zScoreChartSeries = ref([]);

const bollPeriod = ref(20);
const bollStd = ref(2.0);
const zScoreLine = ref(2.0);
const spreadMode = ref('anchor_return_diff');
const gridStepPoints = ref(0.01);
const closeZThreshold = ref(0.0);
const maxGridLevelsVis = ref(6);

const assetTypes = [
  { type: 'CRYPTO', label: 'subscriptions.asset_type_crypto', disabled: false },
  { type: 'FOREX', label: 'subscriptions.asset_type_forex', disabled: false },
  { type: 'NIKKEI', label: 'subscriptions.asset_type_nikkei', disabled: true },
  { type: 'US_STOCK', label: 'subscriptions.asset_type_us_stock', disabled: true },
];
const activeAssetTypeTab = ref('CRYPTO');

const form = ref({
  leg1: { symbol: '', exchange: 'okx' },
  leg2: { symbol: '', exchange: 'okx' },
  timeframe: '1h',
  exchange: 'okx',
  startTime: '',
  endTime: '',
});

const timeframeOptions = computed(() => {
  if (activeAssetTypeTab.value === 'FOREX') {
    return [
      { value: '5m', label: '5m' }, { value: '15m', label: '15m' },
      { value: '30m', label: '30m' }, { value: '1h', label: '1h' }, { value: '1d', label: '1d' }
    ];
  }
  return [
    { value: '1m', label: '1m' }, { value: '3m', label: '3m' }, { value: '5m', label: '5m' },
    { value: '15m', label: '15m' }, { value: '30m', label: '30m' }, { value: '1H', label: '1H' },
    { value: '2H', label: '2H' }, { value: '4H', label: '4H' }, { value: '6H', label: '6H' },
    { value: '12H', label: '12H' }, { value: '1D', label: '1D' }
  ];
});

const allSymbols = ref([]);
const filteredSymbols = ref({ leg1: [], leg2: [] });
const showDropdown = ref({ leg1: false, leg2: false });

watch(activeAssetTypeTab, (newVal) => {
  const isCrypto = newVal === 'CRYPTO';
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
  const today = new Date();

  form.value = {
    leg1: { symbol: '', exchange: isCrypto ? 'okx' : 'fxcm' },
    leg2: { symbol: '', exchange: isCrypto ? 'okx' : 'fxcm' },
    timeframe: '1h',
    exchange: isCrypto ? 'okx' : 'fxcm',
    startTime: sixMonthsAgo.toISOString().split('T')[0],
    endTime: today.toISOString().split('T')[0],
  };
  chartData.value = { leg1: [], leg2: [], aligned: [], spread: [] };
  bollingerChartSeries.value = [];
  zScoreChartSeries.value = [];
  error.value = '';
  loadSymbols();
}, { immediate: true });

watch(() => form.value.exchange, (newEx) => {
  if (activeAssetTypeTab.value === 'CRYPTO') {
    form.value.leg1.exchange = newEx;
    form.value.leg2.exchange = newEx;
    loadSymbols();
  }
});

async function loadSymbols() {
  try {
    loading.value = true;
    if (activeAssetTypeTab.value === 'CRYPTO') {
      // Prefer full exchange instruments for better UX (not only user's subscriptions).
      let loaded = [];
      try {
        const instruments = await getMarketInstruments('SWAP', form.value.exchange);
        loaded = (Array.isArray(instruments) ? instruments : [])
          .map(item => item?.instId || item?.symbol || '')
          .filter(Boolean);
      } catch (e) {
        // Fallback to subscription list when instrument API is unavailable.
      }

      if (!loaded.length) {
        await subscriptionStore.fetchSubscriptions(form.value.exchange);
        const cryptoSubs = subscriptionStore.subscriptions.filter(s => (s.assetType || 'CRYPTO') === 'CRYPTO');
        loaded = cryptoSubs.map(s => s.symbol).filter(Boolean);
      }

      const symbols = new Set(loaded);
      allSymbols.value = Array.from(symbols).map(s => ({ key: s, display: s }));
    } else {
      const response = await getAllForexMetadata();
      allSymbols.value = response.map(d => ({ key: d.symbol, display: `${d.symbol} (${d.description})` }));
    }
    // Seed dropdown candidates so focus can display immediately.
    filteredSymbols.value.leg1 = allSymbols.value;
    filteredSymbols.value.leg2 = allSymbols.value;
  } catch(e) {
    error.value = t('spread_tool.error_fetch_instruments');
    allSymbols.value = [];
    filteredSymbols.value.leg1 = [];
    filteredSymbols.value.leg2 = [];
  } finally {
    loading.value = false;
  }
}

function onInput(leg) {
  showDropdown.value[leg] = true;
  const search = form.value[leg].symbol.toLowerCase();
  if (!search) {
    filteredSymbols.value[leg] = allSymbols.value;
    return;
  }
  filteredSymbols.value[leg] = allSymbols.value.filter(item =>
    item.display.toLowerCase().includes(search)
  );
}

function onBlur(leg) {
  setTimeout(() => { showDropdown.value[leg] = false }, 200);
}

function select(leg, item) {
  form.value[leg].symbol = item.key;
  showDropdown.value[leg] = false;
}

function updateCalculationsAndSeries() {
    if (chartData.value.aligned.length > 0) {
        chartData.value.spread = computeSpreadSeries(chartData.value.aligned, spreadMode.value);
    }
    if (chartData.value.spread.length === 0) {
        bollingerChartSeries.value = [];
        zScoreChartSeries.value = [];
        return;
    }

    const spreadValues = chartData.value.spread.map(item => item[1]);
    const times = chartData.value.spread.map(item => item[0]);
    const period = bollPeriod.value;
    const stdMul = bollStd.value;
    const zLine = Math.max(0.1, Number(zScoreLine.value) || 2.0);

    const bollMiddleData = [];
    const bollUpperData = [];
    const bollLowerData = [];
    const zScoreData = [];
    const zUpperLineData = [];
    const zLowerLineData = [];

    for (let i = 0; i < spreadValues.length; i++) {
        if (i < period - 1) {
            bollMiddleData.push([times[i], null]);
            bollUpperData.push([times[i], null]);
            bollLowerData.push([times[i], null]);
            zScoreData.push([times[i], null]);
            zUpperLineData.push([times[i], null]);
            zLowerLineData.push([times[i], null]);
            continue;
        }
        const slice = spreadValues.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (period - 1);
        const std = Math.sqrt(variance);

        bollMiddleData.push([times[i], mean]);
        bollUpperData.push([times[i], mean + std * stdMul]);
        bollLowerData.push([times[i], mean - std * stdMul]);

        zScoreData.push([
            times[i],
            std !== 0 ? (spreadValues[i] - mean) / std : 0
        ]);
        zUpperLineData.push([times[i], zLine]);
        zLowerLineData.push([times[i], -zLine]);
    }

    const overlay = buildGridOverlay(
      chartData.value.spread,
      zScoreData,
      zLine,
      Math.max(0.0001, Number(gridStepPoints.value) || 0.01),
      Math.max(0.0, Number(closeZThreshold.value) || 0.0),
      Math.max(1, Math.floor(Number(maxGridLevelsVis.value) || 6))
    );

    bollingerChartSeries.value = [
        { name: 'Spread', type: 'line', data: chartData.value.spread, yaxis: 'spread' },
        { name: 'Mean', type: 'line', data: bollMiddleData, yaxis: 'spread' },
        { name: 'Upper Band', type: 'line', data: bollUpperData, yaxis: 'spread' },
        { name: 'Lower Band', type: 'line', data: bollLowerData, yaxis: 'spread' },
        ...overlay.gridLineSeries,
        ...overlay.eventSeries
    ];

    zScoreChartSeries.value = [
        { name: 'Spread', type: 'line', data: chartData.value.spread, yaxis: 'spread' },
        { name: 'Z Score', type: 'line', data: zScoreData, yaxis: 'zscore' },
        { name: 'Z Upper Line', type: 'line', data: zUpperLineData, yaxis: 'zscore' },
        { name: 'Z Lower Line', type: 'line', data: zLowerLineData, yaxis: 'zscore' },
        ...overlay.gridLineSeries,
        ...overlay.eventSeries
    ];
}

function buildGridOverlay(spreadSeries, zScoreSeries, zLine, stepPoints, closeZ, maxLevels) {
  const openPoints = [];
  const addPoints = [];
  const closePoints = [];
  const nextAddLine = [];
  const gridLevels = Array.from({ length: maxLevels }, (_, i) => ({
    name: `Grid L${i + 1}`,
    data: [],
  }));

  let active = false;
  let direction = 0; // 1 short-spread, -1 long-spread
  let entrySpread = 0;
  let lastAddSpread = 0;
  let levels = 0;

  for (let i = 0; i < spreadSeries.length; i++) {
    const ts = spreadSeries[i][0];
    const spread = spreadSeries[i][1];
    const z = zScoreSeries[i]?.[1];
    if (!Number.isFinite(spread) || !Number.isFinite(z)) {
      nextAddLine.push([ts, null]);
      for (const g of gridLevels) g.data.push([ts, null]);
      continue;
    }

    if (!active) {
      if (z >= zLine || z <= -zLine) {
        active = true;
        direction = z >= zLine ? 1 : -1;
        entrySpread = spread;
        lastAddSpread = spread;
        levels = 1;
        openPoints.push([ts, spread]);
      }
    } else {
      const shouldClose = direction === 1 ? z <= closeZ : z >= -closeZ;
      if (shouldClose) {
        closePoints.push([ts, spread]);
        active = false;
        direction = 0;
        levels = 0;
      } else {
        const nextTrigger = direction === 1 ? lastAddSpread + stepPoints : lastAddSpread - stepPoints;
        const hitAdd = levels < maxLevels &&
          (direction === 1 ? spread >= nextTrigger : spread <= nextTrigger);
        if (hitAdd) {
          levels += 1;
          lastAddSpread = spread;
          addPoints.push([ts, spread]);
        }
      }
    }

    if (active) {
      nextAddLine.push([ts, direction === 1 ? lastAddSpread + stepPoints : lastAddSpread - stepPoints]);
      for (let lv = 0; lv < maxLevels; lv++) {
        const levelValue = direction === 1
          ? entrySpread + lv * stepPoints
          : entrySpread - lv * stepPoints;
        gridLevels[lv].data.push([ts, levelValue]);
      }
    } else {
      nextAddLine.push([ts, null]);
      for (const g of gridLevels) g.data.push([ts, null]);
    }
  }

  const gridLineSeries = [
    ...gridLevels.map(g => ({ name: g.name, type: 'line', data: g.data, yaxis: 'spread' })),
    { name: 'Next Add Trigger', type: 'line', data: nextAddLine, yaxis: 'spread' }
  ];

  const eventSeries = [
    { name: 'OPEN', type: 'scatter', data: openPoints, yaxis: 'spread' },
    { name: 'ADD', type: 'scatter', data: addPoints, yaxis: 'spread' },
    { name: 'CLOSE', type: 'scatter', data: closePoints, yaxis: 'spread' },
  ];

  return { gridLineSeries, eventSeries };
}

function computeSpreadSeries(alignedRows, mode) {
  if (!Array.isArray(alignedRows) || alignedRows.length === 0) return [];
  if (mode === 'anchor_return_diff') {
    const a0 = alignedRows[0]?.a;
    const b0 = alignedRows[0]?.b;
    if (!(a0 > 0) || !(b0 > 0)) return [];
    return alignedRows.map(row => {
      const retA = row.a / a0 - 1.0;
      const retB = row.b / b0 - 1.0;
      return [row.ts, retA - retB];
    });
  }
  // Legacy ratio mode: A/B - 1
  return alignedRows.map(row => [row.ts, row.b !== 0 ? (row.a / row.b) - 1.0 : 0.0]);
}

async function fetchData() {
  if (!form.value.leg1.symbol || !form.value.leg2.symbol || !form.value.timeframe) {
    error.value = t('spread_tool.form_incomplete_error');
    return;
  }
  loading.value = true;
  error.value = '';
  chartData.value = { leg1: [], leg2: [], aligned: [], spread: [] };
  bollingerChartSeries.value = [];
  zScoreChartSeries.value = [];

  try {
    let startTime, endTime;

    if (activeAssetTypeTab.value === 'FOREX') {
      if (!form.value.startTime || !form.value.endTime) {
        error.value = t('spread_tool.time_range_incomplete_error');
        loading.value = false;
        return;
      }
      startTime = new Date(form.value.startTime).getTime();
      endTime = new Date(form.value.endTime).getTime();
    } else {
      const now = Date.now();
      startTime = now - 3600 * 1000 * 24 * 180; // 180 days ago for crypto
      endTime = now;
    }

    const [kline1Res, kline2Res] = await Promise.all([
      getKlineData(form.value.leg1.symbol, form.value.timeframe, startTime, endTime, form.value.leg1.exchange, activeAssetTypeTab.value),
      getKlineData(form.value.leg2.symbol, form.value.timeframe, startTime, endTime, form.value.leg2.exchange, activeAssetTypeTab.value)
    ]);

    if (!kline1Res || !kline2Res || kline1Res.length === 0 || kline2Res.length === 0) {
      error.value = t('spread_tool.error_no_data');
      return;
    }

    const data1 = kline1Res.map(d => ({ x: new Date(d.timestamp).getTime(), y: d.closePrice }));
    const data2 = kline2Res.map(d => ({ x: new Date(d.timestamp).getTime(), y: d.closePrice }));

    const priceMap2 = new Map(data2.map(item => [item.x, item.y]));
    
    const alignedData = [];
    for (const item1 of data1) {
      if (priceMap2.has(item1.x)) {
        alignedData.push({
          ts: item1.x,
          a: item1.y,
          b: priceMap2.get(item1.x),
        });
      }
    }

    const spreadData = computeSpreadSeries(alignedData, spreadMode.value);

    chartData.value = {
        leg1: data1.sort((a,b) => a.x - b.x),
        leg2: data2.sort((a,b) => a.x - b.x),
        aligned: alignedData.sort((a,b) => a.ts - b.ts),
        spread: spreadData.sort((a,b) => a[0] - b[0])
    };

    updateCalculationsAndSeries();

  } catch (e) {
    console.error('Data fetching failed:', e);
    error.value = t('spread_tool.error_fetch_data', { error: e.message });
  } finally {
    loading.value = false;
  }
}

function applyChartParams() {
  updateCalculationsAndSeries();
}
</script>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f7fafc;
}
.content-container {
  flex-grow: 1;
  padding: 2rem;
  overflow-y: auto;
}
.form-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-group {
  position: relative;
}
.chart-container {
  margin-top: 2rem;
  padding: 1rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}
.controls-container {
  margin-top: 1rem;
}
.tabs {
  display: flex;
  margin-bottom: 1rem;
  border-bottom: 1px solid #ccc;
}
.tab-button {
  padding: 10px 20px;
  cursor: pointer;
  border: none;
  background-color: transparent;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}
.tab-button.active {
  border-bottom: 2px solid #007bff;
  font-weight: bold;
  color: #007bff;
}
.tab-button.disabled {
  cursor: not-allowed;
  color: #aaa;
}
.error-message {
  color: red;
  margin-top: 1rem;
}
.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background-color: white;
  border: 1px solid #ccc;
  border-top: none;
  max-height: 200px;
  overflow-y: auto;
  list-style-type: none;
  padding: 0;
  margin: 0;
}
.dropdown-list li {
  padding: 10px 14px;
  cursor: pointer;
}
.dropdown-list li:hover {
  background-color: #f0f0f0;
}
</style> 