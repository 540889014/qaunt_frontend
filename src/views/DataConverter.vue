<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">{{ $t('data_converter.title') }}</h1>
    </div>

    <div class="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.asset_type') }}</label>
          <n-select v-model:value="assetType" :options="assetTypeOptions" class="w-full" @update:value="onAssetTypeChange" />
        </div>
        <div v-if="assetType === 'CRYPTO'">
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('subscriptions.exchange') }}</label>
          <n-select v-model:value="exchange" :options="exchangeOptions" class="w-full" @update:value="fetchContracts" />
        </div>
        <div v-if="assetType === 'CRYPTO'">
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.contract_type') }}</label>
          <n-select v-model:value="instType" :options="instTypeOptions" class="w-full" @update:value="fetchContracts" />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700">{{ $t('data_converter.contract_pool') }}</label>
          <span class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{{ $t('pairs_scanner.symbol_count', { n: selectedSymbols.length }) }}</span>
            <n-button
              v-if="contractOptions.length > 0"
              size="small"
              quaternary
              type="primary"
              @click="selectAllContracts"
            >
              {{ $t('subscriptions.select_all') }}
            </n-button>
          </span>
        </div>
        <n-select
          v-model:value="selectedSymbols"
          multiple
          filterable
          :options="contractOptions"
          :placeholder="$t('data_converter.select_contracts')"
          :disabled="assetType === 'CRYPTO' && (!exchange || !instType)"
        />
      </div>

      <div v-if="assetType === 'CRYPTO'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('data_converter.timeframe_kline') }}</label>
          <n-select v-model:value="timeframe" :options="timeframeOptions" class="w-full" />
        </div>
      </div>

      <div class="flex flex-wrap gap-4 pt-4">
        <n-button
          type="primary"
          :loading="klineLoading"
          :disabled="!canConvert"
          @click="convertKline"
        >
          {{ klineLoading ? $t('data_converter.converting_kline') : $t('data_converter.convert_kline') }}
        </n-button>
        <n-button
          type="info"
          :loading="depthLoading"
          :disabled="!canConvert"
          @click="convertDepth"
        >
          {{ depthLoading ? $t('data_converter.converting_depth') : $t('data_converter.convert_depth') }}
        </n-button>
      </div>
    </div>

    <div v-if="error" class="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded">
      {{ error }}
    </div>

    <div v-if="klineResults.length > 0" class="mt-6 bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('data_converter.kline_results') }}</h2>
      <ul class="space-y-2 text-sm">
        <li v-for="r in klineResults" :key="r.symbol" :class="r.success ? 'text-green-700' : 'text-red-700'">
          {{ r.symbol }}: {{ r.message }}
        </li>
      </ul>
    </div>

    <div v-if="depthResults.length > 0" class="mt-6 bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('data_converter.depth_results') }}</h2>
      <ul class="space-y-2 text-sm">
        <li v-for="r in depthResults" :key="r.symbol" :class="r.success ? 'text-green-700' : 'text-red-700'">
          {{ r.symbol }}: {{ r.message }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessage, NButton, NSelect } from 'naive-ui';
import NavBar from '@/components/NavBar.vue';
import { convertKlineData, convertDepthData, getMarketInstruments, getAllForexMetadata } from '@/api';

const message = useMessage();
const { t } = useI18n();

const assetTypeOptions = computed(() => [
  { label: t('subscriptions.asset_type_crypto'), value: 'CRYPTO' },
  { label: t('subscriptions.asset_type_forex'), value: 'FOREX' },
  { label: t('subscriptions.asset_type_nikkei'), value: 'NIKKEI', disabled: true },
  { label: t('subscriptions.asset_type_us_stock'), value: 'US_STOCK', disabled: true },
]);

const exchangeOptions = [
  { label: 'OKX', value: 'okx' },
  { label: 'Binance', value: 'binance' },
];

