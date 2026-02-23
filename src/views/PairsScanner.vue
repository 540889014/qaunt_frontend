<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">{{ $t('pairs_scanner.title') }}</h1>
      <div class="flex gap-2">
        <n-button type="primary" :loading="loading" @click="runScan">
          {{ loading ? $t('pairs_scanner.scanning') : $t('pairs_scanner.scan') }}
        </n-button>
        <n-button :loading="historyLoading" @click="loadRuns">
          {{ $t('pairs_scanner.history.refresh') }}
        </n-button>
      </div>
    </div>

    <div class="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.timeframe') }}</label>
          <n-select v-model:value="form.timeframe" :options="timeframeOptions" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.lookback_bars') }}</label>
          <n-input-number v-model:value="form.lookbackBars" :min="200" :max="20000" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.top_n') }}</label>
          <n-input-number v-model:value="form.topN" :min="1" :max="500" class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.windows.ols') }}</label>
          <n-input-number v-model:value="form.olsWindowBars" :min="50" :max="20000" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.windows.adf') }}</label>
          <n-input-number v-model:value="form.adfWindowBars" :min="50" :max="20000" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.windows.half_life') }}</label>
          <n-input-number v-model:value="form.halfLifeWindowBars" :min="50" :max="20000" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.windows.z') }}</label>
          <n-input-number v-model:value="form.zWindowBars" :min="50" :max="20000" class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.corr_threshold') }}</label>
          <n-input-number v-model:value="form.correlationThreshold" :min="0" :max="0.9999" :step="0.01" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.adf_t_threshold') }}</label>
          <n-input-number v-model:value="form.adfTThreshold" :step="0.1" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.max_pairs_after_corr') }}</label>
          <n-input-number v-model:value="form.maxPairsAfterCorr" :min="100" :max="20000" class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.adf_p_threshold') }}</label>
          <n-input-number v-model:value="form.adfPThreshold" :min="0" :max="1" :step="0.01" class="w-full" />
        </div>
        <div class="md:col-span-2 flex items-end">
          <div class="text-xs text-gray-500">
            {{ $t('pairs_scanner.adf_p_hint') }}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.half_life_min') }}</label>
          <n-input-number v-model:value="form.minHalfLife" :min="0" :step="1" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('pairs_scanner.half_life_max') }}</label>
          <n-input-number v-model:value="form.maxHalfLife" :min="0" :step="1" class="w-full" />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700">{{ $t('pairs_scanner.symbol_pool') }}</label>
          <span class="text-xs text-gray-500">{{ $t('pairs_scanner.symbol_count', { n: selectedSymbols.length }) }}</span>
        </div>
        <n-select
          v-model:value="selectedSymbols"
          multiple
          filterable
          :options="symbolOptions"
          :placeholder="$t('pairs_scanner.select_symbols')"
        />
        <p class="mt-2 text-xs text-gray-500">{{ $t('pairs_scanner.hint_data_source') }}</p>
      </div>
    </div>

    <div v-if="error" class="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded">
      {{ error }}
    </div>

    <div v-if="response" class="mt-6 bg-white p-6 rounded-lg shadow-md">
      <div class="flex flex-wrap gap-4 text-sm text-gray-700 mb-4">
        <div><span class="font-semibold">{{ $t('pairs_scanner.anchor') }}:</span> {{ response.anchorSymbol }}</div>
        <div><span class="font-semibold">{{ $t('pairs_scanner.points') }}:</span> {{ response.points }}</div>
        <div><span class="font-semibold">{{ $t('pairs_scanner.loaded_symbols') }}:</span> {{ response.params?.loadedSymbols }}</div>
        <div><span class="font-semibold">{{ $t('pairs_scanner.candidates_after_corr') }}:</span> {{ response.params?.candidatesAfterCorr }}</div>
        <div v-if="response.runId"><span class="font-semibold">{{ $t('pairs_scanner.history.run_id') }}:</span> {{ response.runId }}</div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th v-for="h in headers" :key="h" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {{ $t(`pairs_scanner.headers.${h}`) }}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(r, idx) in response.results" :key="idx" class="hover:bg-gray-50">
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.legA }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.legB }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.corr, 4) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.beta, 4) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.alpha, 4) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.adf_t, 4) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.adf_p, 4) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.half_life, 2) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.zero_crossings }}</td>
              <td class="px-4 py-2 text-sm" :class="Number(r.current_z) >= 0 ? 'text-green-700' : 'text-red-700'">{{ fmt(r.current_z, 2) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ fmt(r.score, 4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-6 bg-white p-6 rounded-lg shadow-md">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-700">{{ $t('pairs_scanner.history.title') }}</h2>
      </div>
      <div v-if="runsError" class="text-sm text-red-700 mb-3">{{ runsError }}</div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.history.run_id') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.history.created_at') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.timeframe') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.loaded_symbols') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.candidates_after_corr') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.top_n') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('pairs_scanner.history.duration_ms') }}</th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="r in runs" :key="r.id" class="hover:bg-gray-50">
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.id }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ formatTs(r.createdAt) }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.timeframe }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.loadedSymbols }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.candidatesAfterCorr }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.topN }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">{{ r.durationMs }}</td>
              <td class="px-4 py-2 text-sm text-gray-700">
                <n-button size="small" :loading="historyLoading && selectedRunId === r.id" @click="loadRunResults(r.id)">
                  {{ $t('pairs_scanner.history.view_results') }}
                </n-button>
              </td>
            </tr>
            <tr v-if="runs.length === 0">
              <td class="px-4 py-4 text-sm text-gray-500" colspan="8">{{ $t('pairs_scanner.history.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessage, NButton, NSelect, NInputNumber } from 'naive-ui';
import NavBar from '@/components/NavBar.vue';
import { scanPairs, getPairsScanRuns, getPairsScanRunResults } from '@/api';
import { useSubscriptionStore } from '@/stores/subscription';
import { storeToRefs } from 'pinia';

const message = useMessage();
const { t } = useI18n();
const subscriptionStore = useSubscriptionStore();
const { subscribedSymbols } = storeToRefs(subscriptionStore);

const loading = ref(false);
const error = ref('');
const response = ref(null);

const runs = ref([]);
const runsError = ref('');
const historyLoading = ref(false);
const selectedRunId = ref(null);

const form = reactive({
  timeframe: '1H',
  lookbackBars: 2000,
  olsWindowBars: 1000,
  adfWindowBars: 1000,
  halfLifeWindowBars: 1000,
  zWindowBars: 500,
  correlationThreshold: 0.8,
  adfTThreshold: -3.0,
  adfPThreshold: 0.05,
  minHalfLife: 10,
  maxHalfLife: 200,
  topN: 50,
  maxPairsAfterCorr: 3000,
});

const selectedSymbols = ref([]);

const timeframeOptions = [
  { label: '15m', value: '15m' },
  { label: '1H', value: '1H' },
  { label: '4H', value: '4H' },
  { label: '1D', value: '1D' },
];

const symbolOptions = computed(() => {
  const list = Array.isArray(subscribedSymbols.value) ? subscribedSymbols.value : [];
  return list.map(s => ({ label: s, value: s }));
});

const headers = [
  'legA', 'legB', 'corr', 'beta', 'alpha', 'adf_t', 'adf_p', 'half_life', 'zero_crossings', 'current_z', 'score'
];

const fmt = (v, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'N/A';
  return n.toFixed(digits);
};

const runScan = async () => {
  error.value = '';
  response.value = null;

  const symbols = selectedSymbols.value;
  if (!symbols || symbols.length < 2) {
    error.value = t('pairs_scanner.errors.min_symbols');
    return;
  }

  loading.value = true;
  try {
    const payload = {
      symbols,
      ...form,
      persist: true,
    };
    const res = await scanPairs(payload);
    response.value = res;
    message.success(t('pairs_scanner.messages.scan_finished'));
  } catch (e) {
    console.error(e);
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
};

const formatTs = (ts) => {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return 'N/A';
  return new Date(n).toLocaleString();
};

const loadRuns = async () => {
  runsError.value = '';
  historyLoading.value = true;
  try {
    const res = await getPairsScanRuns(form.timeframe, 20);
    runs.value = Array.isArray(res) ? res : [];
  } catch (e) {
    console.error(e);
    runsError.value = e?.message || String(e);
    runs.value = [];
  } finally {
    historyLoading.value = false;
  }
};

const loadRunResults = async (runId) => {
  selectedRunId.value = runId;
  historyLoading.value = true;
  try {
    const rows = await getPairsScanRunResults(runId, 200);
    response.value = {
      runId,
      timeframe: form.timeframe,
      anchorSymbol: '',
      points: 0,
      params: {},
      results: Array.isArray(rows) ? rows : [],
    };
    message.success(t('pairs_scanner.history.loaded'));
  } catch (e) {
    console.error(e);
    runsError.value = e?.message || String(e);
  } finally {
    historyLoading.value = false;
  }
};

onMounted(async () => {
  // default exchange is okx elsewhere; subscription store expects exchange param
  await subscriptionStore.fetchSubscriptions('okx');
  // preselect a subset if too many
  const list = Array.isArray(subscribedSymbols.value) ? subscribedSymbols.value : [];
  selectedSymbols.value = list.slice(0, Math.min(50, list.length));
  await loadRuns();
});
</script>

