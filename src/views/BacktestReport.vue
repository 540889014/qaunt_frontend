<template>
  <NavBar />
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-bold leading-6 text-gray-900 dark:text-white">{{ t('backtest_report.title') }}</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          <span v-if="strategyName">{{ t('backtest_report.strategy') }}: <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ strategyName }}</span></span>
          <span v-else-if="instanceId">{{ t('backtest_report.instance_id') }}: <span class="font-semibold text-indigo-600 dark:text-indigo-400">#{{ instanceId }}</span></span>
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          v-if="viewMode === 'detail'"
          @click="backToList"
          type="button"
          class="mr-2 inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          返回报告列表
        </button>
        <button
          v-if="viewMode === 'detail' && selectedTimestamp"
          @click="confirmDelete"
          type="button"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto transition-colors duration-200"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          {{ t('backtest_report.delete_report') }}
        </button>
      </div>
    </div>

    <!-- Report List (first step) -->
    <section v-if="viewMode === 'list'" class="mt-8">
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">回测报告列表</h2>
        <label class="text-sm text-gray-600 dark:text-gray-300">排序字段：</label>
        <select
          v-model="reportListSortBy"
          class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="time">时间</option>
          <option value="return">收益率</option>
        </select>
        <select
          v-model="reportListSortDir"
          class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="desc">降序</option>
          <option value="asc">升序</option>
        </select>
      </div>
      <div class="overflow-hidden bg-white dark:bg-gray-900 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">时间</th>
              <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">总收益率</th>
              <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">参数</th>
              <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            <tr v-for="item in reportListRows" :key="item.timestamp" class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-200">{{ item.display_time }}</td>
              <td class="whitespace-nowrap px-3 py-4 text-sm" :class="Number(item.total_return) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ Number.isFinite(Number(item.total_return)) ? `${(Number(item.total_return) * 100).toFixed(2)}%` : '-' }}
              </td>
              <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300 truncate max-w-[420px]">{{ item.run_params || '-' }}</td>
              <td class="whitespace-nowrap px-3 py-4 text-sm">
                <button
                  @click="openReportDetail(item.timestamp)"
                  class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Timestamp Selector (inside detail) -->
    <div v-if="viewMode === 'detail' && (timestamps.length > 1 || historyList.length > 1)" class="mt-8">
      <div class="relative">
        <label for="timestamp-select" class="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
          <svg class="inline w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          {{ t('backtest_report.select_report') }}
        </label>
        <div class="relative">
          <select 
            id="timestamp-select" 
            v-model="selectedTimestamp" 
            @change="instanceId ? loadReportDataByInstanceId(instanceId, selectedTimestamp) : loadReportData()"
            class="appearance-none block w-full pl-4 pr-12 py-3 text-base border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
          >
            <option disabled value="" class="text-gray-500">{{ t('backtest_report.select_report_placeholder') }}</option>
            <template v-if="historyList.length > 0">
              <option v-for="item in historyList" :key="item.timestamp" :value="item.timestamp" class="py-2">
                {{ item.display_time }} | Return: {{ (item.total_return * 100).toFixed(2) }}% 
                <template v-if="item.run_params"> | Params: {{ item.run_params }}</template>
              </option>
            </template>
            <template v-else>
              <option v-for="ts in timestamps" :key="ts" :value="ts" class="py-2">
                {{ formatTimestamp(ts) }}
              </option>
            </template>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
        <div v-if="timestamps.length > 0 || historyList.length > 0" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ Math.max(timestamps.length, historyList.length) }} {{ t('backtest_report.available_reports') }}
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="mt-8 flex justify-center">
      <LoadingSpinner />
    </div>

    <div v-if="error" class="mt-8">
       <ErrorMessage :message="error" />
    </div>

    <div v-if="viewMode === 'detail' && reportData" class="mt-8 space-y-12">
      <!-- Performance Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.summary_title') }}</h2>
        <div class="mt-4 overflow-hidden bg-white dark:bg-gray-800 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg" v-if="totalPerformance">
            <dl class="divide-y divide-gray-300 dark:divide-gray-700">
                <div v-for="(value, key) in totalPerformance" :key="key">
                    <div v-if="key !== 'symbol' && key !== 'result_id'" class="grid grid-cols-2 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 sm:grid-cols-3">
                        <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ formatKey(key) }}</dt>
                        <dd class="text-sm font-semibold text-gray-900 dark:text-white col-span-1 sm:col-span-2">{{ formatValue(value, key) }}</dd>
                    </div>
                </div>
            </dl>
        </div>
      </section>

      <!-- Run Parameters Section -->
      <section v-if="runParamsEntries.length">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">回测参数</h2>
        <div class="mt-4 overflow-hidden bg-white dark:bg-gray-800 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <dl class="divide-y divide-gray-300 dark:divide-gray-700">
            <div
              v-for="item in runParamsEntries"
              :key="item.key"
              class="grid grid-cols-2 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 sm:grid-cols-3"
            >
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ item.key }}</dt>
              <dd class="text-sm font-semibold text-gray-900 dark:text-white col-span-1 sm:col-span-2 break-all">{{ item.value }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- Performance by Symbol Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.by_symbol_title') }}</h2>
        <div class="mt-4 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th v-for="header in symbolPerformanceHeaders" :key="header" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ formatKey(header) }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                <tr v-for="perf in symbolPerformance" :key="perf.symbol" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td v-for="header in symbolPerformanceHeaders" :key="header" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatValue(perf[header], header) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      </section>

      <!-- Kline Chart Section (within backtest range) -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.kline_chart_title') }}</h2>
        <div class="mt-4 p-4 bg-white dark:bg-gray-900 shadow rounded-lg space-y-4">
          <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('backtest_report.kline_symbol') }}</label>
              <select
                v-model="selectedKlineSymbol"
                class="block w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option v-for="p in symbolPerformance" :key="p.symbol" :value="p.symbol">{{ p.symbol }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('backtest_report.kline_exchange') }}</label>
              <select
                v-model="selectedKlineExchange"
                class="block w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="okx">OKX</option>
                <option value="binance">Binance</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('backtest_report.kline_timeframe') }}</label>
              <select
                v-model="selectedKlineTimeframe"
                class="block w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="15m">15m</option>
                <option value="1H">1H</option>
                <option value="4H">4H</option>
                <option value="1D">1D</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">价差腿A</label>
              <select
                v-model="selectedSpreadLegA"
                class="block w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option v-for="s in spreadSymbolOptions" :key="`sa-${s}`" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">价差腿B</label>
              <select
                v-model="selectedSpreadLegB"
                class="block w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option v-for="s in spreadSymbolOptions" :key="`sb-${s}`" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button
                @click="loadKline"
                :disabled="!selectedKlineSymbol || klineLoading"
                type="button"
                class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {{ klineLoading ? t('backtest_report.kline_loading') : t('backtest_report.kline_load') }}
              </button>
              <div class="text-xs text-gray-500 dark:text-gray-400 self-center" v-if="backtestTimeRangeText">
                {{ backtestTimeRangeText }}
              </div>
            </div>
          </div>

          <div v-if="klineError" class="text-sm text-red-600 dark:text-red-400">{{ klineError }}</div>

          <div v-if="klineCandles.length" class="mt-2">
            <VueApexCharts
              :key="`kline-${selectedTimestamp}-${selectedKlineSymbol}-${selectedKlineExchange}-${selectedKlineTimeframe}`"
              type="candlestick"
              height="420"
              :options="klineOptions"
              :series="klineSeries"
            />
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('backtest_report.kline_hint') }}
          </div>
          <div v-if="spreadSeries.length" class="mt-6">
            <div class="mb-2 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <span>价差(与策略一致): ({{ selectedSpreadLegA }} - {{ selectedSpreadLegB }}) / {{ selectedSpreadLegA }}</span>
              <label class="inline-flex items-center gap-1 cursor-pointer">
                <input v-model="spreadEventFilters.open" type="checkbox" class="h-4 w-4" />
                <span>OPEN</span>
              </label>
              <label class="inline-flex items-center gap-1 cursor-pointer">
                <input v-model="spreadEventFilters.add" type="checkbox" class="h-4 w-4" />
                <span>ADD</span>
              </label>
              <label class="inline-flex items-center gap-1 cursor-pointer">
                <input v-model="spreadEventFilters.close" type="checkbox" class="h-4 w-4" />
                <span>CLOSE</span>
              </label>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                events: {{ normalizedSpreadEvents.length }}, plotted: {{ spreadEventPoints.length }}
              </span>
            </div>
            <VueApexCharts
              :key="`spread-${selectedTimestamp}-${selectedSpreadLegA}-${selectedSpreadLegB}-${selectedKlineExchange}-${selectedKlineTimeframe}-${spreadEventPoints.length}-${spreadEventFilters.open}-${spreadEventFilters.add}-${spreadEventFilters.close}`"
              type="line"
              height="260"
              :options="spreadOptions"
              :series="spreadSeriesData"
            />
          </div>
          <div v-else-if="spreadHint" class="text-sm text-gray-500 dark:text-gray-400 mt-3">
            {{ spreadHint }}
          </div>
          <div v-if="strategyIndicatorSeriesData.length" class="mt-6">
            <div class="mb-2 text-sm text-gray-600 dark:text-gray-300">
              {{ t('backtest_report.strategy_indicator_title') }}
            </div>
            <VueApexCharts
              :key="`indicator-${selectedTimestamp}-${strategyIndicatorSeriesData[0]?.data?.length || 0}`"
              type="line"
              height="280"
              :options="strategyIndicatorOptions"
              :series="strategyIndicatorSeriesData"
            />
          </div>
        </div>
      </section>

      <!-- Equity Curve Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.equity_curve_title') }}</h2>
        <div class="mt-4 p-4 bg-white dark:bg-gray-900 shadow rounded-lg">
          <VueApexCharts
            v-if="!loading"
            :key="`equity-${selectedTimestamp}`"
            type="line"
            height="400"
            :options="equityCurveOptions"
            :series="equityCurveSeries"
          />
        </div>
      </section>

      <!-- Daily Returns Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.daily_returns_title') }}</h2>
        <div class="mt-4 p-4 bg-white dark:bg-gray-900 shadow rounded-lg">
          <VueApexCharts
            v-if="!loading"
            :key="`daily-${selectedTimestamp}`"
            type="bar"
            height="350"
            :options="dailyReturnsOptions"
            :series="dailyReturnsSeries"
          />
        </div>
      </section>

      <!-- Final Open Positions Section -->
      <section v-if="openPositions && openPositions.length">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.open_positions_title') }}</h2>
        <div class="mt-4 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.symbol') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.side') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.quantity') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.avg_entry') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.mark') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.unrealized_pnl') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.open_time') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.holding_time') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.last_exec_time') }}</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ t('backtest_report.open_positions_headers.idle_time') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    <tr v-for="(p, idx) in openPositions" :key="idx" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-200">{{ p.symbol }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-200">{{ formatPosSide(p.side) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatNum(p.quantity) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatNum(p.avg_entry) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatNum(p.mark) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm" :class="Number(p.unrealized_pnl) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                        {{ formatNum(p.unrealized_pnl) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatTs(p.open_ts) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatDuration(p.holding_ms) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatTs(p.last_exec_ts) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatDuration(p.idle_ms) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Orders Table Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.orders_title') }}</h2>
        <div class="mt-4 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th v-for="header in orderTableHeaders" :key="header.key" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{ header.label }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    <tr v-for="order in paginatedOrders" :key="order.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td v-for="header in orderTableHeaders" :key="header.key" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <span v-if="header.key === 'openclose'">{{ formatOpenClose(order[header.key]) }}</span>
                        <span v-else>{{ order[header.key] }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="reportData.orders.length > ordersToShow" class="mt-4 text-center">
                  <button @click="showMoreOrders" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200">
                    {{ t('backtest_report.show_more') }} ({{ ordersToShow }} / {{ reportData.orders.length }})
                  </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Trades Table Section -->
      <section>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.trades_title') }}</h2>
        <div class="mt-4 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th v-for="header in tradeTableHeaders" :key="header.key" scope="col"
                                        class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{
                                        header.label }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                <tr v-for="trade in paginatedTrades" :key="trade.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td v-for="header in tradeTableHeaders" :key="header.key" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ trade[header.key] }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-if="reportData.trades.length > tradesToShow" class="mt-4 text-center">
                        <button @click="showMoreTrades" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200">
                            {{ t('backtest_report.show_more') }} ({{ tradesToShow }} / {{ reportData.trades.length }})
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </section>

      <!-- Periodic Performance & Log Section -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.periodic_performance_title') }}</h2>
          <div class="mt-4 flow-root">
            <div class="overflow-x-auto">
                <div class="inline-block min-w-full py-2 align-middle">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th v-for="header in periodicPerformanceHeaders" :key="header.key" scope="col"
                                        class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">{{
                                        header.label }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                <tr v-for="perf in reportData.periodicPerformance" :key="perf.year" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                     <td v-for="header in periodicPerformanceHeaders" :key="header.key" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatValue(perf[header.key], header.key) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </div>
        </div>
        
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('backtest_report.log_title') }}</h2>
          <div class="mt-4 flow-root">
            <div class="h-96 overflow-auto bg-gray-900 text-white font-mono text-sm p-4 rounded-lg shadow ring-1 ring-black ring-opacity-5">
              <pre>{{ logContent }}</pre>
            </div>
          </div>
        </div>
      </section>

    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { getBacktestReportList, getBacktestReportData, getBacktestReportLog, deleteBacktestReport, getBacktestReportTimestampsByInstanceId, getBacktestReportDataByInstanceId, getKlineData, getBacktestHistoryList } from '@/api'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import VueApexCharts from 'vue3-apexcharts'
