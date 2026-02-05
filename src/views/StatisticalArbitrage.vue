<template>
  <div class="statistical-arbitrage-container h-full overflow-auto bg-gray-50">
    <NavBar />
    <div class="mx-auto p-6 max-w-4xl">
      <div class="mb-6 flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-800">{{ $t('statistical_arbitrage.title') }}</h1>
        <button @click="refreshResults" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">{{ $t('statistical_arbitrage.refresh') }}</button>
      </div>
      <div class="mb-6 flex justify-between items-center">
        <div class="flex space-x-4 items-center">
          <div class="w-48">
            <label for="exchange" class="block text-sm font-medium text-gray-700 mb-1">{{ $t('statistical_arbitrage.exchange') }}</label>
            <select id="exchange" v-model="selectedExchange" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 bg-white">
              <option v-for="option in exchanges" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
          <div class="w-48">
            <label for="timeframe" class="block text-sm font-medium text-gray-700 mb-1">{{ $t('statistical_arbitrage.timeframe') }}</label>
            <select id="timeframe" v-model="selectedTimeframe" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 bg-white">
              <option value="1m">1m</option>
              <option value="3m">3m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
              <option value="1H">1H</option>
              <option value="2H">2H</option>
              <option value="4H">4H</option>
              <option value="6H">6H</option>
              <option value="12H">12H</option>
              <option value="1D">1D</option>
            </select>
          </div>
        </div>
        <button @click="recalculateIndices" :disabled="loading" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400">
          <span v-if="loading">{{ $t('statistical_arbitrage.updating') }}</span>
          <span v-else>{{ $t('statistical_arbitrage.update_indicators') }}</span>
        </button>
      </div>
      <div v-if="loading" class="text-center">
        <p>Loading...</p>
      </div>
      <div v-else class="flex flex-col gap-6">
        <!-- ADF Results -->
        <div class="bg-white p-6 rounded-lg shadow-md">
          <div @click="toggleVisibility('adf')" class="cursor-pointer flex justify-between items-center">
            <h2 class="text-xl font-semibold text-gray-700">{{ $t('statistical_arbitrage.adf_results') }}</h2>
            <svg class="w-6 h-6 transform transition-transform" :class="{ 'rotate-180': !isAdfVisible }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <table v-if="isAdfVisible" class="min-w-full divide-y divide-gray-200 mt-4">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('statistical_arbitrage.pair') }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('statistical_arbitrage.test_type') }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="sortResults('adf')">{{ $t('statistical_arbitrage.value') }} {{ adfSortDirection === 'asc' ? '↑' : adfSortDirection === 'desc' ? '↓' : '' }}</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="result in adfResults" :key="result.pair">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ result.pair }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ result.test }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span v-if="typeof result.value === 'number'">{{ result.value.toFixed(2) }}</span>
                  <span v-else>N/A</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- KPSS Results -->
        <div class="bg-white p-6 rounded-lg shadow-md">
           <div @click="toggleVisibility('kpss')" class="cursor-pointer flex justify-between items-center">
            <h2 class="text-xl font-semibold text-gray-700">{{ $t('statistical_arbitrage.kpss_results') }}</h2>
            <svg class="w-6 h-6 transform transition-transform" :class="{ 'rotate-180': !isKpssVisible }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <table v-if="isKpssVisible" class="min-w-full divide-y divide-gray-200 mt-4">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('statistical_arbitrage.pair') }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('statistical_arbitrage.test_type') }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="sortResults('kpss')">{{ $t('statistical_arbitrage.value') }} {{ kpssSortDirection === 'asc' ? '↑' : kpssSortDirection === 'desc' ? '↓' : '' }}</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="result in kpssResults" :key="result.pair">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ result.pair }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ result.test }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span v-if="typeof result.value === 'number'">{{ result.value.toFixed(2) }}</span>
                  <span v-else>N/A</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Hurst Results -->
        <div class="bg-white p-6 rounded-lg shadow-md">
          <div @click="toggleVisibility('hurst')" class="cursor-pointer flex justify-between items-center">
            <h2 class="text-xl font-semibold text-gray-700">{{ $t('statistical_arbitrage.hurst_results') }}</h2>
            <svg class="w-6 h-6 transform transition-transform" :class="{ 'rotate-180': !isHurstVisible }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <table v-if="isHurstVisible" class="min-w-full divide-y divide-gray-200 mt-4">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('statistical_arbitrage.pair') }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('statistical_arbitrage.test_type') }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" @click="sortResults('hurst')">{{ $t('statistical_arbitrage.value') }} {{ hurstSortDirection === 'asc' ? '↑' : hurstSortDirection === 'desc' ? '↓' : '' }}</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="result in hurstResults" :key="result.pair">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ result.pair }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ result.test }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span v-if="typeof result.value === 'number'">{{ result.value.toFixed(2) }}</span>
                  <span v-else>N/A</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import NavBar from '@/components/NavBar.vue';
