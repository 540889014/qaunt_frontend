<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {{ isFreeBenchmarkPage ? '币安砖石 K 线：自由选择 ABO 基准' : '砖石图 K 线（可选独立时钟 / BTC 主时钟 · 后端全市场构建）' }}
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        基于各合约本地 <strong>1m</strong> <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">*_1m.jbar</code>：
        可选 <strong>独立时钟</strong>（每个品种按自身涨跌切砖）或 <strong>BTC 主时钟</strong>（BTC 达阈值时全市场同步切砖）。
        支持按时间范围全市场构建并写入
        <code class="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800">btc_point_brick/&lt;SYMBOL&gt;_BTCPOINTBRICK.jbar</code>。
        <template v-if="isFreeBenchmarkPage">
          本页会以你指定的 <strong>ABO 基准合约</strong> 作为主时钟（基于 1m 行情），达到砖幅阈值就同步切砖。
        </template>
      </p>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">参数设置</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">起始时间</label>
            <input v-model="timeRange.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">结束时间</label>
            <input v-model="timeRange.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">点砖幅度 brickMovePercent（%，如 1 = 涨跌 1% 一根）</label>
            <input v-model.number="buildForm.brickMovePercent" type="number" min="0.01" max="50" step="0.05" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div v-if="!isFreeBenchmarkPage">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">时钟模式</label>
            <select v-model="buildForm.clockMode" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800">
              <option value="independent">按品种独立时钟</option>
              <option value="btc_master">以 BTC 为主时钟</option>
            </select>
          </div>
          <div v-if="buildForm.clockMode === 'btc_master' && !isFreeBenchmarkPage">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主时钟 symbol</label>
            <input v-model="buildForm.masterSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>
          <div v-if="isFreeBenchmarkPage">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 基准主时钟 symbol</label>
            <input v-model="queryForm.aboBenchmarkSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>
        </div>
        <div class="mt-4 flex gap-3">
          <button
            @click="doBuild"
            :disabled="buildLoading"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ buildLoading ? '构建中…' : '构建 / 重算（全市场）' }}
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

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">读取并绘图</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">查看 symbol</label>
            <input v-model="queryForm.symbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
          </div>
          <div v-if="isFreeBenchmarkPage">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 基准 symbol</label>
            <input v-model="queryForm.aboBenchmarkSymbol" type="text" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" placeholder="BTCUSDT" />
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
          已加载 {{ meta.count ?? (meta.bars?.length ?? 0) }} 根；mode={{ effectiveClockMode }}；interval={{ meta.interval || 'BTCPOINTBRICK' }}；jbar:
          <span class="font-mono break-all">{{ meta.jbarPath || '—' }}</span>
          <template v-if="isFreeBenchmarkPage">
            ；ABO基准主时钟={{ benchmarkSymbolUpper }}
          </template>
        </div>
      </section>

      <!-- Chart indicators（与成交量节拍 K 线页一致） -->
      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">图表指标</h2>

        <div class="mb-4">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <label class="inline-flex items-center gap-2">
              <input id="ma-master-brick" v-model="indicatorForm.showMa" type="checkbox" class="rounded border-gray-300" />
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
            <input id="rsi-on-brick" v-model="indicatorForm.showRsi" type="checkbox" class="rounded border-gray-300" />
            <label for="rsi-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 RSI</label>
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
            <input id="bb-on-brick" v-model="indicatorForm.showBollinger" type="checkbox" class="rounded border-gray-300" />
            <label for="bb-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示布林带</label>
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
            <input id="st-on-brick" v-model="indicatorForm.showSuperTrend" type="checkbox" class="rounded border-gray-300" />
            <label for="st-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 SuperTrend</label>
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
            <input id="macd-on-brick" v-model="indicatorForm.showMacd" type="checkbox" class="rounded border-gray-300" />
            <label for="macd-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 MACD</label>
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
            <input id="atr-on-brick" v-model="indicatorForm.showAtr" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ATR（N）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ATR 周期 N（对 TR 的 EMA，海龟常用 20）</label>
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
            <input id="atr-norm-brick" v-model="indicatorForm.atrNormalize" type="checkbox" class="rounded border-gray-300" />
            <label for="atr-norm-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">ATR 滚动 Min-Max 归一化到 0～1</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">归一化窗口（最近几根 ATR，如 100）</label>
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
            <input id="abo-on-brick" v-model="indicatorForm.showAbo" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO（非对称贝塔振荡器）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 展示</label>
            <select
              v-model="indicatorForm.aboDisplayMode"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo"
            >
              <option value="fast">仅快线（柱状）</option>
              <option value="slow">仅慢线（柱状）</option>
              <option value="both">快慢双线（折线）</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 快线周期</label>
            <input
              v-model.number="indicatorForm.aboFastPeriod"
              type="number"
              min="1"
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
              min="0.05"
              max="5"
              step="0.05"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-reversal-boost-on-brick" v-model="indicatorForm.aboReversalBoost" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-reversal-boost-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO 连击反转加速（单次释放）</label>
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-volume-weighted-on-brick" v-model="indicatorForm.aboVolumeWeighted" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-volume-weighted-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO 成交量加权收益率（R' = R × V/SMA(V,N)）</label>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">反转加速系数</label>
            <input
              v-model.number="indicatorForm.aboReversalBoostFactor"
              type="number"
              min="0"
              max="5"
              step="0.05"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo || !indicatorForm.aboReversalBoost"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">成交量SMA周期 N</label>
            <input
              v-model.number="indicatorForm.aboVolumePeriod"
              type="number"
              min="2"
              max="500"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showAbo || !indicatorForm.aboVolumeWeighted"
            />
          </div>
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-winsor-on-brick" v-model="indicatorForm.aboWinsorize" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-winsor-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO 极值截断（Winsorizing）</label>
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
          <div class="flex items-center gap-2 pb-2 sm:col-span-2">
            <input id="abo-zscore-on-brick" v-model="indicatorForm.showAboZscore" type="checkbox" class="rounded border-gray-300" />
            <label for="abo-zscore-on-brick" class="text-sm font-medium text-gray-800 dark:text-gray-200">ABO Z-Score（标准分）</label>
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
          均线、布林、<strong>SuperTrend</strong>（ATR 为 Wilder/RMA）、RSI、MACD 与 ATR：RSI/MACD 主要基于收盘价；<strong>ATR</strong> 子图用 TR 的 N 周期 EMA（默认 N=20）。勾选「归一化」时，对 ATR 序列做最近 W 根的滚动 Min-Max 映射到 0～1，便于跨品种对比；图中虚线为 0.3 参考线。
          本页 RSI 使用 <strong>Spring Reversal</strong>（顺势阻尼 + 反向加速）。每条均线可单独开关与设周期/类型。K 线过多时重绘可能略慢。
        </p>
      </section>

      <section class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">K 线图</h2>
        <div v-if="stats" class="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">区间涨跌幅</div>
            <div :class="stats.finalChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'" class="text-sm font-semibold">
              {{ formatPct(stats.finalChangePct) }}
            </div>
          </div>
          <div class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">区间最大振幅</div>
            <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ formatPct(stats.rangeAmplitudePct) }}
            </div>
          </div>
          <div class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">单根最大振幅</div>
            <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ formatPct(stats.maxCandleAmplitudePct) }}
            </div>
          </div>
        </div>
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
            :abo-reversal-boost="indicatorForm.aboReversalBoost"
            :abo-reversal-boost-factor="indicatorForm.aboReversalBoostFactor"
            :abo-volume-weighted="indicatorForm.aboVolumeWeighted"
            :abo-volume-period="indicatorForm.aboVolumePeriod"
            :abo-winsorize="indicatorForm.aboWinsorize"
            :abo-winsor-limit="indicatorForm.aboWinsorLimit"
            :abo-pre-smooth-period="indicatorForm.aboPreSmoothPeriod"
            :show-abo-zscore="indicatorForm.showAboZscore"
            :abo-zscore-period="indicatorForm.aboZscorePeriod"
            :abo-zscore-source="indicatorForm.aboZscoreSource"
            :abo-zscore-threshold="indicatorForm.aboZscoreThreshold"
            :abo-benchmark-bars="aboBenchmarkBars"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-8">暂无数据。请先点击“构建 / 重算（全市场）”，再查询绘图。</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import { buildBtcPointBrickKline, fetchBtcPointBrickKlineBars } from '@/api'