import NavBar from '@/components/NavBar.vue'

const { t, locale } = useI18n()
const route = useRoute()
const MAX_ORDERS_RENDER = 5000
const MAX_TRADES_RENDER = 5000
const MAX_SPREAD_EVENTS_RENDER = 8000
const MAX_INDICATOR_POINTS_RENDER = 8000

const sampleEvenly = (arr, maxPoints) => {
  if (!Array.isArray(arr)) return []
  if (arr.length <= maxPoints) return arr
  const out = []
  const n = arr.length
  const step = (n - 1) / Math.max(1, (maxPoints - 1))
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(n - 1, Math.round(i * step))
    out.push(arr[idx])
  }
  return out
}

const props = defineProps({
  strategyName: {
    type: String,
    required: false
  },
  instanceId: {
    type: [String, Number],
    required: false
  }
})

const pad2 = (n) => String(n).padStart(2, '0')

const formatDateNumeric = (ts) => {
  const t = typeof ts === 'number' ? ts : Number(ts)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const formatDateTimeNumeric = (ts) => {
  const t = typeof ts === 'number' ? ts : Number(ts)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const timestamps = ref([])
const historyList = ref([])
const selectedTimestamp = ref('')
const reportData = ref(null)
const logContent = ref('')
const loading = ref(false)
const error = ref(null)
const viewMode = ref('list')
const reportListSortBy = ref('time') // time | return
const reportListSortDir = ref('desc') // asc | desc

// Get instanceId from props or route
const instanceId = computed(() => props.instanceId || route.params.instanceId)
const strategyName = computed(() => props.strategyName || route.params.strategyName)

const ordersToShow = ref(20)
const tradesToShow = ref(20)

// --- Kline chart (within backtest range) ---
const selectedKlineSymbol = ref('')
const selectedKlineExchange = ref('okx')
const selectedKlineTimeframe = ref('15m')
const klineLoading = ref(false)
const klineError = ref('')
const klineCandles = ref([]) // [{x, y:[o,h,l,c]}]
const spreadSeries = ref([]) // [[ts, spread]]
const spreadHint = ref('')
const selectedSpreadLegA = ref('')
const selectedSpreadLegB = ref('')
const spreadEventFilters = ref({
  open: true,
  add: true,
  close: true,
})

const klineSeries = computed(() => {
  return [{ data: klineCandles.value || [] }]
})

const spreadSeriesData = computed(() => {
  return [{ name: 'Spread', data: spreadSeries.value || [] }]
})

const strategyIndicatorRows = computed(() => {
  const rows = reportData.value?.indicatorSeries
  if (!Array.isArray(rows) || !rows.length) return []
  const source = sampleEvenly(rows, MAX_INDICATOR_POINTS_RENDER)
  return source
    .map(r => ({
      ts: parseEventTs(r?.ts),
      spread: Number(r?.spread),
      z: Number(r?.z),
    }))
    .filter(r => Number.isFinite(r.ts) && Number.isFinite(r.spread) && Number.isFinite(r.z))
    .sort((a, b) => a.ts - b.ts)
})

const strategyIndicatorSeriesData = computed(() => {
  const rows = strategyIndicatorRows.value
  if (!rows.length) return []
  return [
    { name: 'Strategy Spread', type: 'line', data: rows.map(r => [r.ts, r.spread]), yAxisIndex: 0 },
    { name: 'Strategy Z', type: 'line', data: rows.map(r => [r.ts, r.z]), yAxisIndex: 1 },
  ]
})

// Keep spread chart formula aligned with current strategy logic (DualZScoreGridStrategy):
// spread = (A - B) / A
const computeStrategySpread = (priceA, priceB) => {
  const a = Number(priceA)
  const b = Number(priceB)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return NaN
  return (a - b) / a
}

const spreadEvents = computed(() => {
  const rows = reportData.value?.spreadEvents
  if (!Array.isArray(rows)) return []
  return sampleEvenly(rows, MAX_SPREAD_EVENTS_RENDER)
})

const parseEventTs = (v) => {
  if (v === null || v === undefined) return NaN
  if (typeof v === 'number') return v
  const s = String(v).trim()
  if (!s) return NaN
  if (/^\d+$/.test(s)) return Number(s)
  const t = Date.parse(s.replace(' ', 'T'))
  return Number.isFinite(t) ? t : NaN
}

const normalizedSpreadEvents = computed(() => {
  if (spreadEvents.value.length) return spreadEvents.value
  // Frontend fallback: derive events from orders table for legacy reports.
  const orders = reportData.value?.orders
  if (!Array.isArray(orders) || !orders.length) return []
  const source = sampleEvenly(orders, MAX_SPREAD_EVENTS_RENDER)
  return source
    .map(o => ({
      ts: parseEventTs(o?.time),
      event_type: String(o?.openclose || '').toUpperCase(),
      symbol: String(o?.symbol || ''),
      side: String(o?.order_side || ''),
      qty: o?.qty,
      price: o?.price,
      order_id: o?.order_id,
    }))
    .filter(e => Number.isFinite(e.ts) && e.event_type)
})

const findNearestSpreadY = (ts) => {
  const data = spreadSeries.value || []
  if (!data.length || !Number.isFinite(ts)) return null
  let lo = 0
  let hi = data.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (data[mid][0] < ts) lo = mid + 1
    else hi = mid
  }
  const i = lo
  const c1 = data[i]
  const c0 = i > 0 ? data[i - 1] : null
  if (!c0) return c1?.[1]
  return Math.abs(c1[0] - ts) <= Math.abs(c0[0] - ts) ? c1[1] : c0[1]
}

const spreadEventPoints = computed(() => {
  const rows = normalizedSpreadEvents.value
  const legA = selectedSpreadLegA.value
  if (!rows.length) return []
  const sameLegRows = legA ? rows.filter(e => String(e?.symbol || '') === legA) : []
  const sourceRows = sameLegRows.length ? sameLegRows : rows
  const points = []
  for (const e of sourceRows) {
    const typeRaw = String(e?.event_type || e?.openclose || '').toUpperCase()
    let style = null
    if (typeRaw === 'OPEN' && spreadEventFilters.value.open) style = { color: '#16a34a', label: 'OPEN' }
    else if (typeRaw === 'ADD' && spreadEventFilters.value.add) style = { color: '#f59e0b', label: 'ADD' }
    else if ((typeRaw === 'CLOSE' || typeRaw === 'REDUCE' || typeRaw === 'FLIP') && spreadEventFilters.value.close) style = { color: '#dc2626', label: 'CLOSE' }
    if (!style) continue

    const ts = Number(e?.ts)
    const y = findNearestSpreadY(ts)
    if (!Number.isFinite(ts) || !Number.isFinite(y)) continue
    points.push({
      x: ts,
      y,
      marker: {
        size: 5,
        fillColor: style.color,
        strokeColor: '#ffffff',
        radius: 2,
      },
      label: {
        text: style.label,
        borderColor: style.color,
        style: { background: style.color, color: '#fff', fontSize: '9px' },
      },
    })
  }
  return points
})

const spreadSymbolOptions = computed(() => {
  const set = new Set()
  const rows = symbolPerformance.value || []
  for (const r of rows) {
    const s = String(r?.symbol || '').trim()
    if (s) set.add(s)
  }
  const rp = reportData.value?.runParams || {}
  if (rp.primaryLeg) set.add(String(rp.primaryLeg))
  if (rp.secondaryLeg) set.add(String(rp.secondaryLeg))
  return [...set]
})

const spreadLegA = computed(() => {
  const rp = reportData.value?.runParams || {}
  if (rp.primaryLeg) return String(rp.primaryLeg)
  const first = symbolPerformance.value?.[0]?.symbol
  return first ? String(first) : ''
})

const spreadLegB = computed(() => {
  const rp = reportData.value?.runParams || {}
  if (rp.secondaryLeg) return String(rp.secondaryLeg)
  const rows = symbolPerformance.value || []
  const a = spreadLegA.value
  const second = rows.find(r => String(r?.symbol || '') !== a)?.symbol
  return second ? String(second) : ''
})

const klineOptions = computed(() => ({
  chart: {
    type: 'candlestick',
    height: 420,
    toolbar: { show: true },
    zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
    animations: { enabled: false },
  },
  xaxis: {
    type: 'datetime',
    labels: {
      datetimeUTC: false,
      formatter: (_, timestamp) => formatDateTimeNumeric(timestamp),
    },
  },
  yaxis: {
    tooltip: { enabled: true },
    labels: {
      formatter: (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(6) : v),
    },
  },
  tooltip: {
    enabled: true,
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
  },
  noData: {
    text: t('backtest_report.kline_error_no_data'),
  },
}))

const spreadOptions = computed(() => ({
  chart: {
    type: 'line',
    height: 260,
    toolbar: { show: true },
    zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
    animations: { enabled: false },
  },
  stroke: { width: 2, curve: 'smooth' },
  xaxis: {
    type: 'datetime',
    labels: {
      datetimeUTC: false,
      formatter: (_, timestamp) => formatDateTimeNumeric(timestamp),
    },
  },
  yaxis: {
    title: { text: 'Spread' },
    labels: {
      formatter: (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(6) : v),
    },
  },
  tooltip: {
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
    y: {
      formatter: (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(6) : v),
    },
  },
  annotations: {
    points: spreadEventPoints.value,
  },
  noData: { text: 'No spread data.' },
}))

const strategyIndicatorOptions = computed(() => ({
  chart: {
    type: 'line',
    height: 280,
    toolbar: { show: true },
    zoom: { enabled: true, type: 'x', autoScaleYaxis: false },
    animations: { enabled: false },
  },
  stroke: { width: [2, 2], curve: 'smooth' },
  xaxis: {
    type: 'datetime',
    labels: {
      datetimeUTC: false,
      formatter: (_, timestamp) => formatDateTimeNumeric(timestamp),
    },
  },
  yaxis: [
    {
      title: { text: 'Spread' },
      labels: {
        formatter: (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(6) : v),
      },
    },
    {
      opposite: true,
      title: { text: 'Z' },
      labels: {
        formatter: (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : v),
      },
    },
  ],
  tooltip: {
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
  },
  noData: { text: 'No indicator data.' },
}))

const orderTableHeaders = computed(() => {
    const keys = ['time', 'symbol', 'order_side', 'order_type', 'price', 'qty', 'openclose', 'order_id'];
    return keys.map(key => ({
        key,
        label: t(`backtest_report.order_headers.${key}`)
    }));
});

const formatOpenClose = (v) => {
  const s = (v ?? '').toString().trim().toUpperCase()
  if (!s) return ''
  const mapKey = {
    OPEN: 'open',
    CLOSE: 'close',
    ADD: 'add',
    REDUCE: 'reduce',
    FLIP: 'flip',
    HOLD: 'hold',
  }[s]
  return mapKey ? t(`backtest_report.openclose_values.${mapKey}`) : s
}

const tradeTableHeaders = computed(() => {
    const keys = ['time', 'symbol', 'order_side', 'price', 'qty', 'status', 'order_id'];
    return keys.map(key => ({
        key,
        label: t(`backtest_report.trade_headers.${key}`)
    }));
});

const periodicPerformanceHeaders = computed(() => {
    const keys = ['year', 'total_pnl_rate', 'annualized_return_rate', 'sharpe_ratio', 'maximum_drawdown_rate'];
    return keys.map(key => ({
        key,
        label: t(`backtest_report.periodic_headers.${key}`)
    }));
});


const paginatedOrders = computed(() => {
  if (!reportData.value || !reportData.value.orders) {
    return []
  }
  return reportData.value.orders.slice(0, ordersToShow.value)
})

const paginatedTrades = computed(() => {
    if (!reportData.value || !reportData.value.trades) {
        return []
    }
    return reportData.value.trades.slice(0, tradesToShow.value)
})

const showMoreOrders = () => {
  ordersToShow.value += 20;
}

const showMoreTrades = () => {
    tradesToShow.value += 20;
}

const confirmDelete = () => {
  if (confirm(t('backtest_report.confirm_delete'))) {
    deleteReport();
  }
};

const deleteReport = async () => {
  if (!selectedTimestamp.value) return;

  loading.value = true;
  error.value = null;

  try {
    await deleteBacktestReport(props.strategyName, selectedTimestamp.value);
    
    // Remove the deleted timestamp from the list
    const index = timestamps.value.indexOf(selectedTimestamp.value);
    if (index > -1) {
      timestamps.value.splice(index, 1);
    }
    
    // Clear current data
    reportData.value = null;
    logContent.value = '';
    selectedTimestamp.value = '';
    
    // Select the first available timestamp if any
    if (timestamps.value.length > 0) {
      selectedTimestamp.value = timestamps.value[0];
      await loadReportData();
    }
    
    // Show success message
    alert(t('backtest_report.report_deleted'));
  } catch (err) {
    error.value = `Failed to delete report: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    // Check if we're using instanceId-based route
    const currentInstanceId = instanceId.value
    if (currentInstanceId) {
      // Load history list (rich data)
      const response = await getBacktestHistoryList(currentInstanceId)
      historyList.value = Array.isArray(response) ? response : (response?.data || [])
      // First show list, user picks a report to enter detail.
      viewMode.value = 'list'
    } else if (strategyName.value) {
      // Legacy: Load reports by strategy name (from file system)
      const response = await getBacktestReportList(strategyName.value)
      // API interceptor extracts data field
      timestamps.value = Array.isArray(response) ? response : (response?.data || [])
      viewMode.value = 'list'
    } else {
      error.value = 'Either strategyName or instanceId must be provided'
    }
  } catch (err) {
    error.value = `Failed to load backtest report list: ${err.message}`
  } finally {
    loading.value = false
  }
})

const loadReportData = async () => {
  if (!selectedTimestamp.value || !props.strategyName) return

  loading.value = true
  error.value = null
  reportData.value = null
  logContent.value = ''
  klineCandles.value = []
  spreadSeries.value = []
  spreadHint.value = ''
  klineError.value = ''

  try {
    const dataResponse = await getBacktestReportData(props.strategyName, selectedTimestamp.value)
    reportData.value = trimReportPayload(dataResponse.data || dataResponse)
    viewMode.value = 'detail'
    ordersToShow.value = 20 // Reset on new data load
    tradesToShow.value = 20 // Reset on new data load
    await nextTick()
    await autoLoadKlineIfReady()

    const logResponse = await getBacktestReportLog(props.strategyName, selectedTimestamp.value)
    const logData = logResponse.data || logResponse
    if (Array.isArray(logData)) {
      logContent.value = logData.join('\n')
    } else {
      logContent.value = logData || ''
    }
  } catch (err) {
    error.value = `Failed to load report data: ${err.message}`
    reportData.value = null
    logContent.value = ''
  } finally {
    loading.value = false
  }
}

const loadReportDataByInstanceId = async (instanceIdParam, timestampParam = null) => {
  loading.value = true
  error.value = null
  reportData.value = null
  logContent.value = ''
  klineCandles.value = []
  spreadSeries.value = []
  spreadHint.value = ''
  klineError.value = ''

  try {
    const dataResponse = await getBacktestReportDataByInstanceId(instanceIdParam, timestampParam)
    // API interceptor extracts data field, so dataResponse is already the BacktestReportDto
    reportData.value = trimReportPayload(dataResponse)
    viewMode.value = 'detail'
    ordersToShow.value = 20 // Reset on new data load
    tradesToShow.value = 20 // Reset on new data load
    await nextTick()
    await autoLoadKlineIfReady()
    
    // Log content is not available from database yet, set empty
    logContent.value = 'Log content not available for database-backed reports.'
  } catch (err) {
    error.value = `Failed to load report data: ${err.message}`
    reportData.value = null
    logContent.value = ''
  } finally {
    loading.value = false
  }
}

const reportListRows = computed(() => {
  let rows = []
  if (historyList.value.length) {
    rows = historyList.value.map(item => ({
      timestamp: item.timestamp,
      display_time: item.display_time || formatTimestamp(item.timestamp),
      total_return: Number(item.total_return),
      run_params: item.run_params || '',
    }))
  } else if (timestamps.value.length) {
    rows = timestamps.value.map(ts => ({
      timestamp: ts,
      display_time: formatTimestamp(ts),
      total_return: NaN,
      run_params: '',
    }))
  }
  const by = reportListSortBy.value
  const dir = reportListSortDir.value === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (by === 'return') {
      const ra = Number.isFinite(a.total_return) ? a.total_return : -Infinity
      const rb = Number.isFinite(b.total_return) ? b.total_return : -Infinity
      return (ra - rb) * dir
    }
    const ta = parseEventTs(a.timestamp)
    const tb = parseEventTs(b.timestamp)
    return (ta - tb) * dir
  })
})

const openReportDetail = async (ts) => {
  selectedTimestamp.value = ts
  if (instanceId.value) await loadReportDataByInstanceId(instanceId.value, ts)
  else await loadReportData()
}

const backToList = () => {
  viewMode.value = 'list'
}

const equityCurveSeries = computed(() => {
  if (!reportData.value || !reportData.value.portfolioDetails) {
    return []
  }

  // Many backends emit multiple portfolioDetail rows with the same ts.
  // ApexCharts will draw vertical spikes when x is duplicated (same timestamp, different y).
  // We aggregate by ts to a single point per timestamp.
  const rows = [...reportData.value.portfolioDetails]
    .map(d => ({
      ts: parseInt(d.ts, 10),
      total: parseFloat(d.total_pnl),
      realized: parseFloat(d.realized_pnl),
      floating: parseFloat(d.floating_pnl),
    }))
    .filter(r => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts)

  const byTs = new Map()
  for (const r of rows) {
    // Keep the last total/floating for this timestamp; collect realized values to decide later.
    const prev = byTs.get(r.ts) || { ts: r.ts, total: NaN, floating: NaN, realizedVals: [] }
    if (Number.isFinite(r.total)) prev.total = r.total
    if (Number.isFinite(r.floating)) prev.floating = r.floating
    if (Number.isFinite(r.realized)) prev.realizedVals.push(r.realized)
    byTs.set(r.ts, prev)
  }

  const details = [...byTs.values()]
    .filter(d => Number.isFinite(d.total)) // need total to anchor the curve
    .sort((a, b) => a.ts - b.ts)

  const totalSeries = details.map(d => d.total)
  const realizedLast = details.map(d => (d.realizedVals.length ? d.realizedVals[d.realizedVals.length - 1] : 0))
  const realizedSumPerTs = details.map(d => d.realizedVals.reduce((acc, v) => acc + v, 0))

  // Heuristic: if realized is mostly 0 with spikes, treat it as delta-per-ts and accumulate the per-ts sums.
  const zeroishCount = realizedLast.filter(v => Math.abs(v) < 1e-12).length
  const looksLikeDelta = realizedLast.length > 10 && zeroishCount / realizedLast.length > 0.6

  const realizedDisplay = (() => {
    if (!looksLikeDelta) return realizedLast
    let acc = 0
    return realizedSumPerTs.map(v => {
      acc += v
      return acc
    })
  })()

  const floatingRaw = details.map(d => (Number.isFinite(d.floating) ? d.floating : NaN))
  const floatingValidCount = floatingRaw.filter(v => Number.isFinite(v)).length
  const derivedFloating = details.map((d, i) => d.total - realizedDisplay[i])
  const floatingDisplay =
    floatingValidCount === 0
      ? derivedFloating
      : floatingRaw.map((v, i) => (Number.isFinite(v) ? v : derivedFloating[i]))

  const totalPnlData = details.map((d, i) => [d.ts, totalSeries[i]])
  const realizedPnlData = details.map((d, i) => [d.ts, realizedDisplay[i]])
  const floatingPnlData = details.map((d, i) => [d.ts, floatingDisplay[i]])

  return [
    {
      name: t('backtest_report.total_pnl_series'),
      data: totalPnlData
    },
    {
      name: t('backtest_report.realized_pnl_series'),
      data: realizedPnlData
    },
    {
      name: t('backtest_report.floating_pnl_series'),
      data: floatingPnlData
    }
  ]
})

const equityCurveOptions = computed(() => {
  return {
    chart: {
      type: 'line',
      height: 400,
      zoom: {
        enabled: true
      },
      toolbar: {
        show: true
      }
    },
    colors: ['#546E7A', '#2E7D32', '#E91E63'],
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        formatter: (_, timestamp) => formatDateTimeNumeric(timestamp),
      }
    },
    // Single Y axis: keep all PnL series on the same scale (no dual-axis).
    yaxis: {
      title: {
        text: t('backtest_report.pnl_axis'),
      },
      labels: {
        formatter: (value) => {
          if (typeof value !== 'number' || Number.isNaN(value)) return '0'
          return value.toFixed(2)
        },
      },
    },
    tooltip: {
      x: {
        format: 'yyyy-MM-dd HH:mm:ss'
      },
    },
    stroke: {
      // Make realized PnL look like step changes when it updates discretely.
      curve: ['smooth', 'stepline', 'smooth'],
      width: 2,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
    },
    dataLabels: {
      enabled: false
    },
    noData: {
      text: 'No data available for the equity curve.'
    }
  }
})

const dailyReturnsSeries = computed(() => {
  if (!reportData.value || !reportData.value.dailyIndicators) {
    return []
  }
  const data = reportData.value.dailyIndicators.map(d => {
    const x = new Date(d.date).getTime();
    // Prefer USDT PnL for charting to avoid unit confusion.
    // Fallback to daily_return (rate) for backward compatibility.
    const yRaw = d.daily_pnl_usdt ?? d.daily_pnl ?? d.daily_return;
    const y = parseFloat(yRaw);
    if (isNaN(x) || isNaN(y)) {
      return null;
    }
    return { x, y };
  }).filter(Boolean);

  return [{
    name: t('backtest_report.daily_pnl_usdt_series'),
    data
  }]
})

const dailyReturnsOptions = computed(() => ({
  chart: {
    type: 'bar',
    height: 350
  },
  dataLabels: {
    enabled: false
  },
  title: {
    text: t('backtest_report.daily_returns_title'),
    align: 'left'
  },
  xaxis: {
    type: 'datetime',
    labels: {
      formatter: (_, timestamp) => formatDateNumeric(timestamp),
    },
  },
  yaxis: {
    title: {
      text: t('backtest_report.daily_pnl_axis')
    },
    labels: {
      formatter: (value) => {
        return typeof value === 'number' ? value.toFixed(2) : value
      }
    }
  },
  tooltip: {
    x: {
      format: 'yyyy-MM-dd'
    },
    y: {
      formatter: (value) => {
        return typeof value === 'number' ? `${value.toFixed(2)} USDT` : value
      }
    }
  }
}));

const openPositions = computed(() => {
  return reportData.value?.openPositions || []
})

const formatNum = (v) => {
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return 'N/A'
  return n.toFixed(4)
}

const formatTs = (ts) => {
  const n = parseInt(ts, 10)
  if (!Number.isFinite(n) || n <= 0) return 'N/A'
  return new Date(n).toLocaleString()
}

const formatDuration = (ms) => {
  const n = parseInt(ms, 10)
  if (!Number.isFinite(n) || n <= 0) return '0'
  const sec = Math.floor(n / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const formatPosSide = (side) => {
  if (!side) return 'N/A'
  const s = String(side).toUpperCase()
  if (s === 'LONG') return t('backtest_report.long')
  if (s === 'SHORT') return t('backtest_report.short')
  return s
}

const formatValue = (value, key = '') => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return 'N/A';
  }

  const rateKeys = ['total_pnl_rate', 'win_rate', 'annualized_return_rate', 'maximum_drawdown_rate', 'trade_success_rate'];
  const num = parseFloat(value);

  if (isNaN(num)) {
    return value;
  }

  if (rateKeys.includes(key)) {
    return `${(num * 100).toFixed(2)}%`;
  }

  if (key === 'backtest_duration_ms') {
    const sec = num / 1000
    if (locale.value === 'zh') return `${sec.toFixed(2)} 秒`
    return `${sec.toFixed(2)} s`
  }
  
  if (key.includes('ratio')) {
    return num.toFixed(3);
  }
  
  if (key.includes('time') && typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value)) {
    return value;
  }
  
  if (num % 1 === 0) {
    return num.toLocaleString();
  }
  
  return parseFloat(num.toFixed(4)).toLocaleString();
};

const formatKey = (key) => {
  if (!key) return '';
  // Try to get translation from metrics
  const translation = t(`backtest_report.metrics.${key}`, null);
  // If translation exists and is different from the key path, use it
  if (translation && translation !== `backtest_report.metrics.${key}`) {
    return translation;
  }
  // Fallback: format the key for Chinese locale
  if (locale.value === 'zh') {
    // Chinese key mappings for common fields
    const chineseMap = {
      'symbol': '交易对',
      'total_pnl_rate': '总盈亏率',
      'annualized_return_rate': '年化收益率',
      'sharpe_ratio': '夏普比率',
      'calmar_ratio': '卡玛比率',
      'sortino_ratio': '索提诺比率',
      'win_rate': '胜率',
      'profit_factor': '盈亏比',
      'average_win': '平均盈利',
      'average_loss': '平均亏损',
      'largest_win': '最大盈利',
      'largest_loss': '最大亏损',
      'maximum_drawdown_rate': '最大回撤率',
      'total_trades': '总交易数',
      'winning_trades': '盈利交易数',
      'losing_trades': '亏损交易数',
      'total_fees': '总手续费',
      'final_equity': '最终权益',
      'initial_balance': '初始余额',
      'backtest_duration_ms': '回测耗时'
    };
    if (chineseMap[key]) {
      return chineseMap[key];
    }
    // Fallback: format key with spaces and capitalize
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  // For English, show formatted key
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const runParamsEntries = computed(() => {
  const params = reportData.value?.runParams
  if (!params || typeof params !== 'object') return []
  return Object.entries(params)
    .map(([key, value]) => ({ key, value: value == null ? '' : String(value) }))
    .sort((a, b) => a.key.localeCompare(b.key))
})

const totalPerformance = computed(() => {
    if (!reportData.value || !Array.isArray(reportData.value.performance)) {
        return null;
    }
    return reportData.value.performance.find(p => p.symbol === 'Total');
});

const symbolPerformance = computed(() => {
    if (!reportData.value || !Array.isArray(reportData.value.performance)) {
        return [];
    }
    return reportData.value.performance.filter(p => p.symbol !== 'Total');
});

const backtestTimeRange = computed(() => {
  const rows = reportData.value?.portfolioDetails || []
  const tsList = rows
    .map(r => parseInt(r.ts, 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  if (!tsList.length) return null
  return { start: tsList[0], end: tsList[tsList.length - 1] }
})

const backtestTimeRangeText = computed(() => {
  if (!backtestTimeRange.value) return ''
  const { start, end } = backtestTimeRange.value
  return `${new Date(start).toLocaleString()} ~ ${new Date(end).toLocaleString()}`
})

const loadKline = async () => {
  klineError.value = ''
  klineCandles.value = []
  spreadSeries.value = []
  spreadHint.value = ''
  const sym = selectedKlineSymbol.value
  if (!sym) {
    klineError.value = t('backtest_report.kline_error_no_symbol')
    return
  }
  const range = backtestTimeRange.value
  if (!range) {
    klineError.value = t('backtest_report.kline_error_no_range')
    return
  }
  klineLoading.value = true
  try {
    // Prevent UI freeze when backtest range is large.
    const MAX_PLOT_POINTS = 5000
    const MAX_FETCH_POINTS = 20000

    const timeframeToMs = (tf) => {
      const s = String(tf || '').trim()
      const m = s.match(/^(\d+)\s*([mMhHdD])$/)
      if (!m) return 60_000
      const n = Number(m[1])
      const u = m[2].toUpperCase()
      if (!Number.isFinite(n) || n <= 0) return 60_000
      if (u === 'M') return n * 60_000
      if (u === 'H') return n * 3_600_000
      if (u === 'D') return n * 86_400_000
      return 60_000
    }

    const barMs = timeframeToMs(selectedKlineTimeframe.value)
    const expected = Math.max(0, Math.floor((range.end - range.start) / Math.max(1, barMs)))
    const pageSize = expected > MAX_FETCH_POINTS ? MAX_FETCH_POINTS : undefined

    // Yield once so "Loading..." renders before heavy mapping.
    await new Promise(r => setTimeout(r, 0))

    const [rows, rowsA, rowsB] = await Promise.all([
      getKlineData(
        sym,
        selectedKlineTimeframe.value,
        range.start,
        range.end,
        selectedKlineExchange.value,
        'CRYPTO',
        pageSize
      ),
      getKlineData(
        selectedSpreadLegA.value || spreadLegA.value || sym,
        selectedKlineTimeframe.value,
        range.start,
        range.end,
        selectedKlineExchange.value,
        'CRYPTO',
        pageSize
      ),
      getKlineData(
        selectedSpreadLegB.value || spreadLegB.value || sym,
        selectedKlineTimeframe.value,
        range.start,
        range.end,
        selectedKlineExchange.value,
        'CRYPTO',
        pageSize
      ),
    ])
    const klines = Array.isArray(rows) ? rows : []

    const parseTsMs = (v) => {
      if (v === null || v === undefined) return NaN
      if (typeof v === 'number') return v
      const s = String(v).trim()
      if (!s) return NaN
      // numeric string (ms)
      if (/^\d+$/.test(s)) return Number(s)
      // ISO string
      const t = Date.parse(s)
      return Number.isFinite(t) ? t : NaN
    }

    const normalized = klines
      .map(k => ({
        ts: parseTsMs(k.timestamp),
        o: Number(k.openPrice),
        h: Number(k.highPrice),
        l: Number(k.lowPrice),
        c: Number(k.closePrice),
      }))
      .filter(r => Number.isFinite(r.ts) && Number.isFinite(r.o) && Number.isFinite(r.h) && Number.isFinite(r.l) && Number.isFinite(r.c))
      .sort((a, b) => a.ts - b.ts)

    const downsample = (rows, maxPoints) => {
      if (!rows || rows.length <= maxPoints) {
        return rows.map(r => ({ x: r.ts, y: [r.o, r.h, r.l, r.c] }))
      }
      const step = Math.ceil(rows.length / maxPoints)
      const out = []
      for (let i = 0; i < rows.length; i += step) {
        const chunk = rows.slice(i, i + step)
        if (!chunk.length) continue
        const open = chunk[0].o
        const close = chunk[chunk.length - 1].c
        let high = -Infinity
        let low = Infinity
        for (const r of chunk) {
          if (r.h > high) high = r.h
          if (r.l < low) low = r.l
        }
        out.push({ x: chunk[chunk.length - 1].ts, y: [open, high, low, close] })
      }
      return out
    }

    const formatted = downsample(normalized, MAX_PLOT_POINTS)
    klineCandles.value = formatted
    if (!formatted.length) {
      klineError.value = t('backtest_report.kline_error_no_data')
    }

    if (!selectedSpreadLegA.value || !selectedSpreadLegB.value || selectedSpreadLegA.value === selectedSpreadLegB.value) {
      spreadHint.value = '缺少两条腿，无法计算价差。'
      return
    }

    const normalizeClose = (arr) => (Array.isArray(arr) ? arr : [])
      .map(k => ({
        ts: parseTsMs(k.timestamp),
        c: Number(k.closePrice),
      }))
      .filter(r => Number.isFinite(r.ts) && Number.isFinite(r.c) && r.c !== 0)
      .sort((a, b) => a.ts - b.ts)

    const legACloses = normalizeClose(rowsA)
    const legBCloses = normalizeClose(rowsB)
    if (!legACloses.length || !legBCloses.length) {
      spreadHint.value = '两腿K线数据不足，无法计算价差。'
      return
    }

    const toBucket = (ts) => Math.floor(ts / Math.max(1, barMs))
    const legBByBucket = new Map()
    for (const r of legBCloses) legBByBucket.set(toBucket(r.ts), r.c)

    const rawSpread = []
    for (const a of legACloses) {
      const bClose = legBByBucket.get(toBucket(a.ts))
      if (!Number.isFinite(bClose) || a.c === 0) continue
      const spread = computeStrategySpread(a.c, bClose)
      if (!Number.isFinite(spread)) continue
      rawSpread.push([a.ts, spread])
    }

    const downsampleLine = (rows, maxPoints) => {
      if (!rows || rows.length <= maxPoints) return rows
      const step = Math.ceil(rows.length / maxPoints)
      const out = []
      for (let i = 0; i < rows.length; i += step) {
        const chunk = rows.slice(i, i + step)
        if (!chunk.length) continue
        const ts = chunk[chunk.length - 1][0]
        const avg = chunk.reduce((acc, v) => acc + v[1], 0) / chunk.length
        out.push([ts, avg])
      }
      return out
    }

    spreadSeries.value = downsampleLine(rawSpread, MAX_PLOT_POINTS)
    if (!spreadSeries.value.length) {
      spreadHint.value = '两腿时间未对齐，无法计算价差。'
    }
  } catch (e) {
    klineError.value = e?.message || String(e)
  } finally {
    klineLoading.value = false
  }
}

const autoLoadKlineIfReady = async () => {
  // Auto render spread chart when report is loaded and symbols/range are ready.
  if (!reportData.value) return
  if (!selectedKlineSymbol.value) {
    selectedKlineSymbol.value = symbolPerformance.value?.[0]?.symbol || ''
  }
  if (!selectedSpreadLegA.value) {
    selectedSpreadLegA.value = spreadLegA.value || selectedKlineSymbol.value || ''
  }
  if (!selectedSpreadLegB.value) {
    selectedSpreadLegB.value = spreadLegB.value || symbolPerformance.value?.find(r => String(r?.symbol || '') !== selectedSpreadLegA.value)?.symbol || ''
  }
  if (!selectedKlineSymbol.value) return
  if (!backtestTimeRange.value) return
  await loadKline()
}

// Initialize default symbol whenever symbolPerformance changes.
watch(symbolPerformance, (rows) => {
  const first = rows?.[0]?.symbol || ''
  if (!selectedKlineSymbol.value && first) {
    selectedKlineSymbol.value = first
  }
}, { immediate: true })

watch([spreadSymbolOptions, spreadLegA, spreadLegB], ([opts, autoA, autoB]) => {
  if (!selectedSpreadLegA.value) {
    selectedSpreadLegA.value = autoA || opts?.[0] || ''
  }
  if (!selectedSpreadLegB.value) {
    selectedSpreadLegB.value = autoB || opts?.find(s => s !== selectedSpreadLegA.value) || opts?.[1] || ''
  }
}, { immediate: true })

const symbolPerformanceHeaders = computed(() => {
    if (symbolPerformance.value.length === 0) {
        return [];
    }
    const headers = Object.keys(symbolPerformance.value[0]);
    // Move symbol to the front
    const symbolKey = 'symbol';
    if (headers.includes(symbolKey)) {
        return [symbolKey, ...headers.filter(h => h !== symbolKey)];
    }
    return headers;
});

const formatTimestamp = (ts) => {
  if (!ts) return ts
  // Handle timestamp format: yyyyMMddHHmmss (14 digits)
  if (typeof ts === 'string' && ts.length === 14 && /^\d+$/.test(ts)) {
    const year = ts.substring(0, 4)
    const month = ts.substring(4, 6)
    const day = ts.substring(6, 8)
    const hour = ts.substring(8, 10)
    const minute = ts.substring(10, 12)
    const second = ts.substring(12, 14)
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
  // Handle numeric timestamp (Unix timestamp in milliseconds)
  if (typeof ts === 'number' || (typeof ts === 'string' && /^\d+$/.test(ts) && ts.length > 14)) {
    const date = new Date(parseInt(ts))
    return date.toLocaleString()
  }
  return ts
}

// Helper function for debugging data range
const getDataRange = (data) => {
  if (!data || data.length === 0) return { min: 'N/A', max: 'N/A' };
  const values = data.map(item => item[1]);
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
};

const trimReportPayload = (raw) => {
  if (!raw || typeof raw !== 'object') return raw
  const cloned = { ...raw }
  if (Array.isArray(cloned.orders) && cloned.orders.length > MAX_ORDERS_RENDER) {
    cloned.orders = cloned.orders.slice(cloned.orders.length - MAX_ORDERS_RENDER)
  }
  if (Array.isArray(cloned.trades) && cloned.trades.length > MAX_TRADES_RENDER) {
    cloned.trades = cloned.trades.slice(cloned.trades.length - MAX_TRADES_RENDER)
  }
  if (Array.isArray(cloned.spreadEvents) && cloned.spreadEvents.length > MAX_SPREAD_EVENTS_RENDER) {
    cloned.spreadEvents = sampleEvenly(cloned.spreadEvents, MAX_SPREAD_EVENTS_RENDER)
  }
  if (Array.isArray(cloned.indicatorSeries) && cloned.indicatorSeries.length > MAX_INDICATOR_POINTS_RENDER) {
    cloned.indicatorSeries = sampleEvenly(cloned.indicatorSeries, MAX_INDICATOR_POINTS_RENDER)
  }
  return cloned
}

</script> 