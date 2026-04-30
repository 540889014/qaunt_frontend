<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {{ isFreeBenchmarkPage ? '币安常规 K 线：自由选择 ABO 基准' : '币安常规 K 线（日历周期 · 二进制 .jbar）' }}
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        从本地 <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">data/history/binance/</code> 读取
        <code class="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800">&lt;SYMBOL&gt;_&lt;interval&gt;.jbar</code>
        （如 <span class="font-mono">BTCUSDT_1h.jbar</span>），与砖石图页相同的
        <strong>JbarKlineChart</strong> 组件与均线 / 布林 / SuperTrend / RSI / AMACD / ATR 指标。
        <template v-if="isFreeBenchmarkPage">
          本页可单独指定 <strong>ABO 基准合约</strong>（不再固定 BTCUSDT）。
        </template>
        请先通过
        <router-link to="/binance-history-download" class="text-indigo-600 dark:text-indigo-400 hover:underline">币安历史 K 线下载</router-link>
        生成对应品种与周期的二进制数据。
      </p>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">查询并绘图</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div class="sm:col-span-2">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">合约（Binance U 本位永续）</label>
            <n-select
              v-model:value="queryForm.symbol"
              filterable
              tag
              placeholder="选择或输入，如 BTCUSDT"
              :options="symbolOptions"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">K 线周期</label>
            <select v-model="queryForm.interval" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
              <option v-for="opt in intervalOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div v-if="isFreeBenchmarkPage" class="sm:col-span-2">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 基准合约（Binance U 本位永续）</label>
            <n-select
              v-model:value="queryForm.aboBenchmarkSymbol"
              filterable
              tag
              placeholder="选择或输入，如 BTCUSDT"
              :options="symbolOptions"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">起始时间</label>
            <input v-model="timeRange.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">结束时间</label>
            <input v-model="timeRange.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">最多根数 limit</label>
            <input v-model.number="queryForm.limit" type="number" min="100" max="50000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
        </div>
        <div class="mt-4 flex gap-3">
          <button
            type="button"
            @click="doLoadBars"
            :disabled="queryLoading"
            class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {{ queryLoading ? '加载中…' : '加载并绘图' }}
          </button>
        </div>
        <div v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
        <div v-if="meta && !error" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          已加载 {{ meta.count ?? (meta.bars?.length ?? 0) }} 根；interval={{ meta.interval || queryForm.interval }}；jbar:
          <span class="font-mono break-all">{{ meta.jbarPath || '—' }}</span>
          <template v-if="isFreeBenchmarkPage">
            ；ABO基准={{ (queryForm.aboBenchmarkSymbol || 'BTCUSDT').toUpperCase() }}
          </template>
        </div>
      </section>

      <!-- 图表指标：与砖石图 / 成交量节拍页一致 -->
      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">图表指标</h2>

        <div class="mb-4">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <label class="inline-flex items-center gap-2">
              <input id="ma-bin-jbar" v-model="indicatorForm.showMa" type="checkbox" class="rounded border-gray-300" />
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
            <input id="rsi-on-jbar" v-model="indicatorForm.showRsi" type="checkbox" class="rounded border-gray-300" />
            <label for="rsi-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 RSI</label>
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
            <input id="bb-on-jbar" v-model="indicatorForm.showBollinger" type="checkbox" class="rounded border-gray-300" />
            <label for="bb-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示布林带</label>
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
            <input id="st-on-jbar" v-model="indicatorForm.showSuperTrend" type="checkbox" class="rounded border-gray-300" />
            <label for="st-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 SuperTrend</label>
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
            <input id="macd-on-jbar" v-model="indicatorForm.showMacd" type="checkbox" class="rounded border-gray-300" />
            <label for="macd-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 MACD</label>
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
            <input id="atr-on-jbar" v-model="indicatorForm.showAtr" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ATR（N）</label>
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
            <input id="atr-norm-jbar" v-model="indicatorForm.atrNormalize" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-norm-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">ATR 滚动 Min-Max 归一化到 0～1</label>
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

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-on-jbar" v-model="indicatorForm.showAbo" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO（基准 BTC）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 展示模式</label>
            <select v-model="indicatorForm.aboDisplayMode" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo">
              <option value="fast">快线柱状</option>
              <option value="slow">慢线柱状</option>
              <option value="both">快慢双线</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 快线周期</label>
            <input
              v-model.number="indicatorForm.aboFastPeriod"
              type="number"
              min="2"
              max="200"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 慢线周期</label>
            <input
              v-model.number="indicatorForm.aboSlowPeriod"
              type="number"
              min="2"
              max="300"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 阈值（±）</label>
            <input
              v-model.number="indicatorForm.aboThreshold"
              type="number"
              min="0"
              max="5"
              step="0.1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-volume-weighted-on-jbar" v-model="indicatorForm.aboVolumeWeighted" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-volume-weighted-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO 成交量加权收益率（R' = R × V/SMA(V,N)）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">成交量SMA周期 N</label>
            <input
              v-model.number="indicatorForm.aboVolumePeriod"
              type="number"
              min="2"
              max="500"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo || !indicatorForm.aboVolumeWeighted"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-winsor-on-jbar" v-model="indicatorForm.aboWinsorize" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-winsor-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO 极值截断（Winsorizing）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Beta 截断上限 |x|</label>
            <input
              v-model.number="indicatorForm.aboWinsorLimit"
              type="number"
              min="0.5"
              max="100"
              step="0.5"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo || !indicatorForm.aboWinsorize"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价格预平滑 EMA 周期</label>
            <input
              v-model.number="indicatorForm.aboPreSmoothPeriod"
              type="number"
              min="1"
              max="100"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo"
            />
          </div>
          <div v-if="isFreeBenchmarkPage" class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-bench-noise-filter-on-jbar" v-model="indicatorForm.aboBenchmarkNoiseFilter" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-bench-noise-filter-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">
              ABO 去噪：过滤基准小波动（< 阈值沿用上一根）
            </label>
          </div>
          <div v-if="isFreeBenchmarkPage">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">基准最小波动阈值（%）</label>
            <input
              v-model.number="indicatorForm.aboBenchmarkMinMovePct"
              type="number"
              min="0.01"
              max="5"
              step="0.01"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo || !indicatorForm.aboBenchmarkNoiseFilter"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-zscore-on-jbar" v-model="indicatorForm.showAboZscore" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-zscore-on-jbar" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO Z-Score（标准分）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO Z-Score 窗口 N</label>
            <input
              v-model.number="indicatorForm.aboZscorePeriod"
              type="number"
              min="2"
              max="2000"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAboZscore"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO Z-Score 来源</label>
            <select
              v-model="indicatorForm.aboZscoreSource"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAboZscore"
            >
              <option value="fast">快线（Fast）</option>
              <option value="slow">慢线（Slow）</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO Z-Score 阈值 ±T</label>
            <input
              v-model.number="indicatorForm.aboZscoreThreshold"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAboZscore"
            />
          </div>
        </div>

        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          均线、布林、<strong>SuperTrend</strong>（ATR 为 Wilder/RMA）、RSI、MACD、ATR 与 ABO（基准 BTC）：与砖石图页一致；RSI 使用 <strong>Spring Reversal</strong>。K 线过多时重绘可能略慢。
        </p>
      </section>

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
            :show-abo="indicatorForm.showAbo"
            :abo-display-mode="indicatorForm.aboDisplayMode"
            :abo-fast-period="indicatorForm.aboFastPeriod"
            :abo-slow-period="indicatorForm.aboSlowPeriod"
            :abo-threshold="indicatorForm.aboThreshold"
            :abo-volume-weighted="indicatorForm.aboVolumeWeighted"
            :abo-volume-period="indicatorForm.aboVolumePeriod"
            :abo-winsorize="indicatorForm.aboWinsorize"
            :abo-winsor-limit="indicatorForm.aboWinsorLimit"
            :abo-pre-smooth-period="indicatorForm.aboPreSmoothPeriod"
            :abo-benchmark-noise-filter="isFreeBenchmarkPage && indicatorForm.aboBenchmarkNoiseFilter"
            :abo-benchmark-min-move-pct="indicatorForm.aboBenchmarkMinMovePct"
            :show-abo-zscore="indicatorForm.showAboZscore"
            :abo-zscore-period="indicatorForm.aboZscorePeriod"
            :abo-zscore-source="indicatorForm.aboZscoreSource"
            :abo-zscore-threshold="indicatorForm.aboZscoreThreshold"
            :abo-soft-clamp="true"
            :abo-soft-clamp-div="2"
            :abo-soft-clamp-range="3"
            :abo-soft-clamp-score="true"
            :abo-benchmark-bars="aboBenchmarkBars"
            :abo-source-bars="bars"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-8">暂无数据。请选择合约、周期与时间范围后点击「加载并绘图」。若提示未找到 .jbar，请先在「币安历史 K 线下载」中生成对应文件。</div>
      </section>

      <section v-if="isFreeBenchmarkPage" class="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-2">对数价差 K 线</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          公式：<code class="px-1 rounded bg-gray-200 dark:bg-gray-700">logSpread = ln(主合约价格) - ln(ABO基准价格)</code>
          （按同周期时间对齐，使用最新可得基准 K 线）
          ，并支持 ABO 相关指标（基准仍使用当前选择的 ABO 基准合约）。
        </p>
        <div v-if="spreadBars.length">
          <JbarKlineChart
            :bars="spreadBars"
            :height="Math.max(420, Math.min(760, Number(indicatorForm.chartHeight) || 620))"
            :price-decimals="6"
            crosshair-pct-basis="logSpread"
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
            :show-abo="indicatorForm.showAbo"
            :abo-display-mode="indicatorForm.aboDisplayMode"
            :abo-fast-period="indicatorForm.aboFastPeriod"
            :abo-slow-period="indicatorForm.aboSlowPeriod"
            :abo-threshold="indicatorForm.aboThreshold"
            :abo-volume-weighted="indicatorForm.aboVolumeWeighted"
            :abo-volume-period="indicatorForm.aboVolumePeriod"
            :abo-winsorize="indicatorForm.aboWinsorize"
            :abo-winsor-limit="indicatorForm.aboWinsorLimit"
            :abo-pre-smooth-period="indicatorForm.aboPreSmoothPeriod"
            :abo-benchmark-noise-filter="isFreeBenchmarkPage && indicatorForm.aboBenchmarkNoiseFilter"
            :abo-benchmark-min-move-pct="indicatorForm.aboBenchmarkMinMovePct"
            :show-abo-zscore="indicatorForm.showAboZscore"
            :abo-zscore-period="indicatorForm.aboZscorePeriod"
            :abo-zscore-source="indicatorForm.aboZscoreSource"
            :abo-zscore-threshold="indicatorForm.aboZscoreThreshold"
            :abo-soft-clamp="true"
            :abo-soft-clamp-div="2"
            :abo-soft-clamp-range="3"
            :abo-soft-clamp-score="true"
            :abo-benchmark-bars="aboBenchmarkBars"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-4">
          当前区间无法构造对数价差（可能基准合约数据缺失或价格无效）。
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NSelect } from 'naive-ui'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import { fetchBinanceHistoryKlineBars, fetchBinanceHistorySymbols } from '@/api'
import { TREND_LIQUIDITY_WHITELIST } from '@/constants/trendLiquidityWhitelist'

