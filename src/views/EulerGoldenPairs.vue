<template>
  <NavBar />
  <div class="container mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ $t('euler_golden_pairs.title') }}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
          {{ $t('euler_golden_pairs.subtitle') }}
        </p>
      </div>
      <div class="flex gap-2">
        <n-button type="primary" :loading="running" @click="runNow">{{ $t('euler_golden_pairs.run') }}</n-button>
        <n-button :loading="loading" @click="loadLast">{{ $t('euler_golden_pairs.refresh') }}</n-button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">{{ $t('euler_golden_pairs.lookback') }}</label>
          <n-input-number v-model:value="form.lookbackBars" :min="200" :max="20000" class="w-full" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">{{ $t('euler_golden_pairs.top_n') }}</label>
          <n-input-number v-model:value="form.topN" :min="1" :max="200" class="w-full" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">{{ $t('euler_golden_pairs.min_rho') }}</label>
          <n-input-number v-model:value="form.minRho" :min="0" :max="0.999" :step="0.01" class="w-full" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">{{ $t('euler_golden_pairs.main_pool') }}</label>
          <n-input-number v-model:value="form.mainPoolLimit" :min="20" :max="300" class="w-full" />
        </div>
      </div>
    </div>

    <div v-if="error" class="mb-4 p-4 rounded border border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800">
      {{ error }}
    </div>

    <div v-if="data" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div class="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300 mb-4">
        <span v-if="data.generatedAtEpochMs">{{ $t('euler_golden_pairs.generated') }}: {{ formatTime(data.generatedAtEpochMs) }}</span>
        <span>{{ $t('euler_golden_pairs.duration') }}: {{ data.durationMs }} ms</span>
        <span>{{ $t('euler_golden_pairs.anchor') }}: {{ data.anchorSymbol }}</span>
        <span>{{ $t('euler_golden_pairs.points') }}: {{ data.points }}</span>
        <span>{{ $t('euler_golden_pairs.scanned') }}: {{ data.targetsScanned }}</span>
        <span>{{ $t('euler_golden_pairs.passed') }}: {{ data.passedMinRho }}</span>
        <span v-if="data.error" class="text-amber-700 dark:text-amber-300">{{ $t('euler_golden_pairs.status') }}: {{ data.error }}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-600 text-left text-gray-500 dark:text-gray-400">
              <th class="py-2 pr-4">#</th>
              <th class="py-2 pr-4">{{ $t('euler_golden_pairs.col_main') }}</th>
              <th class="py-2 pr-4">{{ $t('euler_golden_pairs.col_bench') }}</th>
              <th class="py-2 pr-4">ρ</th>
              <th class="py-2 pr-4">β</th>
              <th class="py-2 pr-4">σ(ε)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.rows" :key="r.rank + r.mainSymbol" class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="py-2 pr-4 text-gray-500">{{ r.rank }}</td>
              <td class="py-2 pr-4 font-mono font-medium text-gray-900 dark:text-gray-100">{{ r.mainSymbol }}</td>
              <td class="py-2 pr-4 font-mono text-gray-800 dark:text-gray-200">{{ r.benchmarkSymbol }}</td>
              <td class="py-2 pr-4">{{ fmt(r.rho, 4) }}</td>
              <td class="py-2 pr-4">{{ fmt(r.beta, 4) }}</td>
              <td class="py-2 pr-4">{{ fmt(r.spreadReturnSigma, 6) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!data.rows?.length" class="text-gray-500 py-6 text-center">{{ $t('euler_golden_pairs.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { NButton, NInputNumber } from 'naive-ui'
import { getEulerGoldenPairs, runEulerGoldenPairScan } from '@/api'

const loading = ref(false)
const running = ref(false)
const error = ref('')
const data = ref(null)

const form = ref({
  lookbackBars: 2000,
  topN: 50,
  minRho: 0.8,
  mainPoolLimit: 130,
})

function fmt(v, d) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

function formatTime(ms) {
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return String(ms)
  }
}

async function loadLast() {
  error.value = ''
  loading.value = true
  try {
    data.value = await getEulerGoldenPairs()
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

async function runNow() {
  error.value = ''
  running.value = true
  try {
    data.value = await runEulerGoldenPairScan({
      lookbackBars: form.value.lookbackBars,
      topN: form.value.topN,
      minRho: form.value.minRho,
      mainPoolLimit: form.value.mainPoolLimit,
    })
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    running.value = false
  }
}

onMounted(() => {
  loadLast()
})
</script>