const error = ref('')
const meta = ref(null)
const bars = ref([])
const aboBenchmarkBars = ref([])
const buildLoading = ref(false)
const queryLoading = ref(false)
const route = useRoute()
const isFreeBenchmarkPage = computed(() => route.name === 'BtcPointBrickKlineFreeBenchmark')
const benchmarkSymbolUpper = computed(() => (queryForm.value.aboBenchmarkSymbol || 'BTCUSDT').trim().toUpperCase())
const effectiveClockMode = computed(() => (isFreeBenchmarkPage.value ? 'btc_master' : buildForm.value.clockMode))
const FREE_OUTPUT_VARIANT = 'abo_benchmark'
const FREE_JBAR_TIMEFRAME = 'ABOPOINTBRICK'

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
  brickMovePercent: 0.5,
  clockMode: 'independent',
  masterSymbol: 'BTCUSDT',
})

const queryForm = ref({
  symbol: 'BTCUSDT',
  aboBenchmarkSymbol: 'BTCUSDT',
  limit: 5000,
})

let nextMaRowId = 4
/** 图表指标：均线（逐条） + 布林带（与 BtcVolumeSyncKline 一致） */
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
  aboReversalBoost: true,
  aboReversalBoostFactor: 0.45,
  aboVolumeWeighted: true,
  aboVolumePeriod: 20,
  aboWinsorize: true,
  aboWinsorLimit: 5,
  aboPreSmoothPeriod: 3,
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