const intervalOptions = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '2h', value: '2h' },
  { label: '4h', value: '4h' },
  { label: '6h', value: '6h' },
  { label: '12h', value: '12h' },
  { label: '1d', value: '1d' },
]

const error = ref('')
const meta = ref(null)
const bars = ref([])
const aboBenchmarkBars = ref([])
const spreadBars = ref([])
const queryLoading = ref(false)
const binanceUmSymbols = ref([])
const route = useRoute()
const isFreeBenchmarkPage = computed(() => route.name === 'BinanceJbarKlineFreeBenchmark')

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

const queryForm = ref({
  symbol: 'BTCUSDT',
  aboBenchmarkSymbol: 'BTCUSDT',
  interval: '1h',
  limit: 5000,
})

/** 下拉：白名单优先 + 币安全量 UM（与回测实例页同源思路） */
const symbolOptions = computed(() => {
  const map = new Map()
  TREND_LIQUIDITY_WHITELIST.forEach((s) => {
    map.set(s, { label: s, value: s })
  })
  if (Array.isArray(binanceUmSymbols.value)) {
    binanceUmSymbols.value.forEach((raw) => {
      const normalized = String(raw ?? '').trim().toUpperCase()
      if (normalized) {
        map.set(normalized, { label: normalized, value: normalized })
      }
    })
  }
  const wlSet = new Set(TREND_LIQUIDITY_WHITELIST)
  const whitelistOrdered = TREND_LIQUIDITY_WHITELIST.filter((s) => map.has(s)).map((s) => map.get(s))
  const extras = [...map.keys()]
    .filter((k) => !wlSet.has(k))
    .sort((a, b) => a.localeCompare(b))
    .map((k) => map.get(k))
  return [...whitelistOrdered, ...extras]
})

