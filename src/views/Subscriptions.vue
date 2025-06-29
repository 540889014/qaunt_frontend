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
            <tr v-for="agg in aggregatedList" :key="agg.key">
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
          <div class="form-group">
            <label for="exchange" class="form-label">{{ $t('subscriptions.exchange') }}</label>
            <select id="exchange" v-model="subscriptionForm.exchange" class="form-input" required>
              <option v-for="exchange in exchangeStore.exchanges" :key="exchange" :value="exchange">
                {{ exchange }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="instType" class="form-label">{{ $t('subscriptions.asset_type') }}</label>
            <select id="instType" v-model="selectedInstType" class="form-input" required>
              <option v-for="option in instTypeOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="symbol" class="form-label">{{ $t('subscriptions.instrument') }}</label>
            <input
              type="text"
              id="symbol"
              v-model="subscriptionForm.symbol"
              class="form-input"
              @input="onSymbolInput"
              @focus="onSymbolInput"
              autocomplete="off"
              required
              :disabled="!selectedInstType || !subscriptionForm.exchange"
            />
            <ul v-if="showSymbolDropdown && filteredSymbols.length" class="dropdown-list">
              <li v-for="item in filteredSymbols" :key="item.instId" @click="selectSymbol(item)">
                {{ item.instId }}
              </li>
            </ul>
          </div>
          <div class="form-group">
            <label for="dataType" class="form-label">{{ $t('subscriptions.data_type') }}</label>
            <select id="dataType" v-model="selectedDataType" class="form-input" required>
              <option v-for="option in dataTypeOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="timeframe" class="form-label">{{ $t('subscriptions.kline_period') }}</label>
            <select id="timeframe" v-model="selectedTimeframe" class="form-input" v-if="showTimeframe">
              <option v-for="option in timeframeOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </option>
            </select>
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
import { ref, onMounted, onUnmounted, computed, watch, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useExchangeStore } from '@/stores/exchange';
import { getSubscriptionsByUsername, subscribe, unsubscribe, getKlineData } from '../api';
import NavBar from '../components/NavBar.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import ApexKLineChart from '../components/ApexKLineChart.vue';
import axios from 'axios';
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

const dataTypeOptions = [
  { value: 'ohlc', label: 'subscriptions.kline' },
  { value: 'depth', label: 'subscriptions.depth' }
];
const timeframeOptions = [
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
const selectedDataType = ref('ohlc');
const selectedTimeframe = ref('1m');

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
const filteredSymbols = ref([]);
const showSymbolDropdown = ref(false);

const baseURL = import.meta.env.VITE_API_BASE_URL;

const fetchInstruments = async () => {
  try {
    const response = await axios.get(`${baseURL}/api/v1/market/instruments`, {
      params: { instType: selectedInstType.value, exchange: subscriptionForm.value.exchange },
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });
    allInstruments.value = response.data || [];
  } catch (err) {
    console.error('Failed to fetch instruments:', err);
    allInstruments.value = [];
  }
};

watch([selectedInstType, () => subscriptionForm.value.exchange], () => {
  if (selectedInstType.value && subscriptionForm.value.exchange) {
    fetchInstruments();
  }
});

const fetchSubscriptions = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await getSubscriptionsByUsername(authStore.username, exchangeStore.selectedExchange);
    subscriptions.value = response.data || [];
  } catch (err) {
    error.value = t('subscriptions.load_list_fail');
    console.error('Failed to fetch subscriptions:', err);
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  try {
    await subscribe(
      authStore.username,
      subscriptionForm.value.symbol,
      selectedDataType.value,
      selectedInstType.value,
      selectedTimeframe.value,
      subscriptionForm.value.exchange
    );
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
      subscription.exchange
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
    const klines = response.data || [];
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
  if (selectedInstType.value && subscriptionForm.value.exchange) {
    fetchInstruments();
  }
  document.addEventListener('click', handleSymbolClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleSymbolClickOutside);
});

const onSymbolInput = () => {
  showSymbolDropdown.value = true;
  const inputValue = subscriptionForm.value.symbol.toUpperCase();
  filteredSymbols.value = allInstruments.value.filter(item => 
    item.instId.toUpperCase().includes(inputValue)
  ).slice(0, 20);
};

function selectSymbol(item) {
  subscriptionForm.value.symbol = item.instId;
  showSymbolDropdown.value = false;
}

function handleSymbolClickOutside(event) {
  const symbolInputEl = document.getElementById('symbol');
  if (symbolInputEl && !symbolInputEl.contains(event.target)) {
    showSymbolDropdown.value = false;
  }
}

// ---------- Aggregated view logic ---------- //

const aggregatedList = ref([]);
const editedStates = reactive({});

function buildAggregations() {
  const map = {};
  subscriptions.value.forEach((sub) => {
    const key = `${sub.symbol}__${sub.exchange}`;
    if (!map[key]) {
      map[key] = {
        key,
        symbol: sub.symbol,
        exchange: sub.exchange,
        depth: false,
        ohlc: {
          '1m': false,
          '5m': false,
          '15m': false,
          '1h': false,
          '1d': false
        }
      };
    }
    if (sub.dataType === 'depth') map[key].depth = true;
    else if (sub.dataType === 'ohlc') {
      map[key].ohlc[sub.timeframe] = true;
    }
  });
  aggregatedList.value = Object.values(map).sort((a, b) => {
    const symCmp = a.symbol.localeCompare(b.symbol);
    if (symCmp !== 0) return symCmp;
    return a.exchange.localeCompare(b.exchange);
  });
  // initialise edited states to current
  Object.values(map).forEach((agg) => {
    if (!editedStates[agg.key]) {
      editedStates[agg.key] = JSON.parse(JSON.stringify({
        depth: agg.depth,
        ohlc: { ...agg.ohlc }
      }));
    } else {
      // update existing to keep in sync when data refreshes
      Object.assign(editedStates[agg.key], {
        depth: agg.depth
      });
      Object.keys(editedStates[agg.key].ohlc).forEach((tf) => {
        editedStates[agg.key].ohlc[tf] = agg.ohlc[tf];
      });
    }
  });
  // remove states that no longer exist
  Object.keys(editedStates).forEach((k) => {
    if (!map[k]) delete editedStates[k];
  });
}

watch(subscriptions, buildAggregations, { immediate: true });

async function saveEdits(agg) {
  const state = editedStates[agg.key];
  const original = {
    depth: agg.depth,
    ohlc: { ...agg.ohlc }
  };
  const promises = [];
  // Handle depth
  if (state.depth && !original.depth) {
    promises.push(
      subscribe(
        authStore.username,
        agg.symbol,
        'depth',
        selectedInstType.value,
        null,
        agg.exchange
      )
    );
  } else if (!state.depth && original.depth) {
    promises.push(
      unsubscribe(
        authStore.username,
        agg.symbol,
        'depth',
        agg.exchange
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
          selectedInstType.value,
          tf,
          agg.exchange
        )
      );
    } else if (!state.ohlc[tf] && original.ohlc[tf]) {
      promises.push(
        unsubscribe(
          authStore.username,
          agg.symbol,
          'ohlc',
          agg.exchange,
          tf
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

async function deleteAllForSymbol(agg) {
  try {
    loading.value = true;
    const promises = subscriptions.value
      .filter((s) => s.symbol === agg.symbol && s.exchange === agg.exchange)
      .map((s) => unsubscribe(authStore.username, s.symbol, s.dataType, s.exchange, s.timeframe));
    await Promise.all(promises);
    await fetchSubscriptions();
  } catch (err) {
    error.value = t('subscriptions.delete_fail', { error: err.message || 'unknown error' });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.table-container { margin-top: 2rem; }
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
.dropdown-list { border: 1px solid #d0d7de; max-height: 220px; overflow-y: auto; background: #fff; position: absolute; z-index: 10; width: 100%; border-radius: 0 0 6px 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-top: -2px; padding: 0; list-style: none; }
.dropdown-list li { padding: 10px 14px; cursor: pointer; font-size: 15px; color: #333; transition: background 0.15s; border-bottom: 1px solid #f0f0f0; }
.dropdown-list li:last-child { border-bottom: none; }
.dropdown-list li:hover { background: #e6f7ff; color: #409eff; }
</style>