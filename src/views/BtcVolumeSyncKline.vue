<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">成交量节拍 K 线（BTC 主时钟 · BTCVOLSYNC）</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        以 <strong>BTC 1m 累计成交量</strong>划拍；默认对目录下<strong>全部</strong>
        <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">*_1m.jbar</code>
        合约各写一根对齐合成 K 线。从品种某分钟无数据时用上一分钟收盘、成交量 0（便于矩阵对齐）。输出
        <code class="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800">binance/volume_sync/&lt;SYMBOL&gt;_BTCVOLSYNC.jbar</code>。
      </p>
      <div class="mb-6 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100/90">
        <p class="font-medium mb-1">构建偏慢时的加速思路</p>
        <ul class="list-disc pl-5 space-y-1 text-amber-800 dark:text-amber-200/90">
          <li>关闭「全市场合约」，只跑 <strong>Master + 查看 symbol</strong> 两个品种（快速试跑）。</li>
          <li>缩短时间区间；或适当<strong>提高成交量阈值倍率</strong>，减少合成根数与入库量。</li>
          <li>勾选<strong>仅写 .jbar（跳过入库）</strong>：不写 PostgreSQL，只生成内存结果与 .jbar，通常明显更快。</li>
          <li>服务端可在 <code class="text-xs">application.yml</code> 中调高 <code class="text-xs">binance.history.volume-sync-parallelism</code>（如 32～64，视 CPU/磁盘而定）。</li>
        </ul>
      </div>

      <!-- Build -->
      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">构建 / 重算</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">起始时间</label>
            <input v-model="timeRange.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">结束时间</label>
            <input v-model="timeRange.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>

          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主品种（Master）</label>
            <input v-model="buildForm.masterSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>

          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ADV 回看天数</label>
            <input v-model.number="buildForm.advLookbackDays" type="number" min="3" max="60" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>

          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">期望日合成根数</label>
            <input v-model.number="buildForm.expectedBarsPerDay" type="number" min="48" max="2880" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>

          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">成交量阈值倍率</label>
            <input v-model.number="buildForm.volumeThresholdMultiplier" type="number" min="0.5" max="20" step="0.1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>

          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">runId（用于入库去重/覆盖）</label>
            <input v-model="buildForm.runId" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="可填固定值以便反复覆盖" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 mt-4">
          <label class="inline-flex items-center gap-2">
            <input v-model="buildForm.scanAllSymbols" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-700 dark:text-gray-200">全市场合约（扫描目录全部 *_1m.jbar）</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="buildForm.replaceRun" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-700 dark:text-gray-200">replaceRun（先删再写）</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="buildForm.writeJbar" type="checkbox" class="rounded border-gray-300" checked />
            <span class="text-sm text-gray-700 dark:text-gray-200">写出 BTCVOLSYNC .jbar</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="buildForm.writeDatabase" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-700 dark:text-gray-200">写入数据库（关闭则仅写 .jbar，跳过 PG 入库，更快）</span>
          </label>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            关闭「全市场」时仅构建 Master + 下方「查看 symbol」两个合约（快速试跑）。
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <button
            @click="doBuild"
            :disabled="buildLoading"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ buildLoading ? '构建中…' : '构建 / 重算' }}
          </button>
          <button
            @click="doLoadBars"
            :disabled="queryLoading"
            class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {{ queryLoading ? '加载中…' : '查询并绘图' }}
          </button>
        </div>
      </section>

      <!-- Query -->
      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">读取并绘图</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">查看 symbol</label>
            <input v-model="queryForm.symbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">limit</label>
            <input v-model.number="queryForm.limit" type="number" min="100" max="50000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div class="sm:col-span-2 flex items-end">
            <div class="w-full">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">当前使用与「构建」相同的时间范围</div>
              <div class="text-sm text-gray-800 dark:text-gray-200">
                {{ timeRange.startAt || '—' }} → {{ timeRange.endAt || '—' }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
        <div v-if="meta" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          已加载 {{ meta.count ?? (meta.bars?.length ?? 0) }} 根；jbar: <span class="font-mono break-all">{{ meta.jbarPath || '—' }}</span>
        </div>
      </section>

      <!-- Chart indicators -->
      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">图表指标</h2>

        <!-- 均线：总开关 + 逐条配置 -->
        <div class="mb-4">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <label class="inline-flex items-center gap-2">
              <input id="ma-master" v-model="indicatorForm.showMa" type="checkbox" class="rounded border-gray-300" />
              <span class="text-sm font-medium text-gray-800 dark:text-gray-200">显示均线</span>
            </label>
            <button
              type="button"
              class="text-sm px-2 py-1 rounded border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-40"
              :disabled="!indicatorForm.showMa"
              @click="addMaRow"
            >
              + 添加均线
            </button>
          </div>
          <div
            v-if="indicatorForm.showMa"
            class="rounded-md border border-gray-200 dark:border-gray-600 divide-y divide-gray-200 dark:divide-gray-600 overflow-hidden"
          >
            <div
              v-for="(row, idx) in indicatorForm.maRows"
              :key="row.id"
              class="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 bg-gray-50/80 dark:bg-gray-900/40"
            >
              <label class="inline-flex items-center gap-1.5 shrink-0">
                <input v-model="row.enabled" type="checkbox" class="rounded border-gray-300" />
                <span class="text-xs text-gray-500 dark:text-gray-400">显示</span>
              </label>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">周期</span>
                <input
                  v-model.number="row.period"
                  type="number"
                  min="2"
                  max="500"
                  class="w-20 px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-sm"
                  :disabled="!row.enabled"
                />
              </div>
              <select
                v-model="row.type"
                class="px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-sm"
                :disabled="!row.enabled"
              >
                <option value="sma">SMA</option>
                <option value="ema">EMA</option>
                <option value="aema">AEMA(连击加速)</option>
              </select>
              <button
                type="button"
                class="text-xs text-red-600 hover:underline ml-auto"
                :disabled="indicatorForm.maRows.length <= 1"
                @click="removeMaRow(idx)"
              >
                删除
              </button>
            </div>
          </div>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">关闭后图上不画任何均线（配置仍保留）。</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">AEMA 加速系数</label>
            <input
              v-model.number="indicatorForm.maAccelerationFactor"
              type="number"
              min="0"
              max="2"
              step="0.1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">图表高度</label>
            <input
              v-model.number="indicatorForm.chartHeight"
              type="number"
              min="500"
              max="900"
              step="10"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="rsi-volsync" v-model="indicatorForm.showRsi" type="checkbox" class="rounded border-gray-300" />
            <label for="rsi-volsync" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 RSI</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">RSI 周期</label>
            <input
              v-model.number="indicatorForm.rsiPeriod"
              type="number"
              min="2"
              max="200"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showRsi"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">RSI 阻尼系数</label>
            <input
              v-model.number="indicatorForm.rsiDampeningFactor"
              type="number"
              min="0"
              max="2"
              step="0.05"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showRsi"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">RSI 反转加速系数</label>
            <input
              v-model.number="indicatorForm.rsiReversalFactor"
              type="number"
              min="0"
              max="5"
              step="0.1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showRsi"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="bb-volsync" v-model="indicatorForm.showBollinger" type="checkbox" class="rounded border-gray-300" />
            <label for="bb-volsync" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示布林带</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">布林周期</label>
            <input
              v-model.number="indicatorForm.bollingerPeriod"
              type="number"
              min="2"
              max="200"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showBollinger"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">布林倍数</label>
            <input
              v-model.number="indicatorForm.bollingerMult"
              type="number"
              min="0.5"
              max="6"
              step="0.1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showBollinger"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="st-volsync" v-model="indicatorForm.showSuperTrend" type="checkbox" class="rounded border-gray-300" />
            <label for="st-volsync" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 SuperTrend</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">SuperTrend ATR 周期（Wilder）</label>
            <input
              v-model.number="indicatorForm.superTrendAtrPeriod"
              type="number"
              min="2"
              max="200"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSuperTrend"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">SuperTrend 乘数</label>
            <input
              v-model.number="indicatorForm.superTrendMultiplier"
              type="number"
              min="0.5"
              max="20"
              step="0.5"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSuperTrend"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="macd-volsync" v-model="indicatorForm.showMacd" type="checkbox" class="rounded border-gray-300" />
            <label for="macd-volsync" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 MACD</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">MACD 快线</label>
            <input
              v-model.number="indicatorForm.macdFastPeriod"
              type="number"
              min="2"
              max="200"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showMacd"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">MACD 慢线</label>
            <input
              v-model.number="indicatorForm.macdSlowPeriod"
              type="number"
              min="3"
              max="300"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showMacd"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">MACD 信号线</label>
            <input
              v-model.number="indicatorForm.macdSignalPeriod"
              type="number"
              min="2"
              max="100"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showMacd"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">AMACD 连击加速步长</label>
            <input
              v-model.number="indicatorForm.macdBoostFactor"
              type="number"
              min="0"
              max="0.3"
              step="0.01"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showMacd"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">AMACD 反转释放系数</label>
            <input
              v-model.number="indicatorForm.macdReversalFactor"
              type="number"
              min="0"
              max="3"
              step="0.05"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showMacd"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="atr-volsync" v-model="indicatorForm.showAtr" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-volsync" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ATR（N）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ATR 周期 N（对 TR 的 EMA）</label>
            <input
              v-model.number="indicatorForm.atrPeriod"
              type="number"
              min="2"
              max="200"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAtr"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="atr-norm-volsync" v-model="indicatorForm.atrNormalize" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-norm-volsync" class="text-sm font-medium text-gray-800 dark:text-gray-200">ATR 滚动 Min-Max 归一化到 0～1</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">归一化窗口（根数）</label>
            <input
              v-model.number="indicatorForm.atrNormPeriod"
              type="number"
              min="2"
              max="2000"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAtr || !indicatorForm.atrNormalize"
            />
          </div>
        </div>

        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          均线、布林、<strong>SuperTrend</strong>（ATR 为 Wilder/RMA，与下方 ATR 子图的 EMA 版可不同）、RSI、MACD 与 ATR：RSI/MACD 主要基于收盘价；<strong>ATR</strong> 子图用 TR 的 N 周期 EMA。勾选「归一化」时对 ATR 做滚动 Min-Max 映射到 0～1。
          本页 RSI 使用 <strong>Spring Reversal</strong>（与砖石图页一致）。成交量节拍为非等时间轴 K 线，指标仍按序列逐根计算。K 线过多时重绘可能略慢。
        </p>
      </section>

      <!-- Chart -->
      <section class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">K 线图</h2>
        <div v-if="bars.length">
          <JbarKlineChart
            :bars="bars"
            :height="Math.max(500, Math.min(900, Number(indicatorForm.chartHeight) || 620))"
            :price-decimals="4"
            :ma-lines="maLinesForChart"
            :ma-acceleration-factor="indicatorForm.maAccelerationFactor"
            :show-bollinger="indicatorForm.showBollinger"
            :bollinger-period="indicatorForm.bollingerPeriod"
            :bollinger-mult="indicatorForm.bollingerMult"
            :show-rsi="indicatorForm.showRsi"
            :rsi-period="indicatorForm.rsiPeriod"
            rsi-smoothing="spring-reversal"
            :rsi-dampening-factor="indicatorForm.rsiDampeningFactor"
            :rsi-reversal-factor="indicatorForm.rsiReversalFactor"
            :show-macd="indicatorForm.showMacd"
            :macd-fast-period="indicatorForm.macdFastPeriod"
            :macd-slow-period="indicatorForm.macdSlowPeriod"
            :macd-signal-period="indicatorForm.macdSignalPeriod"
            :macd-boost-factor="indicatorForm.macdBoostFactor"
            :macd-reversal-factor="indicatorForm.macdReversalFactor"
            :show-atr="indicatorForm.showAtr"
            :atr-period="indicatorForm.atrPeriod"
            :atr-normalize="indicatorForm.atrNormalize"
            :atr-norm-period="indicatorForm.atrNormPeriod"
            :show-super-trend="indicatorForm.showSuperTrend"
            :super-trend-atr-period="indicatorForm.superTrendAtrPeriod"
            :super-trend-multiplier="indicatorForm.superTrendMultiplier"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-8">
          暂无数据。请先点击「构建 / 重算」或确保 volume-sync jbar 已存在。
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import { buildBtcVolumeSyncKline, fetchBtcVolumeSyncKlineBars } from '@/api'

const error = ref('')
const meta = ref(null)
const bars = ref([])

const buildLoading = ref(false)
const queryLoading = ref(false)

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const now = Date.now()
const defaultEnd = new Date(now - 60 * 1000)
const defaultStart = new Date(now - 7 * 24 * 60 * 60 * 1000)

const timeRange = ref({
  startAt: toLocalInputValue(defaultStart),
  endAt: toLocalInputValue(defaultEnd),
})

const buildForm = ref({
  masterSymbol: 'BTCUSDT',
  advLookbackDays: 10,
  expectedBarsPerDay: 288,
  volumeThresholdMultiplier: 2.0,
  replaceRun: false,
  runId: '',
  writeJbar: true,
  /** false 时后端不写 volume_sync_kline 表，仅聚合并写 .jbar（明显加快） */
  writeDatabase: true,
  /** 默认 true：与后端 allSymbols 一致，生成全部合约的 volume-sync */
  scanAllSymbols: true,
})

const queryForm = ref({
  symbol: 'BTCUSDT',
  limit: 5000,
})

let nextMaRowId = 4
/** 图表指标：与砖石图 K 线页一致（均线 / 布林 / Spring RSI / AMACD / ATR） */
const indicatorForm = ref({
  showMa: true,
  maRows: [
    { id: 1, period: 5, type: 'sma', enabled: true },
    { id: 2, period: 20, type: 'sma', enabled: true },
    { id: 3, period: 60, type: 'sma', enabled: true },
  ],
  showBollinger: true,
  bollingerPeriod: 20,
  bollingerMult: 2,
  maAccelerationFactor: 0.5,
  chartHeight: 620,
  showRsi: true,
  rsiPeriod: 14,
  rsiDampeningFactor: 0.5,
  rsiReversalFactor: 0.45,
  showMacd: true,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  macdBoostFactor: 0.05,
  macdReversalFactor: 0.45,
  showAtr: true,
  atrPeriod: 20,
  atrNormalize: true,
  atrNormPeriod: 100,
  showSuperTrend: true,
  superTrendAtrPeriod: 10,
  superTrendMultiplier: 3,
})

/** 传给图表：总开关关闭 → 空数组；否则只传勾选且有效的均线 */
const maLinesForChart = computed(() => {
  if (!indicatorForm.value.showMa) return []
  return indicatorForm.value.maRows
    .filter((r) => r.enabled)
    .map((r) => ({
      period: Math.max(2, Math.min(500, Math.floor(Number(r.period)) || 2)),
      type: r.type === 'ema' ? 'ema' : r.type === 'aema' ? 'aema' : 'sma',
      enabled: true,
    }))
})

function addMaRow() {
  indicatorForm.value.maRows.push({
    id: nextMaRowId++,
    period: 30,
    type: 'sma',
    enabled: true,
  })
}

function removeMaRow(index) {
  if (indicatorForm.value.maRows.length <= 1) return
  indicatorForm.value.maRows.splice(index, 1)
}

function toTimestampMs(v) {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

async function doBuild() {
  error.value = ''
  const startMs = toTimestampMs(timeRange.value.startAt)
  const endMs = toTimestampMs(timeRange.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }

  buildLoading.value = true
  try {
    const master = (buildForm.value.masterSymbol || 'BTCUSDT').trim().toUpperCase()
    const viewSym = (queryForm.value.symbol || master).trim().toUpperCase()

    const body = {
      startTimeMs: startMs,
      endTimeMs: endMs,
      advLookbackDays: buildForm.value.advLookbackDays,
      expectedBarsPerDay: buildForm.value.expectedBarsPerDay,
      volumeThresholdMultiplier: buildForm.value.volumeThresholdMultiplier,
      masterSymbol: master,
      replaceRun: buildForm.value.replaceRun,
      runId: buildForm.value.runId || undefined,
      writeJbar: buildForm.value.writeJbar,
      writeDatabase: buildForm.value.writeDatabase,
    }
    if (buildForm.value.scanAllSymbols) {
      body.allSymbols = true
    } else {
      body.allSymbols = false
      body.symbols = Array.from(new Set([master, viewSym]))
    }

    await buildBtcVolumeSyncKline(body)
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    buildLoading.value = false
  }
}

async function doLoadBars() {
  error.value = ''
  meta.value = null
  bars.value = []

  const startMs = toTimestampMs(timeRange.value.startAt)
  const endMs = toTimestampMs(timeRange.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }

  const sym = (queryForm.value.symbol || 'BTCUSDT').trim().toUpperCase()
  queryLoading.value = true
  try {
    const data = await fetchBtcVolumeSyncKlineBars({
      symbol: sym,
      startMs,
      endMs,
      limit: queryForm.value.limit,
    })
    meta.value = data || null
    bars.value = Array.isArray(data?.bars) ? data.bars : []
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
    bars.value = []
  } finally {
    queryLoading.value = false
  }
}
</script>