let nextMaRowId = 4
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
  showAbo: false,
  aboDisplayMode: 'fast',
  aboFastPeriod: 7,
  aboSlowPeriod: 21,
  aboThreshold: 0.5,
  aboVolumeWeighted: true,
  aboVolumePeriod: 20,
  aboWinsorize: true,
  aboWinsorLimit: 5,
  aboPreSmoothPeriod: 3,
  aboBenchmarkNoiseFilter: true,
  aboBenchmarkMinMovePct: 0.1,
  showAboZscore: false,
  aboZscorePeriod: 120,
  aboZscoreSource: 'fast',
  aboZscoreThreshold: 2.0,
})

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

function toPositiveNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function toMs(row) {
  const t = Number(row?.t)
  return Number.isFinite(t) ? t : null
}

function getPrice(row, key, fallbackKey) {
  const p = toPositiveNumber(row?.[key])
  if (p != null) return p
  return toPositiveNumber(row?.[fallbackKey])
}

function buildLogSpreadBars(mainRows, benchRows) {
  if (!Array.isArray(mainRows) || !Array.isArray(benchRows) || !mainRows.length || !benchRows.length) return []
  const mainSorted = [...mainRows]
    .filter((r) => toMs(r) != null)
    .sort((a, b) => toMs(a) - toMs(b))
  const benchSorted = [...benchRows]
    .filter((r) => toMs(r) != null)
    .sort((a, b) => toMs(a) - toMs(b))
  if (!mainSorted.length || !benchSorted.length) return []

  const out = []
  let bi = 0
  let lastBench = null
  for (const m of mainSorted) {
    const mt = toMs(m)
    while (bi < benchSorted.length && toMs(benchSorted[bi]) <= mt) {
      lastBench = benchSorted[bi]
      bi += 1
    }
    if (!lastBench) continue

    const mo = getPrice(m, 'o', 'c')
    const mh = getPrice(m, 'h', 'c')
    const ml = getPrice(m, 'l', 'c')
    const mc = getPrice(m, 'c', 'o')
    const bo = getPrice(lastBench, 'o', 'c')
    const bh = getPrice(lastBench, 'h', 'c')
    const bl = getPrice(lastBench, 'l', 'c')
    const bc = getPrice(lastBench, 'c', 'o')
    if ([mo, mh, ml, mc, bo, bh, bl, bc].some((x) => x == null)) continue

    const so = Math.log(mo) - Math.log(bo)
    const sh = Math.log(mh) - Math.log(bh)
    const sl = Math.log(ml) - Math.log(bl)
    const sc = Math.log(mc) - Math.log(bc)
    const sHigh = Math.max(so, sh, sl, sc)
    const sLow = Math.min(so, sh, sl, sc)
    const vRaw = Number(m?.v)
    const sv = Number.isFinite(vRaw) && vRaw > 0 ? vRaw : 0

    out.push({
      t: mt,
      o: so,
      h: sHigh,
      l: sLow,
      c: sc,
      v: sv,
    })
  }
  return out
}

