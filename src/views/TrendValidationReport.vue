<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6">
      <!-- 趋势得分配置（得分阈值可覆盖） -->
      <section class="mb-4 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-3">趋势得分配置</h2>
        <div class="flex flex-wrap items-end gap-3 mb-2">
          <div class="flex items-center gap-2">
            <input id="use-optimized-report" v-model="query.useOptimized" type="checkbox" class="rounded border-gray-300" />
            <label for="use-optimized-report" class="text-sm text-gray-600 dark:text-gray-300">使用优化逻辑（不勾选为原始 2 根验证逻辑）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">信号阈值覆盖（留空用服务端配置）</label>
            <input v-model.number="query.signalThreshold" type="number" min="0" max="200" step="1" placeholder="如 65" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28 mt-1" />
          </div>
          <button
            @click="loadScoreConfig"
            :disabled="configLoading"
            class="px-4 py-2 rounded-md bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {{ configLoading ? $t('trend_research.loading') : '从服务端刷新配置' }}
          </button>
        </div>
      </section>

      <!-- 查询与重算参数 -->
      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-4">验证参数与历史</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-end mb-4">
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">{{ $t('trend_research.exchange') }}</label>
          <select v-model="query.exchange" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full min-w-0">
            <option value="okx">OKX</option>
            <option value="binance">Binance</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">{{ $t('trend_research.timeframe') }}</label>
          <select v-model="query.timeframe" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full min-w-0">
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1H">1H</option>
            <option value="4H">4H</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">Limit(0=全部)</label>
          <input v-model.number="query.limit" type="number" min="0" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">单边手续费(%)</label>
          <input v-model.number="query.feeRatePct" type="number" min="0" max="1" step="0.001" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">重算止盈点(%)</label>
          <input
            v-model.number="query.recalcTpPct"
            type="number"
            min="0.1"
            max="20"
            step="0.1"
            class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32 disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="query.useDynamicTp"
            :title="query.useDynamicTp ? '开启动态止盈时由止盈区间 [min,max] 决定，此值仅在不满足动态条件时兜底' : ''"
          />
        </div>
        <div class="flex items-center gap-2 pb-1">
          <input id="use-dynamic-tp-report" v-model="query.useDynamicTp" type="checkbox" class="rounded border-gray-300" />
          <label for="use-dynamic-tp-report" class="text-sm text-gray-600 dark:text-gray-300">动态止盈</label>
        </div>
        <template v-if="query.useDynamicTp">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">止盈区间 min(%)</label>
            <input v-model.number="query.tpMin" type="number" min="0.1" max="20" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">止盈区间 max(%)</label>
            <input v-model.number="query.tpMax" type="number" min="0.1" max="50" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">ATR 回看根数</label>
            <input v-model.number="query.atrLookback" type="number" min="20" max="2000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28" placeholder="200" />
          </div>
        </template>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">开始时间</label>
          <input v-model="query.startAt" type="datetime-local" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">结束时间</label>
          <input v-model="query.endAt" type="datetime-local" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">回看K线数</label>
          <input v-model.number="query.lookbackBars" type="number" min="120" max="20000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-32" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">验证样本上限</label>
          <input v-model.number="query.recalcSampleLimit" type="number" min="0" max="5000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full max-w-32" placeholder="10" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">RS 准入 TopN</label>
          <input v-model.number="query.rsTopN" type="number" min="0" max="5000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full max-w-32" placeholder="20" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">资金份数</label>
          <input v-model.number="query.positionShares" type="number" min="1" max="100" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full max-w-24" />
        </div>
        </div>
        <div class="flex flex-wrap gap-3 pt-2">
          <button @click="loadHistory" :disabled="loading" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {{ loading ? $t('trend_research.loading') : $t('trend_research.refresh_history') }}
          </button>
          <button @click="recalculateHistory" :disabled="loading" class="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50">
            {{ loading ? $t('trend_research.loading') : '重算历史(快照)' }}
          </button>
          <button @click="recalculateHistoryByRange" :disabled="loading" class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {{ loading ? $t('trend_research.loading') : '按区间逐K重算(二进制)' }}
          </button>
        </div>
      </section>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow border border-amber-200/80 dark:border-amber-900/50">
        <h2 class="text-lg font-semibold mb-2">参数网格调优</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
          使用上方<strong>开始/结束时间</strong>与交易所、周期、优化逻辑、动态止盈等与单次「按区间重算」相同。
          可调维度建议：<strong>tpPct</strong> 1.5～5 步长 0.25～0.5；<strong>signalThreshold</strong> 50～80 步长 5；
          <strong>rsTopN</strong> 0/10/20/50；<strong>topN</strong>（每锚点信号条数）5～30；<strong>lookbackBars</strong> 300～800 步长 50；
          动态止盈时可扫 <strong>atrLookback</strong>、<strong>tpMin/tpMax</strong>。组合数 = 各轴点数相乘，勿过大；每组合会整段重算，宜 <strong>anchorLimit 12～24</strong>。
        </p>
        <div class="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">网格锚点数上限</label>
            <input v-model.number="gridAnchorLimit" type="number" min="4" max="200" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">最大组合数</label>
            <input v-model.number="gridMaxCombinations" type="number" min="1" max="500" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" />
          </div>
          <button type="button" @click="addGridAxis" class="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">+ 扫描维度</button>
        </div>
        <div v-for="(ax, idx) in gridAxes" :key="'gax-' + idx" class="flex flex-wrap gap-2 items-center mb-2 p-2 rounded bg-gray-50 dark:bg-gray-900/50">
          <input v-model="ax.enabled" type="checkbox" class="rounded" />
          <select v-model="ax.param" class="px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-sm w-40">
            <option value="tpPct">tpPct 静态止盈%</option>
            <option value="signalThreshold">signalThreshold</option>
            <option value="rsTopN">rsTopN</option>
            <option value="topN">topN 验证样本条数</option>
            <option value="lookbackBars">lookbackBars</option>
            <option value="atrLookback">atrLookback</option>
            <option value="tpMin">tpMin (动态)</option>
            <option value="tpMax">tpMax (动态)</option>
          </select>
          <span class="text-sm text-gray-500">min</span>
          <input v-model.number="ax.min" type="number" step="any" class="px-2 py-1 border rounded w-20 bg-white dark:bg-gray-800 text-sm" />
          <span class="text-sm text-gray-500">max</span>
          <input v-model.number="ax.max" type="number" step="any" class="px-2 py-1 border rounded w-20 bg-white dark:bg-gray-800 text-sm" />
          <span class="text-sm text-gray-500">step</span>
          <input v-model.number="ax.step" type="number" step="any" class="px-2 py-1 border rounded w-16 bg-white dark:bg-gray-800 text-sm" />
          <button type="button" v-if="gridAxes.length > 1" @click="removeGridAxis(idx)" class="text-sm text-red-600 hover:underline">移除</button>
        </div>
        <div class="flex flex-wrap gap-3 mt-3">
          <button @click="runParamGrid" :disabled="gridLoading || loading" class="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
            {{ gridLoading ? '网格回测中…' : '运行参数网格' }}
          </button>
          <span v-if="gridNotice" class="text-sm text-amber-700 dark:text-amber-400 self-center">{{ gridNotice }}</span>
        </div>
        <div v-if="gridRows.length" class="mt-4 overflow-x-auto">
          <table class="min-w-full text-xs border border-gray-200 dark:border-gray-600">
            <thead>
              <tr class="text-left bg-gray-100 dark:bg-gray-800">
                <th class="p-2">参数组合</th>
                <th class="p-2">锚点数</th>
                <th class="p-2">样本合计</th>
                <th class="p-2">均命中%</th>
                <th class="p-2">均盈利占比%</th>
                <th class="p-2">均收益%</th>
                <th class="p-2">盈利点合计</th>
                <th class="p-2">亏损点合计</th>
                <th class="p-2">净点差</th>
                <th class="p-2">止盈触发合计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(gr, gi) in gridRows" :key="'gr-' + gi" class="border-t border-gray-100 dark:border-gray-700">
                <td class="p-2 font-mono whitespace-pre-wrap max-w-md">{{ formatGridParams(gr.params) }}</td>
                <td class="p-2">{{ gr.anchorCount }}</td>
                <td class="p-2">{{ gr.sumSampleCount }}</td>
                <td class="p-2">{{ num(gr.avgHitRatePct) }}</td>
                <td class="p-2">{{ num(gr.avgProfitRatePct) }}</td>
                <td class="p-2">{{ num(gr.avgReturnPct) }}</td>
                <td class="p-2 text-green-600">{{ num(gr.sumTotalProfitPoints) }}</td>
                <td class="p-2 text-red-600">{{ num(gr.sumTotalLossPoints) }}</td>
                <td class="p-2 font-semibold" :class="gridNet(gr) >= 0 ? 'text-green-600' : 'text-red-600'">{{ num(gridNet(gr)) }}</td>
                <td class="p-2">{{ gr.sumTpTriggered }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-if="error" class="mb-4 text-red-600 dark:text-red-400">{{ error }}</div>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.validation_history_chart') }}</h2>
        <apexcharts v-if="chartSeries.length" type="line" height="380" :options="chartOptions" :series="chartSeries" />
        <div v-else class="text-sm text-gray-500 py-6">No history data</div>
      </section>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">整体预期盈利（净值曲线）</h2>
        <apexcharts v-if="equitySeries.length" type="line" height="320" :options="equityChartOptions" :series="equitySeries" />
        <div v-else class="text-sm text-gray-500 py-6">No equity data</div>
      </section>

      <section class="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.validation_history_table') }}</h2>
        <div class="mb-3 text-sm flex flex-wrap gap-4">
          <div>
            <span class="text-gray-500">{{ $t('trend_research.validated_count') }}(合计):</span>
            <span class="font-semibold ml-1">{{ tableTotals.sampleCount }}</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('trend_research.tp_triggered_count') }}(合计):</span>
            <span class="font-semibold ml-1">{{ tableTotals.tpTriggeredCountTotal }}</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('trend_research.total_profit_points') }}(合计):</span>
            <span class="font-semibold text-green-600 ml-1">{{ num(tableTotals.totalProfitPoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('trend_research.total_loss_points') }}(合计):</span>
            <span class="font-semibold text-red-600 ml-1">{{ num(tableTotals.totalLossPoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">挂单总手续费(估算):</span>
            <span class="font-semibold text-amber-600 ml-1">{{ num(tableTotals.totalFeePoints) }}%</span>
          </div>
          <div>
            <span class="text-gray-500">最终预期盈利（盈利总点数 - 亏损总点数 - 手续费）:</span>
            <span class="font-semibold ml-1" :class="tableTotals.expectedNetProfit >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ num(tableTotals.expectedNetProfit) }}%
            </span>
          </div>
          <div>
            <span class="text-gray-500">整体预期盈利（1/{{ effectivePositionShares }}仓位）:</span>
            <span class="font-semibold ml-1" :class="tableTotals.overallExpectedNetProfit >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ num(tableTotals.overallExpectedNetProfit) }}%
            </span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4">计算时间</th>
                <th class="py-2 pr-4">{{ $t('trend_research.timeframe') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.scanned_contract_count') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.validated_count') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.total_profit_points') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.total_loss_points') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.median_max_profit_pct') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.avg_max_loss_pct') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.hit_rate') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.tp_triggered_count') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.actual_scan_contracts') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="r in tableRowsDesc" :key="r.ts">
                <tr class="border-b border-gray-100 dark:border-gray-800">
                  <td class="py-2 pr-4">{{ formatTs(r.ts) }}</td>
                  <td class="py-2 pr-4">{{ r.timeframe }}</td>
                  <td class="py-2 pr-4">
                    {{ r.scannedContractCount ?? '—' }}
                    <button type="button" class="ml-1 px-2 py-1 text-xs font-medium rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800 disabled:opacity-50 cursor-pointer" :disabled="loadingScan === keyFor(r)" @click="fetchAndToggleScanRecords(r)">
                      {{ loadingScan === keyFor(r) ? '...' : $t('trend_research.query_scan_records') }}
                    </button>
                  </td>
                  <td class="py-2 pr-4">{{ r.sampleCount }}</td>
                  <td class="py-2 pr-4 text-green-600">{{ num(r.totalProfitPoints) }}</td>
                  <td class="py-2 pr-4 text-red-600">{{ num(r.totalLossPoints) }}</td>
                  <td class="py-2 pr-4 text-green-600">{{ num(r.medianMaxProfitPct) }}%</td>
                  <td class="py-2 pr-4 text-red-600">{{ num(r.avgMaxLossPct) }}%</td>
                  <td class="py-2 pr-4">{{ num(r.hitRatePct) }}%</td>
                  <td class="py-2 pr-4">{{ r.tpTriggeredCount ?? '—' }}</td>
                  <td class="py-2 pr-4">
                    <button type="button" class="px-2 py-1 text-xs font-medium rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800 disabled:opacity-50 cursor-pointer" :disabled="loadingScan === keyFor(r)" @click="fetchAndToggleScanRecords(r)">
                      {{ loadingScan === keyFor(r) ? '加载中...' : (expandedTs === keyFor(r) ? $t('trend_research.collapse_scan') : $t('trend_research.expand_scan')) }}
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedTs === keyFor(r)" class="bg-gray-50 dark:bg-gray-800/50">
                  <td colspan="11" class="py-3 px-4">
                    <div v-if="scanRecordsMap[keyFor(r)] === undefined" class="text-gray-500 text-sm">点击上方「展开」或「查询」加载预期与实际信号</div>
                    <template v-else>
                      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('trend_research.expected_signals_title') }}</h4>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">计算时间 {{ formatTs(r.ts) }}：指标用「开始时间 {{ formatTs(lastBarStartForResearch(r)) }} 及之前」的 K 线，{{ formatTs(r.ts) }} 及之后共 {{ query.useOptimized !== false ? 4 : 2 }} 根算收益</p>
                          <div v-if="!expectedSignalsMap[keyFor(r)] || expectedSignalsMap[keyFor(r)].length === 0" class="text-amber-600 dark:text-amber-400 text-sm">该时间点无预期快照（trend_scan_result）</div>
                          <div v-else class="overflow-x-auto max-h-64 overflow-y-auto">
                            <table class="min-w-full text-xs border border-gray-200 dark:border-gray-600">
                              <thead>
                                <tr class="text-left border-b border-gray-200 dark:border-gray-600">
                                  <th class="py-1 pr-2 w-8">序号</th>
                                  <th class="py-1 pr-2">合约</th>
                                  <th class="py-1 pr-2">信号类型</th>
                                  <th class="py-1 pr-2">score</th>
                                  <th class="py-1 pr-2">change_pct</th>
                                  <th class="py-1 pr-2">rsi</th>
                                  <th class="py-1 pr-2">volume_ratio</th>
                                  <th class="py-1 pr-2">止盈点(%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="(rec, idx) in sortByAbsScore(expectedSignalsMap[keyFor(r)])" :key="'exp-' + idx" class="border-b border-gray-100 dark:border-gray-700">
                                  <td class="py-1 pr-2">{{ idx + 1 }}</td>
                                  <td class="py-1 pr-2">{{ rec.symbol }}</td>
                                  <td class="py-1 pr-2">{{ rec.signalType }}</td>
                                  <td class="py-1 pr-2">{{ rec.score != null ? Number(rec.score).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.changePct != null ? Number(rec.changePct).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.rsi != null ? Number(rec.rsi).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.volumeRatio != null ? Number(rec.volumeRatio).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.validationTpPct != null ? Number(rec.validationTpPct).toFixed(2) : '—' }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div>
                          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('trend_research.actual_signals_title') }}</h4>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">与研究端同一数据截面：查询 last_closed_bar_ts = {{ formatTs(lastBarStartForResearch(r)) }}（即「开始时间 {{ formatTs(lastBarStartForResearch(r)) }} 及之前」的 scan 记录）</p>
                          <div v-if="!scanRecordsMap[keyFor(r)] || scanRecordsMap[keyFor(r)].length === 0" class="text-amber-600 dark:text-amber-400 text-sm">该时间点暂无扫描记录（xasset_scm_trend_scan_record）</div>
                          <div v-else class="overflow-x-auto max-h-64 overflow-y-auto">
                            <table class="min-w-full text-xs border border-gray-200 dark:border-gray-600">
                              <thead>
                                <tr class="text-left border-b border-gray-200 dark:border-gray-600">
                                  <th class="py-1 pr-2 w-8">序号</th>
                                  <th class="py-1 pr-2">合约</th>
                                  <th class="py-1 pr-2">信号类型</th>
                                  <th class="py-1 pr-2">score</th>
                                  <th class="py-1 pr-2">change_pct</th>
                                  <th class="py-1 pr-2">rsi</th>
                                  <th class="py-1 pr-2">volume_ratio</th>
                                  <th class="py-1 pr-2">止盈点(%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="(rec, idx) in sortByAbsScore(scanRecordsMap[keyFor(r)])" :key="'act-' + idx" class="border-b border-gray-100 dark:border-gray-700">
                                  <td class="py-1 pr-2">{{ idx + 1 }}</td>
                                  <td class="py-1 pr-2">{{ rec.symbol }}</td>
                                  <td class="py-1 pr-2">{{ rec.signalType }}</td>
                                  <td class="py-1 pr-2">{{ rec.score != null ? Number(rec.score).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.changePct != null ? Number(rec.changePct).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.rsi != null ? Number(rec.rsi).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.volumeRatio != null ? Number(rec.volumeRatio).toFixed(2) : '—' }}</td>
                                  <td class="py-1 pr-2">{{ rec.tpPct != null ? Number(rec.tpPct).toFixed(2) : '—' }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </template>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { getTrendScoreConfig, getTrendValidationHistory, getTrendScanRecords, getTrendExpectedSignals, postTrendValidationGrid } from '@/api'

const gridLoading = ref(false)
const gridRows = ref([])
const gridNotice = ref('')
const gridAnchorLimit = ref(20)
const gridMaxCombinations = ref(60)
const gridAxes = ref([
  { enabled: true, param: 'tpPct', min: 1.5, max: 3.5, step: 0.5 },
  { enabled: false, param: 'signalThreshold', min: 55, max: 70, step: 5 },
])

const addGridAxis = () => {
  gridAxes.value.push({ enabled: true, param: 'signalThreshold', min: 60, max: 75, step: 5 })
}
const removeGridAxis = (idx) => {
  if (gridAxes.value.length > 1) gridAxes.value.splice(idx, 1)
}
const formatGridParams = (p) => {
  if (!p || typeof p !== 'object') return ''
  const skip = new Set(['exchange', 'timeframe', 'anchorLimit'])
  return Object.entries(p)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
}
const gridNet = (gr) =>
  (Number(gr.sumTotalProfitPoints) || 0) - (Number(gr.sumTotalLossPoints) || 0)

const runParamGrid = async () => {
  const st = toTimestampMs(query.value.startAt)
  const et = toTimestampMs(query.value.endAt)
  if (!st || !et || et <= st) {
    error.value = '参数网格需要有效的开始/结束时间'
    return
  }
  const axes = gridAxes.value
    .filter((a) => a.enabled)
    .map((a) => ({
      param: a.param,
      min: Number(a.min),
      max: Number(a.max),
      step: Number(a.step) || 0.1,
    }))
  if (!axes.length) {
    error.value = '请至少勾选一条扫描维度'
    return
  }
  gridLoading.value = true
  gridNotice.value = ''
  error.value = ''
  gridRows.value = []
  try {
    const body = {
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      startTime: st,
      endTime: et,
      anchorLimit: Math.max(4, Math.min(200, Number(gridAnchorLimit.value) || 20)),
      lookbackBars: Math.max(120, Number(query.value.lookbackBars) || 500),
      symbolLimit: Number(query.value.symbolLimit) || 0,
      topN: Math.max(0, Math.floor(Number(query.value.recalcSampleLimit) || 10)),
      rsTopN: Math.max(0, Math.floor(Number(query.value.rsTopN) || 20)),
      useOptimized: query.value.useOptimized !== false,
      useDynamicTp: !!query.value.useDynamicTp,
      tpMin: Number(query.value.tpMin) || 1,
      tpMax: Number(query.value.tpMax) || 9,
      atrLookback: Number(query.value.atrLookback) || 200,
      baseTpPct: Number(query.value.recalcTpPct) || 2,
      maxCombinations: Math.max(1, Math.min(500, Number(gridMaxCombinations.value) || 60)),
      axes,
    }
    if (query.value.signalThreshold != null && query.value.signalThreshold !== '') {
      body.baseSignalThreshold = Number(query.value.signalThreshold)
    }
    const res = await postTrendValidationGrid(body)
    const payload = res?.data?.data ?? res?.data ?? res
    gridRows.value = Array.isArray(payload?.rows) ? payload.rows : []
    gridNotice.value = payload?.notice || ''
    if (payload?.truncated) gridNotice.value += '（已截断）'
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    gridLoading.value = false
  }
}

const loading = ref(false)
const configLoading = ref(false)
const scoreConfig = ref(null)
const error = ref('')
const rows = ref([])
const expandedTs = ref(null)
const scanRecordsMap = ref({})
const expectedSignalsMap = ref({})
const loadingScan = ref(null)

const keyFor = (row) => String(row?.ts ?? '')

/** 两表统一排序：按 score 绝对值降序（强信号在前），用于预期/实际对比 */
function sortByAbsScore(list) {
  if (!list || !list.length) return []
  return [...list].sort((a, b) => {
    const absA = Math.abs(Number(a?.score) || 0)
    const absB = Math.abs(Number(b?.score) || 0)
    return absB - absA
  })
}

/** 周期对应的 K 线间隔（毫秒），用于推算实际扫描用的 last_closed_bar_ts */
function getBucketMs(timeframe) {
  const tf = (timeframe || '1H').trim().toUpperCase()
  if (tf === '5M') return 5 * 60 * 1000
  if (tf === '15M') return 15 * 60 * 1000
  if (tf === '30M') return 30 * 60 * 1000
  if (tf === '1H') return 60 * 60 * 1000
  if (tf === '2H') return 2 * 60 * 60 * 1000
  if (tf === '4H') return 4 * 60 * 60 * 1000
  return 60 * 60 * 1000
}

/** 研究端新逻辑：计算时间 19:00 = 指标用 19:00 之前的 K 线（即开始时间 18:00 及之前），19:00 及之后共 evalBars 根算收益 */
function lastBarStartForResearch(row, useOptimized) {
  const bucketMs = getBucketMs(row?.timeframe || '1H')
  return Number(row?.ts ?? 0) - bucketMs
}
/** 实盘：最后一根参与计算的 K 线开始时间 = 计算时间 - 1×周期（last_closed_bar_ts） */
function lastBarStartForActual(row) {
  const bucketMs = getBucketMs(row?.timeframe || '1H')
  return Number(row?.ts ?? 0) - bucketMs
}

const fetchAndToggleScanRecords = async (row) => {
  const key = keyFor(row)
  if (expandedTs.value === key && scanRecordsMap.value[key] !== undefined) {
    expandedTs.value = null
    return
  }
  loadingScan.value = key
  error.value = ''
  const calculatedAtMs = Number(row.ts)
  if (!Number.isFinite(calculatedAtMs)) {
    error.value = '计算时间(ts)无效'
    scanRecordsMap.value = { ...scanRecordsMap.value, [key]: [] }
    expectedSignalsMap.value = { ...expectedSignalsMap.value, [key]: [] }
    expandedTs.value = key
    loadingScan.value = null
    return
  }
  const timeframe = row.timeframe || '1H'
  const exchange = row.exchange || query.value.exchange || 'okx'
  const expectedParams = { calculatedAtMs, exchange, timeframe }
  if (query.value.signalThreshold != null && query.value.signalThreshold !== '') expectedParams.signalThreshold = Number(query.value.signalThreshold)
  if (query.value.useOptimized != null) expectedParams.useOptimized = !!query.value.useOptimized
  if (query.value.useDynamicTp) {
    expectedParams.useDynamicTp = true
    if (query.value.tpMin != null) expectedParams.tpMin = Number(query.value.tpMin)
    if (query.value.tpMax != null) expectedParams.tpMax = Number(query.value.tpMax)
    if (query.value.atrLookback != null && query.value.atrLookback > 0) expectedParams.atrLookback = Number(query.value.atrLookback)
  }
  const sampleLimit = Number(query.value.recalcSampleLimit)
  if (Number.isFinite(sampleLimit) && sampleLimit >= 0) expectedParams.topN = Math.floor(sampleLimit)
  const rsTopN = Number(query.value.rsTopN)
  if (Number.isFinite(rsTopN) && rsTopN > 0) expectedParams.rsTopN = Math.floor(rsTopN)
  // 实际扫描信号按「研究端指标截止时间」查：last_closed_bar_ts = 计算时间 - 1×周期（指标用该时间及之前的 K 线），与左侧同一数据截面；includeTpPct 时带回止盈点(%)
  const researchLastBarTs = lastBarStartForResearch(row)
  const scanParams = { lastClosedBarTs: researchLastBarTs, timeframe, includeTpPct: true, exchange }
  if (query.value.useDynamicTp) {
    scanParams.useDynamicTp = true
    if (query.value.tpMin != null) scanParams.tpMin = Number(query.value.tpMin)
    if (query.value.tpMax != null) scanParams.tpMax = Number(query.value.tpMax)
    if (query.value.atrLookback != null && query.value.atrLookback > 0) scanParams.atrLookback = Number(query.value.atrLookback)
  } else if (query.value.recalcTpPct != null && Number(query.value.recalcTpPct) > 0) {
    scanParams.tpPct = Number(query.value.recalcTpPct)
  }
  try {
    const [actualRes, expectedRes] = await Promise.all([
      getTrendScanRecords(scanParams),
      getTrendExpectedSignals(expectedParams)
    ])
    const actualList = Array.isArray(actualRes) ? actualRes : (actualRes?.data ?? [])
    const expectedList = Array.isArray(expectedRes) ? expectedRes : (expectedRes?.data ?? [])
    scanRecordsMap.value = { ...scanRecordsMap.value, [key]: actualList }
    expectedSignalsMap.value = { ...expectedSignalsMap.value, [key]: expectedList }
    expandedTs.value = key
  } catch (e) {
    error.value = e?.message || String(e)
    scanRecordsMap.value = { ...scanRecordsMap.value, [key]: [] }
    expectedSignalsMap.value = { ...expectedSignalsMap.value, [key]: [] }
    expandedTs.value = key
  } finally {
    loadingScan.value = null
  }
}
const query = ref({
  exchange: 'okx',
  timeframe: '1H',
  limit: 0,
  feeRatePct: 0.05,
  recalcTpPct: 2.0,
  startAt: '',
  endAt: '',
  lookbackBars: 500,
  symbolLimit: 0,
  topN: 0,
  recalcSampleLimit: 10,
  rsTopN: 20,
  positionShares: 20,
  signalThreshold: undefined,
  useOptimized: true,
  useDynamicTp: false,
  tpMin: 1.0,
  tpMax: 9.0,
  atrLookback: 200,
})

const loadScoreConfig = async () => {
  configLoading.value = true
  try {
    const data = await getTrendScoreConfig()
    if (data && typeof data === 'object') {
      scoreConfig.value = data
      if (data.signalThreshold != null) query.value.signalThreshold = data.signalThreshold
    }
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    configLoading.value = false
  }
}

const loadHistory = async (withRecalc = false, byRange = false) => {
  loading.value = true
  error.value = ''
  try {
    const params = {
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      limit: query.value.limit,
      useOptimized: query.value.useOptimized !== false,
    }
    if (query.value.signalThreshold != null && query.value.signalThreshold !== '') {
      params.signalThreshold = Number(query.value.signalThreshold)
    }
    // 验证样本上限、RS 准入 TopN：与页面上配置统一
    const sampleLimit = Number(query.value.recalcSampleLimit)
    if (Number.isFinite(sampleLimit) && sampleLimit >= 0) {
      params.topN = Math.floor(sampleLimit)
    }
    const rsTopN = Number(query.value.rsTopN)
    if (Number.isFinite(rsTopN) && rsTopN > 0) {
      params.rsTopN = Math.floor(rsTopN)
    }
    if (withRecalc) {
      params.tpPct = query.value.recalcTpPct
    } else if (query.value.recalcTpPct != null && Number(query.value.recalcTpPct) > 0) {
      params.tpPct = query.value.recalcTpPct
    }
    if (query.value.useDynamicTp) {
      params.useDynamicTp = true
      if (query.value.tpMin != null) params.tpMin = Number(query.value.tpMin)
      if (query.value.tpMax != null) params.tpMax = Number(query.value.tpMax)
      if (query.value.atrLookback != null && query.value.atrLookback > 0) params.atrLookback = Number(query.value.atrLookback)
    }
    if (byRange) {
      const startTime = toTimestampMs(query.value.startAt)
      const endTime = toTimestampMs(query.value.endAt)
      if (!startTime || !endTime || endTime <= startTime) {
        throw new Error('请选择正确的开始/结束时间，且结束时间要大于开始时间')
      }
      params.startTime = startTime
      params.endTime = endTime
      params.lookbackBars = Math.max(120, Number(query.value.lookbackBars) || 500)
      params.symbolLimit = Number(query.value.symbolLimit) || 0
      params.tpPct = query.value.recalcTpPct
    }
    const data = await getTrendValidationHistory(params)
    rows.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const recalculateHistory = async () => {
  await loadHistory(true)
}

const recalculateHistoryByRange = async () => {
  await loadHistory(true, true)
}

const chartSeries = computed(() => ([
  { name: '整体命中率', data: rows.value.map(r => [r.ts, Number(r.hitRatePct)]) },
  { name: '盈利占比', data: rows.value.map(r => [r.ts, Number(r.profitRatePct)]) },
  { name: '亏损占比', data: rows.value.map(r => [r.ts, Number(r.lossRatePct)]) },
  { name: '盈利总点数', data: rows.value.map(r => [r.ts, Number(r.totalProfitPoints)]) },
  { name: '亏损总点数', data: rows.value.map(r => [r.ts, Number(r.totalLossPoints)]) },
]))

const chartOptions = {
  chart: { toolbar: { show: true }, animations: { enabled: false } },
  xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
  yaxis: [
    {
      min: 0,
      max: 100,
      labels: { formatter: (v) => `${Number(v).toFixed(1)}%` },
      title: { text: '比例(%)' },
    },
    {
      opposite: true,
      labels: { formatter: (v) => Number(v).toFixed(2) },
      title: { text: '点数' },
    },
  ],
  stroke: { width: [2, 2, 2, 2, 2], curve: 'straight' },
  tooltip: {
    shared: true,
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
    y: {
      formatter: (v, { seriesIndex }) => {
        if (seriesIndex <= 2) return `${Number(v).toFixed(2)}%`
        return Number(v).toFixed(2)
      },
    },
  },
}

const effectivePositionShares = computed(() => {
  const n = Number(query.value.positionShares)
  return Number.isFinite(n) && n >= 1 ? Math.min(100, Math.floor(n)) : 20
})

const equitySeries = computed(() => {
  const sorted = [...rows.value].sort((a, b) => Number(a.ts) - Number(b.ts))
  const feeRatePct = Math.max(0, Number(query.value.feeRatePct) || 0)
  const divisor = effectivePositionShares.value
  let cumulative = 0
  const data = sorted.map((r) => {
    const sampleCount = Number(r.sampleCount) || 0
    const profit = Number(r.totalProfitPoints) || 0
    const loss = Number(r.totalLossPoints) || 0
    const fee = sampleCount * feeRatePct * 2
    const stepNetOverall = (profit - loss - fee) / divisor
    cumulative += stepNetOverall
    return [Number(r.ts), cumulative]
  })
  return [{ name: '整体预期盈利(累计)', data }]
})

const tableRowsDesc = computed(() => [...rows.value].sort((a, b) => Number(b.ts) - Number(a.ts)))

const equityChartOptions = {
  chart: { toolbar: { show: true }, animations: { enabled: false } },
  xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
  yaxis: {
    labels: { formatter: (v) => `${Number(v).toFixed(2)}%` },
    title: { text: '累计收益(%)' },
  },
  stroke: { width: 2, curve: 'straight' },
  colors: ['#059669'],
  tooltip: {
    shared: false,
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
    y: { formatter: (v) => `${Number(v).toFixed(2)}%` },
  },
}

const tableTotals = computed(() => {
  const sampleCount = rows.value.reduce((acc, r) => acc + (Number(r.sampleCount) || 0), 0)
  const tpTriggeredCountTotal = rows.value.reduce((acc, r) => acc + (Number(r.tpTriggeredCount) || 0), 0)
  const totalProfitPoints = rows.value.reduce((acc, r) => acc + (Number(r.totalProfitPoints) || 0), 0)
  const totalLossPoints = rows.value.reduce((acc, r) => acc + (Number(r.totalLossPoints) || 0), 0)
  const feeRatePct = Math.max(0, Number(query.value.feeRatePct) || 0)
  // One contract per sample, round trip (open + close): two-sided fee.
  const totalFeePoints = sampleCount * feeRatePct * 2
  const expectedNetProfit = totalProfitPoints - totalLossPoints - totalFeePoints
  const divisor = effectivePositionShares.value
  const overallExpectedNetProfit = expectedNetProfit / divisor
  return { sampleCount, tpTriggeredCountTotal, totalProfitPoints, totalLossPoints, totalFeePoints, expectedNetProfit, overallExpectedNetProfit }
})

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}
const formatTs = (ts) => {
  const n = Number(ts)
  if (!Number.isFinite(n)) return 'N/A'
  const d = new Date(n)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const toTimestampMs = (datetimeLocal) => {
  if (!datetimeLocal) return 0
  const ms = new Date(datetimeLocal).getTime()
  return Number.isFinite(ms) ? ms : 0
}

onMounted(loadHistory)
</script>