const instTypeOptions = computed(() => [
  { label: t('subscriptions.spot'), value: 'SPOT' },
  { label: t('subscriptions.swap'), value: 'SWAP' },
  { label: t('subscriptions.futures'), value: 'FUTURES' },
]);

const timeframeOptions = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1H' },
  { label: '4H', value: '4H' },
  { label: '1D', value: '1D' },
];

const assetType = ref('CRYPTO');
const exchange = ref('okx');
const instType = ref('SWAP');
const timeframe = ref('15m');
const allInstruments = ref([]);
const allForexPairs = ref([]);
const selectedSymbols = ref([]);
const error = ref('');
const klineLoading = ref(false);
const depthLoading = ref(false);
const klineResults = ref([]);
const depthResults = ref([]);

const contractOptions = computed(() => {
  if (assetType.value === 'CRYPTO') {
    return (allInstruments.value || []).map(item => ({ label: item.instId, value: item.instId }));
  }
  if (assetType.value === 'FOREX') {
    return (allForexPairs.value || []).map(item => ({ label: item.symbol, value: item.symbol }));
  }
  return [];
});

const canConvert = computed(() => selectedSymbols.value && selectedSymbols.value.length > 0);

const fetchContracts = async () => {
  selectedSymbols.value = [];
  if (assetType.value === 'CRYPTO') {
    if (!exchange.value || !instType.value) return;
    try {
      const data = await getMarketInstruments(instType.value, exchange.value);
      allInstruments.value = data || [];
    } catch (err) {
      console.error('Failed to fetch instruments:', err);
      allInstruments.value = [];
    }
    allForexPairs.value = [];
  } else if (assetType.value === 'FOREX') {
    try {
      const data = await getAllForexMetadata();
      allForexPairs.value = data || [];
    } catch (err) {
      console.error('Failed to fetch forex pairs:', err);
      allForexPairs.value = [];
    }
    allInstruments.value = [];
  }
};

const onAssetTypeChange = () => {
  selectedSymbols.value = [];
  if (assetType.value === 'FOREX') {
    exchange.value = 'fxcm';
    fetchContracts();
  } else {
    exchange.value = 'okx';
    instType.value = 'SWAP';
    fetchContracts();
  }
};

const selectAllContracts = () => {
  selectedSymbols.value = contractOptions.value.map(o => o.value);
};

const effectiveExchange = () => assetType.value === 'FOREX' ? 'fxcm' : exchange.value;

const convertKline = async () => {
  error.value = '';
  klineResults.value = [];
  if (!selectedSymbols.value?.length) {
    error.value = t('data_converter.errors.select_contracts');
    return;
  }
  klineLoading.value = true;
  try {
    const data = await convertKlineData({
      symbols: selectedSymbols.value,
      timeframe: timeframe.value,
      exchange: effectiveExchange(),
    });
    klineResults.value = data || [];
    const ok = klineResults.value.filter(r => r.success).length;
    message.success(t('data_converter.messages.kline_done', { ok, total: klineResults.value.length }));
  } catch (e) {
    console.error(e);
    error.value = e?.message || String(e);
  } finally {
    klineLoading.value = false;
  }
};

const convertDepth = async () => {
  error.value = '';
  depthResults.value = [];
  if (!selectedSymbols.value?.length) {
    error.value = t('data_converter.errors.select_contracts');
    return;
  }
  depthLoading.value = true;
  try {
    const data = await convertDepthData({
      symbols: selectedSymbols.value,
      exchange: effectiveExchange(),
    });
    depthResults.value = data || [];
    const ok = depthResults.value.filter(r => r.success).length;
    message.success(t('data_converter.messages.depth_done', { ok, total: depthResults.value.length }));
  } catch (e) {
    console.error(e);
    error.value = e?.message || String(e);
  } finally {
    depthLoading.value = false;
  }
};

onMounted(() => {
  fetchContracts();
});
</script>
