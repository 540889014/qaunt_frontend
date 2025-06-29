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
        <button @click="recalculateIndices" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">{{ $t('statistical_arbitrage.update_indicators') }}</button>
      </div>
      <div class="flex flex-col gap-6">
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 text-gray-700">{{ $t('statistical_arbitrage.adf_results') }}</h2>
          <table class="min-w-full divide-y divide-gray-200">
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
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 text-gray-700">{{ $t('statistical_arbitrage.kpss_results') }}</h2>
          <table class="min-w-full divide-y divide-gray-200">
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
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 text-gray-700">{{ $t('statistical_arbitrage.hurst_results') }}</h2>
          <table class="min-w-full divide-y divide-gray-200">
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

<script>
import NavBar from '@/components/NavBar.vue'
import axios from 'axios'

export default {
  name: 'StatisticalArbitrage',
  components: {
    NavBar
  },
  data() {
    return {
      adfResults: [],
      kpssResults: [],
      hurstResults: [],
      adfSortDirection: '',
      kpssSortDirection: '',
      hurstSortDirection: '',
      selectedExchange: 'okx',
      selectedTimeframe: '1h',
      exchanges: []
    }
  },
  created() {
    this.fetchExchanges()
    this.fetchResults()
  },
  methods: {
    getAuthToken() {
      const token = localStorage.getItem('token') || ''
      console.log('Retrieved auth token from localStorage:', token)
      return token
    },
    fetchExchanges() {
      const exchanges = [
        'okx',
        'binance'
      ]
      this.exchanges = exchanges
      this.selectedExchange = exchanges[0]
    },
    fetchResults() {
      const token = this.getAuthToken()
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
      const exchange = this.selectedExchange
      const timeframe = this.selectedTimeframe
      
      console.log('Fetching results with token:', token)
      console.log('Request headers:', headers)
      
      // Fetch ADF results
      console.log('Request URL (ADF):', `${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/adf-test?timeframe=${timeframe}&exchange=${exchange}`)
      axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/adf-test`, { 
        headers,
        params: { timeframe, exchange }
      })
        .then(response => {
          console.log('ADF results fetched successfully:', response.data)
          this.adfResults = response.data
        })
        .catch(error => {
          console.error('Error fetching ADF results:', error)
          this.adfResults = []
        })
      
      // Fetch KPSS results
      console.log('Request URL (KPSS):', `${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/kpss-test?timeframe=${timeframe}&exchange=${exchange}`)
      axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/kpss-test`, { 
        headers,
        params: { timeframe, exchange }
      })
        .then(response => {
          console.log('KPSS results fetched successfully:', response.data)
          this.kpssResults = response.data
        })
        .catch(error => {
          console.error('Error fetching KPSS results:', error)
          this.kpssResults = []
        })
      
      // Fetch Hurst results
      console.log('Request URL (Hurst):', `${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/hurst-exponent?timeframe=${timeframe}&exchange=${exchange}`)
      axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/hurst-exponent`, { 
        headers,
        params: { timeframe, exchange }
      })
        .then(response => {
          console.log('Hurst results fetched successfully:', response.data)
          this.hurstResults = response.data
        })
        .catch(error => {
          console.error('Error fetching Hurst results:', error)
          this.hurstResults = []
        })
    },
    refreshResults() {
      this.fetchResults()
    },
    recalculateIndices() {
      const token = this.getAuthToken()
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
      const exchange = this.selectedExchange
      const timeframe = this.selectedTimeframe
      
      console.log('Recalculating indices with token:', token)
      console.log('Request headers:', headers)
      console.log('Request URL:', `${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/recalculate?timeframe=${timeframe}&exchange=${exchange}`)
      axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/v1/statistical-arbitrage/recalculate`, null, { 
        headers,
        params: { timeframe, exchange }
      })
        .then(response => {
          console.log('Recalculation successful:', response.data)
          this.fetchResults()
        })
        .catch(error => {
          console.error('Error recalculating indices:', error)
        })
    },
    sortResults(type) {
      let results
      let currentDirection
      
      if (type === 'adf') {
        results = this.adfResults
        currentDirection = this.adfSortDirection
        this.adfSortDirection = currentDirection === 'asc' ? 'desc' : 'asc'
      } else if (type === 'kpss') {
        results = this.kpssResults
        currentDirection = this.kpssSortDirection
        this.kpssSortDirection = currentDirection === 'asc' ? 'desc' : 'asc'
      } else if (type === 'hurst') {
        results = this.hurstResults
        currentDirection = this.hurstSortDirection
        this.hurstSortDirection = currentDirection === 'asc' ? 'desc' : 'asc'
      } else {
        return
      }

      results.sort((a, b) => {
        return currentDirection === 'asc' ? b.value - a.value : a.value - b.value
      })
    }
  },
  watch: {
    selectedExchange() {
      this.fetchResults()
    },
    selectedTimeframe() {
      this.fetchResults()
    }
  }
}
</script>

<style scoped>
/* 移除 @apply 指令，直接在模板中使用 Tailwind CSS 类名 */
</style> 