import { 
  getAdfTestResults, 
  getKpssTestResults, 
  getHurstExponentResults, 
  recalculateStatisticalArbitrage 
} from '@/api';

const { t } = useI18n();

const adfResults = ref([]);
const kpssResults = ref([]);
const hurstResults = ref([]);
const adfSortDirection = ref('');
const kpssSortDirection = ref('');
const hurstSortDirection = ref('');
const selectedExchange = ref('okx');
const selectedTimeframe = ref('1h');
const exchanges = ref(['okx', 'binance']);
const isAdfVisible = ref(true);
const isKpssVisible = ref(true);
const isHurstVisible = ref(true);
const loading = ref(false);

const toggleVisibility = (type) => {
  if (type === 'adf') isAdfVisible.value = !isAdfVisible.value;
  else if (type === 'kpss') isKpssVisible.value = !isKpssVisible.value;
  else if (type === 'hurst') isHurstVisible.value = !isHurstVisible.value;
};

const fetchResults = async () => {
  loading.value = true;
  const exchange = selectedExchange.value;
  const timeframe = selectedTimeframe.value;

  try {
    const [adfRes, kpssRes, hurstRes] = await Promise.all([
      getAdfTestResults(timeframe, exchange),
      getKpssTestResults(timeframe, exchange),
      getHurstExponentResults(timeframe, exchange)
    ]);
    adfResults.value = adfRes || [];
    kpssResults.value = kpssRes || [];
    hurstResults.value = hurstRes || [];
  } catch (error) {
    console.error('Error fetching statistical arbitrage results:', error);
    adfResults.value = [];
    kpssResults.value = [];
    hurstResults.value = [];
  } finally {
    loading.value = false;
  }
};

const refreshResults = () => {
  fetchResults();
};

const recalculateIndices = async () => {
  loading.value = true;
  try {
    await recalculateStatisticalArbitrage(selectedTimeframe.value, selectedExchange.value);
    await fetchResults();
  } catch (error) {
    console.error('Error recalculating indices:', error);
  } finally {
    loading.value = false;
  }
};

const sortResults = (type) => {
  let results, directionRef;

  if (type === 'adf') {
    results = adfResults.value;
    directionRef = adfSortDirection;
  } else if (type === 'kpss') {
    results = kpssResults.value;
    directionRef = kpssSortDirection;
  } else if (type === 'hurst') {
    results = hurstResults.value;
    directionRef = hurstSortDirection;
  } else {
    return;
  }

  directionRef.value = directionRef.value === 'asc' ? 'desc' : 'asc';
  const sortAsc = directionRef.value === 'asc';

  results.sort((a, b) => {
    const valA = a.value ?? -Infinity;
    const valB = b.value ?? -Infinity;
    return sortAsc ? valA - valB : valB - valA;
  });
};

onMounted(() => {
  fetchResults();
});

watch([selectedExchange, selectedTimeframe], () => {
  fetchResults();
});
</script>

<style scoped>
/* 移除 @apply 指令，直接在模板中使用 Tailwind CSS 类名 */
</style> 