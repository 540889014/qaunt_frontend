<template>
  <div class="page-container">
    <NavBar />
    
    <div class="content">
      <div class="header">
        <h1>{{ $t('subscriptions.title') }}</h1>
        <button @click="showAddModal = true" class="btn btn-primary">
          {{ $t('subscriptions.add_new') }}
        </button>
      </div>

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

      <ErrorMessage
        v-if="error"
        :message="error"
        dismissible
        @dismiss="error = ''"
      />

      <LoadingSpinner
        v-if="loading"
        :message="$t('subscriptions.loading')"
        :is-overlay="true"
      />

      <div v-else class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>序号</th>
              <th>{{ $t('subscriptions.product') }}</th>
              <th>{{ $t('subscriptions.exchange') }}</th>
              <th>Depth</th>
              <th v-for="tf in timeframeOptions" :key="`th-${tf.value}`">
                {{ tf.value }}
              </th>
              <th>{{ $t('subscriptions.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(agg, index) in aggregatedList" :key="agg.key">
              <td>{{ index + 1 }}</td>
              <td>{{ agg.symbol }}</td>
              <td>{{ agg.exchange }}</td>
              <td><input type="checkbox" v-model="editedStates[agg.key].depth" /></td>
              <td v-for="tf in timeframeOptions" :key="`cb-${agg.key}-${tf.value}`">
                <input type="checkbox" v-model="editedStates[agg.key].ohlc[tf.value]" />
              </td>
              <td>
                <button @click="saveEdits(agg)" class="btn btn-primary mr-2">{{ $t('subscriptions.save') }}</button>
                <button @click="deleteAllForSymbol(agg)" class="btn btn-danger">{{ $t('subscriptions.delete') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Subscription Modal -->
    <div v-if="showAddModal" class="modal">
      <div class="modal-content">
        <h2>{{ $t('subscriptions.add_modal_title') }}</h2>
        <form @submit.prevent="handleSubmit">
          <div class="form-group" v-if="activeAssetTypeTab === 'CRYPTO'">
            <label for="exchange" class="form-label">{{ $t('subscriptions.exchange') }}</label>
            <select id="exchange" v-model="subscriptionForm.exchange" class="form-input" required>
              <option v-for="exchange in exchangeStore.exchanges" :key="exchange" :value="exchange">
                {{ exchange }}
              </option>
            </select>
          </div>
          <div class="form-group" v-if="activeAssetTypeTab === 'CRYPTO'">
            <label for="instType" class="form-label">{{ $t('subscriptions.asset_type') }}</label>
            <select id="instType" v-model="selectedInstType" class="form-input" required>
              <option v-for="option in instTypeOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <div class="flex items-center justify-between gap-2">
              <label for="symbol" class="form-label">{{ $t('subscriptions.instrument') }}</label>
              <button
                v-if="activeAssetTypeTab === 'CRYPTO' && symbolSelectOptions.length"
                type="button"
                class="btn btn-secondary text-sm"
                @click="selectAllSymbols"
              >
                {{ $t('subscriptions.select_all') }}
              </button>
            </div>
            <n-select
              id="symbol"
              v-model:value="selectedSymbols"
              multiple
              filterable
              :options="symbolSelectOptions"
              :placeholder="$t('subscriptions.instrument_placeholder')"
              :disabled="activeAssetTypeTab === 'CRYPTO' && (!selectedInstType || !subscriptionForm.exchange)"
              class="form-input-select"
            />
          </div>
          <div class="form-group" v-if="activeAssetTypeTab === 'CRYPTO'">
            <label for="dataType" class="form-label">{{ $t('subscriptions.data_type') }}</label>
            <select id="dataType" v-model="selectedDataType" class="form-input" required>
              <option v-for="option in dataTypeOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </option>
            </select>
          </div>
          <div class="form-group" v-if="showTimeframe">
            <label for="timeframe" class="form-label">{{ $t('subscriptions.kline_period_multi') }}</label>
            <n-select
              id="timeframe"
              v-model:value="selectedTimeframes"
              multiple
              :options="timeframeOptions"
              :placeholder="$t('subscriptions.kline_period_placeholder')"
              class="form-input-select"
            />
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn">{{ $t('subscriptions.cancel') }}</button>
            <button type="submit" class="btn btn-primary">{{ $t('subscriptions.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Chart Modal -->
    <div v-if="showChartModal" class="modal">
      <div class="modal-content modal-content-large">
        <h2>{{ $t('subscriptions.chart_modal_title', { symbol: selectedSubscription?.symbol }) }}</h2>
        <div class="chart-container">
          <ApexKLineChart :data="apexKlines" :width="900" :height="400" @pan="onChartPan" />
        </div>
        <div class="modal-actions">
          <button @click="closeChartModal" class="btn">{{ $t('subscriptions.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useExchangeStore } from '@/stores/exchange';
import { 
  getSubscriptionsByUsername, 
  subscribeBatch, 
  unsubscribe, 
  getKlineData, 
  getAllForexMetadata,
  getMarketInstruments 
} from '../api';
import { NSelect } from 'naive-ui';
import NavBar from '../components/NavBar.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import ApexKLineChart from '../components/ApexKLineChart.vue';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const authStore = useAuthStore();
const exchangeStore = useExchangeStore();
const subscriptions = ref([]);
const showAddModal = ref(false);
const showChartModal = ref(false);
const selectedSubscription = ref(null);
const loading = ref(false);
const error = ref('');
const router = useRouter();

const assetTypes = [
  { type: 'CRYPTO', label: 'subscriptions.asset_type_crypto', disabled: false },
  { type: 'FOREX', label: 'subscriptions.asset_type_forex', disabled: false },
  { type: 'NIKKEI', label: 'subscriptions.asset_type_nikkei', disabled: true },
  { type: 'US_STOCK', label: 'subscriptions.asset_type_us_stock', disabled: true },
];

const activeAssetTypeTab = ref('CRYPTO');

const dataTypeOptions = [
  { value: 'ohlc', label: 'subscriptions.kline' },
  { value: 'depth', label: 'subscriptions.depth' }
];
const cryptoTimeframeOptions = [
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1H', label: '1H' },
  { value: '2H', label: '2H' },
  { value: '4H', label: '4H' },
  { value: '6H', label: '6H' },
  { value: '12H', label: '12H' },
  { value: '1D', label: '1D' }
];
const forexTimeframeOptions = [
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1H', label: '1H' },
  { value: '1D', label: '1D' }
];

const timeframeOptions = computed(() => {
  return activeAssetTypeTab.value === 'FOREX' ? forexTimeframeOptions : cryptoTimeframeOptions;
});

const selectedDataType = ref('ohlc');
const selectedTimeframe = ref('1m'); // kept for non-ohlc if needed
const selectedSymbols = ref([]);
const selectedTimeframes = ref(['1m']);

watch(activeAssetTypeTab, (newTab) => {
  selectedSymbols.value = [];
  selectedTimeframes.value = newTab === 'FOREX' ? [forexTimeframeOptions[0].value] : ['1m'];
  if (newTab === 'FOREX') {
    selectedDataType.value = 'ohlc';
    selectedTimeframe.value = forexTimeframeOptions[0].value;
    subscriptionForm.value.exchange = 'fxcm';
  } else {
    selectedDataType.value = 'ohlc';
    selectedTimeframe.value = cryptoTimeframeOptions[0].value;
    subscriptionForm.value.exchange = 'okx';
  }
});

const subscriptionForm = ref({
  symbol: '',
  exchange: 'okx',
  dataType: 'ohlc',
  timeframe: '1m'
});

const showTimeframe = computed(() => selectedDataType.value === 'ohlc');

const instTypeOptions = [
  { value: 'SPOT', label: 'subscriptions.spot' },
  { value: 'FUTURES', label: 'subscriptions.futures' },
  { value: 'SWAP', label: 'subscriptions.swap' }
];

const selectedInstType = ref('SWAP');

const allInstruments = ref([]);
const allForexPairs = ref([]);

const symbolSelectOptions = computed(() => {
  if (activeAssetTypeTab.value === 'CRYPTO') {
    return (allInstruments.value || []).map(item => ({ label: item.instId, value: item.instId }));
  }
  if (activeAssetTypeTab.value === 'FOREX') {
    return (allForexPairs.value || []).map(item => ({ label: item.symbol, value: item.symbol }));
  }
  return [];
});

function selectAllSymbols() {
  selectedSymbols.value = symbolSelectOptions.value.map(o => o.value);
}

const baseURL = import.meta.env.VITE_API_BASE_URL;

const fetchInstruments = async () => {
  if (activeAssetTypeTab.value !== 'CRYPTO') return;
  try {
    const response = await getMarketInstruments(selectedInstType.value, subscriptionForm.value.exchange);
    allInstruments.value = response || [];
  } catch (err) {
    console.error('Failed to fetch instruments:', err);
    allInstruments.value = [];
  }
};

const fetchForexPairs = async () => {
  try {
    const response = await getAllForexMetadata();
    allForexPairs.value = response || [];
  } catch (err) {
    console.error('Failed to fetch forex pairs:', err);
    allForexPairs.value = [];
  }
};

watch([selectedInstType, () => subscriptionForm.value.exchange], () => {
  if (subscriptionForm.value.exchange) {
    fetchInstruments();
  }
});

const fetchSubscriptions = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await getSubscriptionsByUsername(authStore.username);
    subscriptions.value = response || [];
  } catch (err) {
    error.value = t('subscriptions.load_list_fail');
    console.error('Failed to fetch subscriptions:', err);
  } finally {
    loading.value = false;
  }
};

// 使用后端批量订阅接口，一次请求完成所有订阅，避免浏览器 ERR_INSUFFICIENT_RESOURCES
const handleSubmit = async () => {
  const symbols = selectedSymbols.value || [];
  const timeframes = selectedDataType.value === 'ohlc' ? (selectedTimeframes.value || []) : [];

  if (symbols.length === 0) {
    error.value = t('subscriptions.instrument_required');
    return;
  }
  if (selectedDataType.value === 'ohlc' && timeframes.length === 0) {
    error.value = t('subscriptions.timeframe_required');
    return;
  }

  try {
    const assetType = activeAssetTypeTab.value;
    const exchange = assetType === 'FOREX' ? 'fxcm' : subscriptionForm.value.exchange;
    const instType = assetType === 'FOREX' ? assetType : selectedInstType.value;
    const dataType = selectedDataType.value;

    const items = [];
    if (dataType === 'depth') {
      for (const symbol of symbols) {
        items.push({ symbol, timeframe: '' });
      }
    } else {
      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          items.push({ symbol, timeframe });
        }
      }
    }

    await subscribeBatch({
      username: authStore.username,
      dataType,
      instType,
      exchange,
      assetType,
      items,
    });

    closeModal();
    fetchSubscriptions();
  } catch (err) {
    error.value = t('subscriptions.add_fail', { error: err.message || 'unknown error' });
    console.error('Failed to add subscription:', err);
  }
};

const deleteSubscription = async (id) => {
  try {
    const subscription = subscriptions.value.find(s => s.id === id);
    if (!subscription) return;
    
    await unsubscribe(
      authStore.username,
      subscription.symbol,
      subscription.dataType,
      subscription.exchange,
      subscription.timeframe || '',
      subscription.assetType || 'CRYPTO'
    );
    fetchSubscriptions();
  } catch (err) {
    error.value = t('subscriptions.delete_fail', { error: err.message || 'unknown error' });
    console.error('Failed to delete subscription:', err);
  }
};

function getIntervalMs(timeframe) {
  if (!timeframe) return 60 * 1000;
  const match = timeframe.match(/^([0-9]+)([mhd])$/);
  if (!match) return 60 * 1000;
  const num = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;
  return 60 * 1000;
}

const apexKlines = ref([]);
let klinePageStart = null;
let klineLoadingMore = false;

async function fetchKlinesByRange(subscription, start, end, replace = true) {
  loading.value = true;
  klineLoadingMore = true;
  try {
    const response = await getKlineData(subscription.symbol, subscription.timeframe || '1m', start, end);
    const klines = response || [];
    const formatted = klines.map(k => ({
      x: new Date(k.timestamp).getTime(),
      y: [k.openPrice, k.highPrice, k.lowPrice, k.closePrice]
    }));
    const sorted = formatted.sort((a, b) => a.x - b.x);
    if (replace) {
      apexKlines.value = sorted;
    } else {
      apexKlines.value = [...sorted, ...apexKlines.value];
    }
    if (sorted.length > 0) {
      klinePageStart = sorted[0].x;
    }
  } catch (err) {
    error.value = t('subscriptions.load_kline_fail');
    console.error('Failed to fetch klines:', err);
  } finally {
    loading.value = false;
    klineLoadingMore = false;
  }
}

const viewChart = async (subscription) => {
  selectedSubscription.value = subscription;
  showChartModal.value = true;
  try {
    if (subscription.dataType === 'ohlc') {
      const intervalMs = getIntervalMs(subscription.timeframe || '1m');
      const now = Date.now();
      const start = now - intervalMs * 1000;
      await fetchKlinesByRange(subscription, start, now, true);
    } else if (subscription.dataType === 'depth') {
      error.value = t('subscriptions.depth_wip');
    } else if (subscription.dataType === 'realtime') {
      error.value = t('subscriptions.realtime_wip');
    }
  } catch (err) {
    error.value = t('subscriptions.load_data_fail');
    console.error('Failed to fetch data:', err);
  }
};

function onChartPan(e) {
  if (klineLoadingMore) return;
  if (apexKlines.value.length > 0 && e.detail.xaxis.min <= klinePageStart + 60 * 1000) {
    const intervalMs = getIntervalMs(selectedSubscription.value?.timeframe || '1m');
    const prevStart = klinePageStart - intervalMs * 1000;
    fetchKlinesByRange(selectedSubscription.value, prevStart, klinePageStart, false);
  }
}

const closeModal = () => {
  showAddModal.value = false;
  subscriptionForm.value = { symbol: '', exchange: 'okx', dataType: 'ohlc', timeframe: '1m' };
  selectedDataType.value = 'ohlc';
  selectedTimeframe.value = '1m';
  selectedSymbols.value = [];
  selectedTimeframes.value = ['1m'];
};

const closeChartModal = () => {
  showChartModal.value = false;
  selectedSubscription.value = null;
};

const formatDate = (date) => {
  if (!date) return t('subscriptions.none');
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  if (isNaN(d.getTime())) return t('subscriptions.none');
  return d.toLocaleString();
};

onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/');
    return;
  }
  fetchSubscriptions();
  fetchInstruments();
  fetchForexPairs();
});

// ---------- Aggregated view logic ---------- //

const aggregatedList = computed(() => {
  const filteredSubscriptions = subscriptions.value.filter(sub => (sub.assetType || 'CRYPTO') === activeAssetTypeTab.value);
  const aggregationMap = new Map();
  filteredSubscriptions.forEach((sub) => {
    const key = `${sub.symbol}__${sub.exchange}`;
    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        key,
        symbol: sub.symbol,
        exchange: sub.exchange,
        depth: false,
        ohlc: timeframeOptions.value.reduce((acc, tf) => ({ ...acc, [tf.value]: false }), {})
      });
    }
    const agg = aggregationMap.get(key);
    if (sub.dataType === 'depth') {
      agg.depth = true;
    } else if (sub.dataType === 'ohlc' && agg.ohlc.hasOwnProperty(sub.timeframe)) {
      agg.ohlc[sub.timeframe] = true;
    }
  });
  return Array.from(aggregationMap.values());
});

const editedStates = reactive({});

watch(aggregatedList, (newVal) => {
  newVal.forEach(agg => {
    if (!editedStates[agg.key]) {
      editedStates[agg.key] = {
        depth: agg.depth,
        ohlc: { ...agg.ohlc }
      };
    }
  });
}, { immediate: true, deep: true });

async function saveEdits(agg) {
  const state = editedStates[agg.key];
  const original = {
    depth: agg.depth,
    ohlc: { ...agg.ohlc }
  };
  const promises = [];

  const assetType = activeAssetTypeTab.value;
  let instType;
  const exchange = agg.exchange.trim();

  if (assetType === 'FOREX') {
    instType = 'FOREX';
  } else { // CRYPTO
    const existingSub = subscriptions.value.find(s => s.symbol === agg.symbol && s.exchange === agg.exchange);
    instType = existingSub ? existingSub.instType : 'SWAP';
  }

  // Handle depth
  if (state.depth && !original.depth) {
    promises.push(
      subscribe(
        authStore.username,
        agg.symbol,
        'depth',
        instType,
        '',
        exchange,
        assetType
      )
    );
  } else if (!state.depth && original.depth) {
    promises.push(
      unsubscribe(
        authStore.username,
        agg.symbol,
        'depth',
        exchange,
        '',
        assetType
      )
    );
  }
  // Handle ohlc timeframes
  Object.keys(state.ohlc).forEach((tf) => {
    if (state.ohlc[tf] && !original.ohlc[tf]) {
      promises.push(
        subscribe(
          authStore.username,
          agg.symbol,
          'ohlc',
          instType,
          tf,
          exchange,
          assetType
        )
      );
    } else if (!state.ohlc[tf] && original.ohlc[tf]) {
      promises.push(
        unsubscribe(
          authStore.username,
          agg.symbol,
          'ohlc',
          exchange,
          tf,
          assetType
        )
      );
    }
  });
  try {
    loading.value = true;
    await Promise.all(promises);
    await fetchSubscriptions();
  } catch (err) {
    error.value = t('subscriptions.save_fail', { error: err.message || 'unknown error' });
  } finally {
    loading.value = false;
  }
}

const deleteAllForSymbol = async (agg) => {
  const assetType = activeAssetTypeTab.value;
  const promises = subscriptions.value
    .filter(s =>
      s.symbol === agg.symbol &&
      s.exchange === agg.exchange &&
      (s.assetType || 'CRYPTO') === assetType
    )
    .map(s => unsubscribe(
      authStore.username,
      s.symbol,
      s.dataType,
      s.exchange,
      s.timeframe,
      s.assetType || 'CRYPTO'
    ));

  try {
    await Promise.all(promises);
    fetchSubscriptions();
  } catch (err) {
    error.value = t('subscriptions.delete_fail');
    console.error('Failed to delete subscriptions:', err);
  }
};
</script>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.content {
  flex-grow: 1;
  padding: 2rem;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
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

.table-container {
  overflow-x: auto;
}
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
.table th { background-color: #f8f8f8; font-weight: bold; }
.table tbody tr:nth-child(even) { background-color: #f2f2f2; }
.table .btn { margin-right: 0.5rem; }
.btn:last-child { margin-right: 0; }
.chart-container { width: 900px; height: 400px; margin: 0 auto; background: #f8fafd; border-radius: 8px; padding: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
.modal-content-large { max-width: 950px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
.form-group { position: relative; }
.form-input-select { width: 100%; min-height: 38px; }
.btn-secondary { background: #6c757d; color: #fff; border: none; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; }
.btn-secondary:hover { background: #5a6268; }
.dropdown-list { border: 1px solid #d0d7de; max-height: 220px; overflow-y: auto; background: #fff; position: absolute; z-index: 10; width: 100%; border-radius: 0 0 6px 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-top: -2px; padding: 0; list-style: none; }
.dropdown-list li { padding: 10px 14px; cursor: pointer; font-size: 15px; color: #333; transition: background 0.15s; border-bottom: 1px solid #f0f0f0; }
.dropdown-list li:last-child { border-bottom: none; }
.dropdown-list li:hover { background: #e6f7ff; color: #409eff; }
</style>