const stats = computed(() => {
  const arr = Array.isArray(bars.value) ? bars.value : []
  if (!arr.length) return null
  const firstOpen = Number(arr[0]?.o)
  const lastClose = Number(arr[arr.length - 1]?.c)
  if (!Number.isFinite(firstOpen) || firstOpen <= 0 || !Number.isFinite(lastClose)) return null

  let maxHigh = Number.NEGATIVE_INFINITY
  let minLow = Number.POSITIVE_INFINITY
  let maxCandleAmplitudePct = 0

  for (const b of arr) {
    const o = Number(b?.o)
    const h = Number(b?.h)
    const l = Number(b?.l)
    if (Number.isFinite(h)) maxHigh = Math.max(maxHigh, h)
    if (Number.isFinite(l)) minLow = Math.min(minLow, l)
    if (Number.isFinite(o) && o > 0 && Number.isFinite(h) && Number.isFinite(l)) {
      const amp = ((h - l) / o) * 100
      if (Number.isFinite(amp)) maxCandleAmplitudePct = Math.max(maxCandleAmplitudePct, amp)
    }
  }
  if (!Number.isFinite(maxHigh) || !Number.isFinite(minLow)) return null

  return {
    finalChangePct: ((lastClose - firstOpen) / firstOpen) * 100,
    rangeAmplitudePct: ((maxHigh - minLow) / firstOpen) * 100,
    maxCandleAmplitudePct,
  }
})

function formatPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

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

/**
 * 将基准 bars（如 BTC）按主图 bars 的时间轴做前值对齐，避免 ABO 子图把主图时间轴拉稀。
 * 这样开启 ABO 后，K 线主图仍保持完整且不出现异常空洞。
 */