async function doLoadBars() {
  error.value = ''
  meta.value = null
  bars.value = []
  aboBenchmarkBars.value = []
  spreadBars.value = []
  const startMs = toTimestampMs(timeRange.value.startAt)
  const endMs = toTimestampMs(timeRange.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }
  const sym = String(queryForm.value.symbol || '').trim().toUpperCase()
  if (!sym) {
    error.value = '请选择或输入合约代码'
    return
  }
  const benchSym = String(isFreeBenchmarkPage.value ? queryForm.value.aboBenchmarkSymbol : 'BTCUSDT').trim().toUpperCase()
  if (!benchSym) {
    error.value = '请选择或输入 ABO 基准合约代码'
    return
  }
  const interval = String(queryForm.value.interval || '1h').trim().toLowerCase()
  queryLoading.value = true
  try {
    const reqMain = {
      symbol: sym,
      interval,
      startMs,
      endMs,
      limit: queryForm.value.limit,
    }
    const reqBtc = {
      symbol: benchSym,
      interval,
      startMs,
      endMs,
      limit: queryForm.value.limit,
    }
    const [data, btcData] = await Promise.all([
      fetchBinanceHistoryKlineBars(reqMain),
      sym === benchSym ? Promise.resolve(null) : fetchBinanceHistoryKlineBars(reqBtc),
    ])
    meta.value = data || null
    const mainBars = Array.isArray(data?.bars) ? data.bars : []
    const benchBars = sym === benchSym
      ? mainBars
      : (Array.isArray(btcData?.bars) ? btcData.bars : [])
    bars.value = mainBars
    aboBenchmarkBars.value = benchBars
    spreadBars.value = isFreeBenchmarkPage.value
      ? buildLogSpreadBars(mainBars, benchBars)
      : []
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
    bars.value = []
    aboBenchmarkBars.value = []
    spreadBars.value = []
  } finally {
    queryLoading.value = false
  }
}

onMounted(async () => {
  try {
    const data = await fetchBinanceHistorySymbols()
    if (Array.isArray(data)) {
      binanceUmSymbols.value = data
    }
  } catch (e) {
    console.warn('BinanceJbarKline: fetchBinanceHistorySymbols failed', e?.message || e)
  }
})
</script>
