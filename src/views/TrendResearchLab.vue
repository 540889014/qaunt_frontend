<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6">
      <!-- 趋势得分配置 -->
      <section class="mb-4 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-3">趋势得分配置</h2>
        <div class="flex flex-wrap items-end gap-3 mb-2">
          <div class="flex items-center gap-2">
            <input id="use-optimized-lab" v-model="query.useOptimized" type="checkbox" class="rounded border-gray-300" />
            <label for="use-optimized-lab" class="text-sm text-gray-600 dark:text-gray-300">使用优化逻辑（4 根验证 / 板块 / RS 准入 / RSI 区间 / VSA upthrust / 123 buffer / 量比梯队 / ATR 过滤；不勾选为原始 2 根验证逻辑）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">信号阈值（≥此分才出 BUY/SELL_SEED，留空用服务端配置；最新行情扫描与实盘一致）</label>
            <input v-model.number="query.signalThreshold" type="number" min="0" max="200" step="1" placeholder="如 65" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28 mt-1" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">RS 准入 TopN（0=全部，&gt;0=仅前 N 可出信号，与实盘一致；用于最新行情扫描）</label>
            <input v-model.number="query.rsTopN" type="number" min="0" max="500" placeholder="20" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 mt-1" />
          </div>
          <button
            @click="loadScoreConfig"
            :disabled="configLoading"
            class="px-4 py-2 rounded-md bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {{ configLoading ? $t('trend_research.loading') : '从服务端刷新配置' }}
          </button>
        </div>
        <p v-if="scoreConfig" class="text-xs text-gray-500 dark:text-gray-400">当前服务端信号阈值: {{ scoreConfig.signalThreshold }}</p>
      </section>

      <div class="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.exchange') }}</label>
          <select v-model="query.exchange" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
            <option value="okx">OKX</option>
            <option value="binance">Binance</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.timeframe') }}</label>
          <select v-model="query.timeframe" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1H">1H</option>
            <option value="4H">4H</option>
            <option value="1D">1D</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.lookback_bars') }}</label>
          <input v-model.number="query.lookbackBars" type="number" min="120" max="20000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.symbol_limit') }}</label>
          <input v-model.number="query.symbolLimit" type="number" min="20" max="5000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-28" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.top_n') }}</label>
          <input v-model.number="query.topN" type="number" min="10" max="200" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.tp_pct') }}</label>
          <input
            v-model.number="query.tpPct"
            type="number"
            min="0.1"
            max="20"
            step="0.1"
            class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24 disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="query.useDynamicTp"
            :title="query.useDynamicTp ? '开启动态止盈时由止盈区间 [min,max] 决定，此值仅在不满足动态条件时兜底' : ''"
          />
        </div>
        <div class="flex items-center gap-2">
          <input id="use-dynamic-tp-lab" v-model="query.useDynamicTp" type="checkbox" class="rounded border-gray-300" />
          <label for="use-dynamic-tp-lab" class="text-sm text-gray-600 dark:text-gray-300">动态止盈（ATR 映射 [tpMin,tpMax]）</label>
        </div>
        <template v-if="query.useDynamicTp">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">止盈区间 min(%)</label>
            <input v-model.number="query.tpMin" type="number" min="0.1" max="20" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-20" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">止盈区间 max(%)</label>
            <input v-model.number="query.tpMax" type="number" min="0.1" max="50" step="0.1" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-20" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300">ATR 回看根数</label>
            <input v-model.number="query.atrLookback" type="number" min="20" max="2000" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-24" placeholder="200" />
          </div>
        </template>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">{{ $t('trend_research.coin_type') }}</label>
          <select v-model="query.coinType" class="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 min-w-36">
            <option v-for="opt in coinTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <button
          @click="runFullScan"
          :disabled="loading"
          class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ loading ? $t('trend_research.loading') : $t('trend_research.run_scan') }}
        </button>
        <button
          @click="runValidation"
          :disabled="loading"
          class="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {{ $t('trend_research.validate_trend') }}
        </button>
        <button
          @click="runScanLatestSignals"
          :disabled="latestSignalsLoading"
          class="px-4 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {{ latestSignalsLoading ? $t('trend_research.loading') : $t('trend_research.scan_latest_signals_btn') }}
        </button>
        <button
          @click="copyResearchData"
          class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {{ $t('trend_research.copy_research_data') }}
        </button>
        <router-link
          to="/trend-validation-report"
          class="px-4 py-2 rounded-md bg-slate-700 text-white hover:bg-slate-800"
        >
          {{ $t('nav.trend_validation_report') }}
        </router-link>
      </div>

      <div v-if="error" class="mb-4 text-red-600 dark:text-red-400">{{ error }}</div>
      <div v-if="researchCopyStatus" class="mb-4 text-sm" :class="researchCopyError ? 'text-red-600' : 'text-green-600'">
        {{ researchCopyStatus }}
      </div>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-3">{{ $t('trend_research.validation_summary') }}</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3 text-sm">
          <div><span class="text-gray-500">{{ $t('trend_research.validated_count') }}:</span> <span class="font-semibold">{{ validationSummary.total }}</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.hit_rate') }}:</span> <span class="font-semibold">{{ validationSummary.hitRate.toFixed(2) }}%</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.profit_rate') }}:</span> <span class="font-semibold text-green-600">{{ validationSummary.winRate.toFixed(2) }}%</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.loss_rate') }}:</span> <span class="font-semibold text-red-600">{{ validationSummary.lossRate.toFixed(2) }}%</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.avg_profit_pct') }}:</span> <span class="font-semibold text-green-600">{{ validationSummary.avgWinPct.toFixed(2) }}%</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.avg_loss_pct') }}:</span> <span class="font-semibold text-red-600">{{ validationSummary.avgLossPct.toFixed(2) }}%</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.total_profit_points') }}:</span> <span class="font-semibold text-green-600">{{ validationSummary.totalWinPoints.toFixed(2) }}</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.total_loss_points') }}:</span> <span class="font-semibold text-red-600">{{ validationSummary.totalLossPoints.toFixed(2) }}</span></div>
          <div><span class="text-gray-500">{{ $t('trend_research.median_max_profit_pct') }}:</span> <span class="font-semibold text-green-600">{{ validationSummary.medianMaxProfitPct.toFixed(2) }}%</span></div>
        </div>
      </section>

      <section v-if="regime" class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.market_regime') }}</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div><span class="text-gray-500">Regime:</span> <span class="font-semibold">{{ regime.regime }}</span></div>
          <div><span class="text-gray-500">Confidence:</span> {{ (regime.confidence * 100).toFixed(1) }}%</div>
          <div><span class="text-gray-500">Breadth:</span> {{ (regime.marketBreadthRatio * 100).toFixed(1) }}%</div>
          <div><span class="text-gray-500">BTC Vol:</span> {{ regime.btcVolatility?.toFixed(4) }}</div>
          <div><span class="text-gray-500">Dispersion:</span> {{ regime.sectorDispersion?.toFixed(4) }}</div>
        </div>
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ (regime.reasons || []).join(' | ') }}</div>
      </section>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.signal_factory') }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4">Symbol</th>
                <th class="py-2 pr-4">Sector</th>
                <th class="py-2 pr-4">Signal</th>
                <th class="py-2 pr-4">Score</th>
                <th class="py-2 pr-4">Change%</th>
                <th class="py-2 pr-4">RSI</th>
                <th class="py-2 pr-4">VolumeRatio</th>
                <th class="py-2 pr-4">{{ $t('trend_research.prediction') }}</th>
                <th class="py-2 pr-4">{{ $t('trend_research.validation_return') }}</th>
                <th class="py-2 pr-4">最大收益</th>
                <th class="py-2 pr-4">{{ $t('trend_research.validation_bars') }}</th>
                <th class="py-2 pr-4">验证起始close</th>
                <th class="py-2 pr-4">验证结束close</th>
                <th class="py-2 pr-4">{{ $t('trend_research.validation_result') }}</th>
                <th class="py-2 pr-4">Reasons</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in signals" :key="`${s.symbol}-${s.signalType}`" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-4">
                  <button class="text-blue-600 hover:underline" @click="openKline(s.symbol)">
                    {{ s.symbol }}
                  </button>
                </td>
                <td class="py-2 pr-4">{{ s.sector }}</td>
                <td class="py-2 pr-4">{{ signalTypeLabel(s.signalType) }}</td>
                <td class="py-2 pr-4">{{ s.score?.toFixed(2) }}</td>
                <td class="py-2 pr-4" :class="s.changePct >= 0 ? 'text-green-600' : 'text-red-600'">{{ s.changePct?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ s.rsi?.toFixed(1) }}</td>
                <td class="py-2 pr-4">{{ s.volumeRatio?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ s.predictionDirection }}</td>
                <td class="py-2 pr-4" :class="directionalReturnPct(s) >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ Number.isFinite(directionalReturnPct(s)) ? directionalReturnPct(s).toFixed(2) + '%' : 'N/A' }}
                </td>
                <td class="py-2 pr-4 text-green-600">
                  {{ Number.isFinite(Number(s.validationMaxProfitPct)) ? Number(s.validationMaxProfitPct).toFixed(2) + '%' : 'N/A' }}
                </td>
                <td class="py-2 pr-4">{{ s.validationBars }}</td>
                <td class="py-2 pr-4">{{ Number.isFinite(Number(s.validationStartClose)) ? Number(s.validationStartClose).toFixed(6) : 'N/A' }}</td>
                <td class="py-2 pr-4">{{ Number.isFinite(Number(s.validationEndClose)) ? Number(s.validationEndClose).toFixed(6) : 'N/A' }}</td>
                <td class="py-2 pr-4" :class="s.validationMatched ? 'text-green-600' : 'text-red-600'">
                  {{ s.validationMatched ? $t('trend_research.hit') : $t('trend_research.miss') }}
                </td>
                <td class="py-2 pr-4">{{ (s.reasons || []).join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.sector_radar') }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4">Sector</th>
                <th class="py-2 pr-4">Symbols</th>
                <th class="py-2 pr-4">AvgReturn%</th>
                <th class="py-2 pr-4">Median%</th>
                <th class="py-2 pr-4">FlowScore</th>
                <th class="py-2 pr-4">Leader</th>
                <th class="py-2 pr-4">Lagger</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in sectors" :key="r.sector" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-4">{{ r.sector }}</td>
                <td class="py-2 pr-4">{{ r.symbolCount }}</td>
                <td class="py-2 pr-4">{{ r.avgReturnPct?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ r.medianReturnPct?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ r.flowScore?.toFixed(2) }}</td>
                <td class="py-2 pr-4">
                  <button class="text-blue-600 hover:underline" @click="openKline(r.leaderSymbol)">
                    {{ r.leaderSymbol }}
                  </button>
                  <span> ({{ r.leaderReturnPct?.toFixed(2) }}%)</span>
                </td>
                <td class="py-2 pr-4">
                  <button class="text-blue-600 hover:underline" @click="openKline(r.laggerSymbol)">
                    {{ r.laggerSymbol }}
                  </button>
                  <span> ({{ r.laggerReturnPct?.toFixed(2) }}%)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 class="text-lg font-semibold mb-2">{{ $t('trend_research.relative_strength') }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4">Symbol</th>
                <th class="py-2 pr-4">Sector</th>
                <th class="py-2 pr-4">RS Score</th>
                <th class="py-2 pr-4">Alpha BTC%</th>
                <th class="py-2 pr-4">Alpha ETH%</th>
                <th class="py-2 pr-4">Ratio BTC%</th>
                <th class="py-2 pr-4">Ratio ETH%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in relativeStrength" :key="r.symbol" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-4">
                  <button class="text-blue-600 hover:underline" @click="openKline(r.symbol)">
                    {{ r.symbol }}
                  </button>
                </td>
                <td class="py-2 pr-4">{{ r.sector }}</td>
                <td class="py-2 pr-4">{{ r.rsScore?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ r.alphaVsBtcPct?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ r.alphaVsEthPct?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ r.ratioReturnVsBtcPct?.toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ r.ratioReturnVsEthPct?.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-if="klineModal.visible" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-900 w-full max-w-6xl rounded-lg shadow-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold">{{ klineModal.symbol }} {{ $t('trend_research.kline') }}</h3>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700" @click="copyKlineJson">
              {{ $t('trend_research.copy_json') }}
            </button>
            <button class="px-3 py-1 rounded bg-gray-700 text-white" @click="closeKlineModal">{{ $t('trend_research.close') }}</button>
          </div>
        </div>
        <div v-if="klineModal.loading" class="text-sm text-gray-500 py-10">{{ $t('trend_research.loading') }}</div>
        <div v-else-if="klineModal.error" class="text-sm text-red-600 py-10">{{ klineModal.error }}</div>
        <div v-else-if="klineModal.data.length === 0" class="text-sm text-gray-500 py-10">No Kline Data</div>
        <div v-else>
          <div class="text-xs text-gray-500 mb-2">points: {{ klineModal.data.length }}</div>
          <div v-if="klineModal.gapWarning" class="text-xs text-amber-600 mb-2">{{ klineModal.gapWarning }}</div>
          <div v-if="klineModal.copyStatus" class="text-xs mb-2" :class="klineModal.copyError ? 'text-red-600' : 'text-green-600'">
            {{ klineModal.copyStatus }}
          </div>
          <apexcharts type="candlestick" :height="460" :options="klineOptions" :series="klineSeries" />
        </div>
      </div>
    </div>

    <!-- 最新行情信号扫描结果弹框 -->
    <div v-if="latestSignalsModalVisible" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="closeLatestSignalsModal">
      <div class="bg-white dark:bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-lg shadow-lg flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h3 class="text-lg font-semibold">{{ $t('trend_research.latest_signals_section') }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('trend_research.latest_signals_hint') }}</p>
            <p v-if="latestSignalsDataChecksum" class="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">dataChecksum: {{ latestSignalsDataChecksum }}</p>
          </div>
          <button class="px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-600" @click="closeLatestSignalsModal">
            {{ $t('trend_research.close') }}
          </button>
        </div>
        <div class="overflow-auto p-4">
          <div v-if="latestSignals.length === 0" class="text-sm text-gray-500 py-8">暂无合适合约</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                  <th class="py-2 pr-4 w-12 text-center">序号</th>
                  <th class="py-2 pr-4">Symbol</th>
                  <th class="py-2 pr-4">Sector</th>
                  <th class="py-2 pr-4">Signal</th>
                  <th class="py-2 pr-4">Score</th>
                  <th class="py-2 pr-4">Change%</th>
                  <th class="py-2 pr-4">RSI</th>
                  <th class="py-2 pr-4">VolumeRatio</th>
                  <th class="py-2 pr-4">{{ $t('trend_research.prediction') }}</th>
                  <th class="py-2 pr-4">Reasons</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, idx) in latestSignals" :key="`latest-${s.symbol}-${s.signalType}`" class="border-b border-gray-100 dark:border-gray-800">
                  <td class="py-2 pr-4 w-12 text-center text-gray-500">{{ idx + 1 }}</td>
                  <td class="py-2 pr-4">
                    <button class="text-blue-600 hover:underline" @click="openKlineFromLatestModal(s.symbol)">
                      {{ s.symbol }}
                    </button>
                  </td>
                  <td class="py-2 pr-4">{{ s.sector }}</td>
                  <td class="py-2 pr-4">{{ signalTypeLabel(s.signalType) }}</td>
                  <td class="py-2 pr-4">{{ s.score?.toFixed(2) }}</td>
                  <td class="py-2 pr-4" :class="s.changePct >= 0 ? 'text-green-600' : 'text-red-600'">{{ s.changePct?.toFixed(2) }}</td>
                  <td class="py-2 pr-4">{{ s.rsi?.toFixed(1) }}</td>
                  <td class="py-2 pr-4">{{ s.volumeRatio?.toFixed(2) }}</td>
                  <td class="py-2 pr-4">{{ s.predictionDirection }}</td>
                  <td class="py-2 pr-4">{{ (s.reasons || []).join(', ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { getTrendScoreConfig, getTrendResearchScan, getTrendResearchLatest, getTrendScanLatestSignals, getKlineData } from '@/api'

const loading = ref(false)
const latestSignalsLoading = ref(false)
const latestSignals = ref([])
const latestSignalsDataChecksum = ref('')
const latestSignalsModalVisible = ref(false)
const error = ref('')
const signals = ref([])
const sectors = ref([])
const relativeStrength = ref([])
const regime = ref(null)
const researchCopyStatus = ref('')
const researchCopyError = ref(false)
const klineModal = ref({
  visible: false,
  symbol: '',
  loading: false,
  error: '',
  gapWarning: '',
  rawRows: [],
  data: [],
  startTime: 0,
  endTime: 0,
  copyStatus: '',
  copyError: false,
})
const klineSeries = computed(() => [{ data: klineModal.value.data }])
const klineOptions = {
  chart: {
    animations: { enabled: false },
    toolbar: { show: true },
    zoom: { enabled: true, type: 'x' },
  },
  xaxis: {
    type: 'datetime',
    labels: { datetimeUTC: false },
  },
  yaxis: {
    tooltip: { enabled: true },
  },
  tooltip: {
    x: { format: 'yyyy-MM-dd HH:mm:ss' },
  },
}

const query = ref({
  exchange: 'okx',
  timeframe: '1H',
  lookbackBars: 500,
  symbolLimit: 2000,
  topN: 50,
  tpPct: 2.0,
  coinType: '',
  signalThreshold: undefined,
  rsTopN: 20,
  useOptimized: true,
  useDynamicTp: false,
  tpMin: 1.0,
  tpMax: 9.0,
  atrLookback: 200,
})
const scoreConfig = ref(null)
const configLoading = ref(false)

const coinTypeOptions = [
  { label: 'ALL', value: '' },
  { label: 'MAINSTREAM', value: 'MAINSTREAM' },
  { label: 'LAYER1', value: 'LAYER1' },
  { label: 'SOLANA', value: 'SOLANA' },
  { label: 'AI', value: 'AI' },
  { label: 'DEFI', value: 'DEFI' },
  { label: 'MEME', value: 'MEME' },
  { label: 'RWA', value: 'RWA' },
  { label: 'GAMEFI', value: 'GAMEFI' },
]

const validationSummary = computed(() => {
  const rows = (signals.value || []).filter((s) => Number.isFinite(Number(s.validationReturnPct)))
  const total = rows.length
  if (!total) {
    return {
      total: 0,
      hitRate: 0,
      winRate: 0,
      lossRate: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      totalWinPoints: 0,
      totalLossPoints: 0,
      medianMaxProfitPct: 0,
      avgReturnPct: 0,
    }
  }
  const hits = rows.filter((r) => r.validationMatched === true).length
  const wins = rows.filter((r) => directionalReturnPct(r) > 0)
  const losses = rows.filter((r) => directionalReturnPct(r) < 0)
  const maxProfitVals = rows
    .map((r) => Number(r.validationMaxProfitPct))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)
  let medianMaxProfitPct = 0
  if (maxProfitVals.length > 0) {
    const mid = Math.floor(maxProfitVals.length / 2)
    medianMaxProfitPct = maxProfitVals.length % 2 === 0
      ? (maxProfitVals[mid - 1] + maxProfitVals[mid]) / 2
      : maxProfitVals[mid]
  }
  const sum = (arr) => arr.reduce((acc, r) => acc + directionalReturnPct(r), 0)
  return {
    total,
    hitRate: (hits / total) * 100,
    winRate: (wins.length / total) * 100,
    lossRate: (losses.length / total) * 100,
    avgWinPct: wins.length ? sum(wins) / wins.length : 0,
    avgLossPct: losses.length ? sum(losses) / losses.length : 0,
    totalWinPoints: sum(wins),
    totalLossPoints: Math.abs(sum(losses)),
    medianMaxProfitPct,
    avgReturnPct: sum(rows) / total,
  }
})

const directionalReturnPct = (row) => {
  const raw = Number(row?.validationReturnPct)
  if (!Number.isFinite(raw)) return NaN
  const direction = String(row?.predictionDirection || '').toUpperCase()
  return direction === 'DOWN' ? -raw : raw
}

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

const runFullScan = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { ...query.value }
    if (params.signalThreshold == null || params.signalThreshold === '') delete params.signalThreshold
    params.useOptimized = query.value.useOptimized !== false
    if (!params.useDynamicTp) {
      delete params.useDynamicTp
      delete params.tpMin
      delete params.tpMax
      delete params.atrLookback
    }
    const data = await getTrendResearchScan(params)
    signals.value = Array.isArray(data?.signals) ? data.signals : []
    sectors.value = Array.isArray(data?.sectors) ? data.sectors : []
    relativeStrength.value = Array.isArray(data?.relativeStrength) ? data.relativeStrength : []
    regime.value = data?.regime || null
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const loadLatestSnapshot = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await getTrendResearchLatest({
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      tpPct: query.value.tpPct,
    })
    signals.value = Array.isArray(data?.signals) ? data.signals : []
    sectors.value = Array.isArray(data?.sectors) ? data.sectors : []
    relativeStrength.value = Array.isArray(data?.relativeStrength) ? data.relativeStrength : []
    regime.value = data?.regime || null
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const runValidation = async () => {
  await runFullScan()
  researchCopyStatus.value = '验证完成，结果已更新到信号实验室表格'
  researchCopyError.value = false
}

function intervalMsForTimeframe(tf) {
  if (!tf) return 3600000
  const s = String(tf).toUpperCase()
  if (s === '15M') return 15 * 60 * 1000
  if (s === '30M') return 30 * 60 * 1000
  if (s === '1H') return 3600000
  if (s === '4H') return 4 * 60 * 60 * 1000
  if (s === '1D') return 24 * 60 * 60 * 1000
  return 3600000
}

const runScanLatestSignals = async () => {
  latestSignalsLoading.value = true
  error.value = ''
  try {
    const intervalMs = intervalMsForTimeframe(query.value.timeframe)
    const asOfMs = Math.floor(Date.now() / intervalMs) * intervalMs
    const list = await getTrendScanLatestSignals({
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      lookbackBars: query.value.lookbackBars,
      symbolLimit: query.value.symbolLimit,
      topN: query.value.topN,
      coinType: query.value.coinType || undefined,
      asOfMs,
      signalThreshold: query.value.signalThreshold != null && query.value.signalThreshold !== '' ? Number(query.value.signalThreshold) : undefined,
      rsTopN: query.value.rsTopN != null && query.value.rsTopN !== '' ? Number(query.value.rsTopN) : undefined,
    })
    const raw = list?.data != null ? list.data : list
    if (raw && typeof raw === 'object' && Array.isArray(raw.signals)) {
      latestSignals.value = raw.signals
      latestSignalsDataChecksum.value = raw.dataChecksum != null ? String(raw.dataChecksum) : ''
    } else {
      latestSignals.value = Array.isArray(raw) ? raw : []
      latestSignalsDataChecksum.value = ''
    }
    latestSignalsModalVisible.value = true
  } catch (e) {
    error.value = e?.message || String(e)
    latestSignals.value = []
  } finally {
    latestSignalsLoading.value = false
  }
}

const closeLatestSignalsModal = () => {
  latestSignalsModalVisible.value = false
}

const openKlineFromLatestModal = (symbol) => {
  closeLatestSignalsModal()
  openKline(symbol)
}

const signalTypeLabel = (v) => {
  const map = {
    BUY_SEED: '强势买入',
    WATCH_UP: '上涨观察',
    SELL_SEED: '强势看跌',
    WATCH_DOWN: '下跌观察',
    WATCH: '观察',
    IGNORE: '忽略',
  }
  return map[v] || v || '-'
}

const openKline = async (symbol) => {
  const endTime = Date.now()
  const barMs = timeframeToMs(query.value.timeframe)
  const lookbackBars = Math.max(1, Number(query.value.lookbackBars || 500))
  const startTime = endTime - lookbackBars * barMs
  klineModal.value = {
    visible: true,
    symbol,
    loading: true,
    error: '',
    gapWarning: '',
    rawRows: [],
    data: [],
    startTime,
    endTime,
    copyStatus: '',
    copyError: false,
  }
  try {
    const rows = await getKlineData(
      symbol,
      query.value.timeframe,
      startTime,
      endTime,
      query.value.exchange,
      'CRYPTO',
      5000
    )
    const normalized = Array.isArray(rows) ? rows.map((k) => {
      const ts = parseTs(k.timestamp)
      const o = toNum(k.openPrice ?? k.open_price)
      const h = toNum(k.highPrice ?? k.high_price)
      const l = toNum(k.lowPrice ?? k.low_price)
      const c = toNum(k.closePrice ?? k.close_price)
      return { x: ts, y: [o, h, l, c] }
    }).filter((p) => Number.isFinite(p.x) && p.y.every(Number.isFinite)) : []
    normalized.sort((a, b) => a.x - b.x)
    const gapWarning = analyzeKlineGaps(normalized, barMs)
    klineModal.value.rawRows = Array.isArray(rows) ? rows : []
    klineModal.value.data = normalized
    klineModal.value.gapWarning = gapWarning
  } catch (e) {
    klineModal.value.error = e?.message || String(e)
  } finally {
    klineModal.value.loading = false
  }
}

const closeKlineModal = () => {
  klineModal.value.visible = false
}

const copyResearchData = async () => {
  try {
    const payload = {
      query: { ...query.value },
      signalFactory: signals.value,
      sectorRadar: sectors.value,
      relativeStrength: relativeStrength.value,
      marketRegime: regime.value,
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    researchCopyStatus.value = '研究数据复制成功'
    researchCopyError.value = false
    setTimeout(() => { researchCopyStatus.value = '' }, 2500)
  } catch (e) {
    researchCopyStatus.value = `复制失败: ${e?.message || e}`
    researchCopyError.value = true
  }
}

const copyKlineJson = async () => {
  try {
    const payload = {
      symbol: klineModal.value.symbol,
      exchange: query.value.exchange,
      timeframe: query.value.timeframe,
      lookbackBars: query.value.lookbackBars,
      startTime: klineModal.value.startTime,
      endTime: klineModal.value.endTime,
      rawRows: klineModal.value.rawRows,
      chartPoints: klineModal.value.data,
    }
    const text = JSON.stringify(payload, null, 2)
    await navigator.clipboard.writeText(text)
    klineModal.value.copyStatus = 'JSON copied to clipboard'
    klineModal.value.copyError = false
  } catch (e) {
    klineModal.value.copyStatus = e?.message || 'Copy failed'
    klineModal.value.copyError = true
  }
}

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

const parseTs = (v) => {
  if (v == null) return NaN
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000
  const s = String(v).trim()
  if (/^\d{13}$/.test(s)) return Number(s)
  if (/^\d{10}$/.test(s)) return Number(s) * 1000
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? t : NaN
}

const timeframeToMs = (tf) => {
  const key = String(tf || '').trim().toLowerCase()
  const map = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  }
  return map[key] || 60 * 60 * 1000
}

const analyzeKlineGaps = (points, barMs) => {
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(barMs) || barMs <= 0) return ''
  let missingBars = 0
  let maxGapBars = 0
  for (let i = 1; i < points.length; i++) {
    const prevTs = Number(points[i - 1]?.x)
    const curTs = Number(points[i]?.x)
    const delta = curTs - prevTs
    if (!Number.isFinite(delta) || delta <= barMs) continue
    const gapBars = Math.floor(delta / barMs) - 1
    if (gapBars > 0) {
      missingBars += gapBars
      if (gapBars > maxGapBars) maxGapBars = gapBars
    }
  }
  if (missingBars <= 0) return ''
  return `检测到K线缺口：约缺失 ${missingBars} 根（最大连续缺 ${maxGapBars} 根）。这通常是数据库同步缺口，趋势计算使用的二进制数据可能更完整。`
}

onMounted(async () => {
  await loadLatestSnapshot()
})
</script>