function alignBenchmarkBarsToMainClock(mainBars, benchmarkBars) {
  const main = Array.isArray(mainBars)
    ? mainBars
        .filter((b) => Number.isFinite(Number(b?.t)))
        .map((b) => ({ ...b, t: Number(b.t) }))
        .sort((a, b) => a.t - b.t)
    : []
  const bench = Array.isArray(benchmarkBars)
    ? benchmarkBars
        .filter((b) => Number.isFinite(Number(b?.t)))
        .map((b) => ({ ...b, t: Number(b.t) }))
        .sort((a, b) => a.t - b.t)
    : []
  if (!main.length || !bench.length) return []

  const out = []
  let bi = 0
  for (const m of main) {
    while (bi + 1 < bench.length && bench[bi + 1].t <= m.t) {
      bi += 1
    }
    const left = bench[bi]
    const right = bench[bi + 1] || null
    if (!left) continue
    const leftClose = Number(left.c)
    if (!Number.isFinite(leftClose)) continue

    let close = leftClose
    // 线性插值：减少“前值保持”导致的大段 0 收益（尤其 ABO fast=1 时更明显）
    if (right && Number.isFinite(Number(right.c)) && Number(right.t) > Number(left.t) && m.t > left.t) {
      const ratio = Math.max(0, Math.min(1, (m.t - left.t) / (right.t - left.t)))
      close = leftClose + (Number(right.c) - leftClose) * ratio
    }
    if (!Number.isFinite(close)) continue
    out.push({
      t: m.t,
      o: close,
      h: close,
      l: close,
      c: close,
      v: 0,
    })
  }
  return out
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
    const clockMode = isFreeBenchmarkPage.value ? 'btc_master' : buildForm.value.clockMode
    const masterSymbol = isFreeBenchmarkPage.value
      ? benchmarkSymbolUpper.value
      : (buildForm.value.masterSymbol || 'BTCUSDT').trim().toUpperCase()
    const mainSymbol = (queryForm.value.symbol || 'BTCUSDT').trim().toUpperCase()
    const symbols = isFreeBenchmarkPage.value
      ? Array.from(new Set([mainSymbol, benchmarkSymbolUpper.value].filter((s) => !!s)))
      : undefined
    await buildBtcPointBrickKline({
      startTimeMs: startMs,
      endTimeMs: endMs,
      brickMovePercent: buildForm.value.brickMovePercent,
      clockMode,
      masterSymbol,
      symbols,
      allSymbols: isFreeBenchmarkPage.value ? false : true,
      outputVariant: isFreeBenchmarkPage.value ? FREE_OUTPUT_VARIANT : undefined,
      jbarTimeframe: isFreeBenchmarkPage.value ? FREE_JBAR_TIMEFRAME : undefined,
      writeJbar: true,
    })
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
  aboBenchmarkBars.value = []
  const startMs = toTimestampMs(timeRange.value.startAt)
  const endMs = toTimestampMs(timeRange.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }
  const sym = (queryForm.value.symbol || 'BTCUSDT').trim().toUpperCase()
  const benchSym = (isFreeBenchmarkPage.value ? queryForm.value.aboBenchmarkSymbol : 'BTCUSDT').trim().toUpperCase()
  if (!benchSym) {
    error.value = '请选择有效的 ABO 基准 symbol'
    return
  }
  queryLoading.value = true
  try {
    const clockMode = isFreeBenchmarkPage.value ? 'btc_master' : buildForm.value.clockMode
    const reqMain = {
      symbol: sym,
      startMs,
      endMs,
      limit: queryForm.value.limit,
      clockMode,
      outputVariant: isFreeBenchmarkPage.value ? FREE_OUTPUT_VARIANT : undefined,
      jbarTimeframe: isFreeBenchmarkPage.value ? FREE_JBAR_TIMEFRAME : undefined,
    }
    // 默认基准为 BTCUSDT；自由基准页可由用户指定 benchmark symbol。
    const reqBtc = {
      symbol: benchSym,
      startMs,
      endMs,
      limit: queryForm.value.limit,
      clockMode,
      outputVariant: isFreeBenchmarkPage.value ? FREE_OUTPUT_VARIANT : undefined,
      jbarTimeframe: isFreeBenchmarkPage.value ? FREE_JBAR_TIMEFRAME : undefined,
    }
    const [data, btcData] = await Promise.all([
      fetchBtcPointBrickKlineBars(reqMain),
      sym === benchSym ? Promise.resolve(null) : fetchBtcPointBrickKlineBars(reqBtc),
    ])
    meta.value = data || null
    const mainBars = Array.isArray(data?.bars) ? data.bars : []
    const rawBenchmarkBars = sym === benchSym
      ? mainBars
      : (Array.isArray(btcData?.bars) ? btcData.bars : [])
    bars.value = mainBars
    aboBenchmarkBars.value = alignBenchmarkBarsToMainClock(mainBars, rawBenchmarkBars)
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
    bars.value = []
    aboBenchmarkBars.value = []
  } finally {
    queryLoading.value = false
  }
}
</script>
