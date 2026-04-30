<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        币安砖石 K 线：自由选择 ABO 基准（独立页面）
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        使用本地 <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">*_1m.jbar</code> 重新构建砖石线：
        以你选择的 <strong>ABO 基准合约</strong> 做主时钟，达到阈值（默认 0.5%）即同步切砖；
        仅构建「主合约 + 基准合约」两条腿，并写入独立目录/文件后缀，避免与旧砖石数据混用。
      </p>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">参数设置与构建</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主合约 symbol</label>
            <n-select
              v-model:value="form.symbol"
              filterable
              tag
              placeholder="选择或输入，如 LINKUSDT"
              :options="symbolOptions"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 基准 symbol</label>
            <n-select
              v-model:value="form.benchmarkSymbol"
              filterable
              tag
              placeholder="选择或输入，如 DOTUSDT"
              :options="symbolOptions"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">砖幅（%）</label>
            <input v-model.number="form.brickMovePercent" type="number" min="0.01" max="50" step="0.05" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">查询 limit</label>
            <input v-model.number="form.limit" type="number" min="100" max="50000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">起始时间</label>
            <input v-model="form.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">结束时间</label>
            <input v-model="form.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
        </div>
        <label class="mt-4 inline-flex items-start gap-2 max-w-3xl">
          <input v-model="form.enforceUtcDailyBrickCut" type="checkbox" class="rounded border-gray-300 mt-0.5" />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium">UTC 每日 00:00 强制插砖（仅前端）</span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              默认关闭，与落盘 jbar、<code class="px-0.5 rounded bg-gray-200 dark:bg-gray-800">BrickAviStrategy</code> 一致。
              勾选后跨 UTC 日会插入 O=H=L=C=前收、V=0 的平砖，CumABO/AVI 会与回测整体错位。
            </span>
          </span>
        </label>
        <div class="mt-4 flex gap-3">
          <button
            @click="doBuild"
            :disabled="buildLoading"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ buildLoading ? '构建中…' : '重构砖石（仅主+基准）' }}
          </button>
          <button
            @click="doLoadBars"
            :disabled="queryLoading"
            class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {{ queryLoading ? '加载中…' : '查询并绘图' }}
          </button>
        </div>
        <div v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
        <div v-if="meta && !error" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          已加载 {{ meta.count ?? (meta.bars?.length ?? 0) }} 根；主合约={{ symbolUpper }}；基准={{ benchmarkUpper }}；jbar:
          <span class="font-mono break-all">{{ meta.jbarPath || '—' }}</span>
        </div>
      </section>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-1">ABO 指标</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          按类型分组；价差 Z 与主图 Z 的细项也可在下方「对数价差」区块调整。
        </p>
        <div class="space-y-4">
          <!-- 1. ABO 核心线 -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-900/40">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
              ABO 核心线与成交量
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <label class="inline-flex items-center gap-2 sm:col-span-2">
                <input v-model="indicatorForm.showAbo" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO 展示</label>
                <select v-model="indicatorForm.aboDisplayMode" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo">
                  <option value="fast">仅快线（柱状）</option>
                  <option value="slow">仅慢线（柱状）</option>
                  <option value="both">快慢双线（折线）</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">快线周期</label>
                <input v-model.number="indicatorForm.aboFastPeriod" type="number" min="1" max="200" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">慢线周期</label>
                <input v-model.number="indicatorForm.aboSlowPeriod" type="number" min="2" max="300" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">阈值 ±</label>
                <input v-model.number="indicatorForm.aboThreshold" type="number" min="0.05" max="5" step="0.05" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo" />
              </div>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.aboVolumeWeighted" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">成交量加权</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Volume SMA N</label>
                <input v-model.number="indicatorForm.aboVolumePeriod" type="number" min="2" max="500" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo || !indicatorForm.aboVolumeWeighted" />
              </div>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.aboWinsorize" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">Winsorizing</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">|beta| 上限</label>
                <input v-model.number="indicatorForm.aboWinsorLimit" type="number" min="0.5" max="100" step="0.5" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo || !indicatorForm.aboWinsorize" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">预平滑 EMA</label>
                <input v-model.number="indicatorForm.aboPreSmoothPeriod" type="number" min="1" max="100" step="1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo" />
              </div>
            </div>
          </div>

          <!-- 2. AVI -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-900/40">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
              ABO AVI（估值）
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end max-w-xl">
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.showAboAvi" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO AVI</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO AVI 窗口</label>
                <input v-model.number="indicatorForm.aboAviPeriod" type="number" min="2" max="2000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAboAvi" />
              </div>
            </div>
          </div>

          <!-- 3. 截断与基准过滤 -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-900/40">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
              截断与基准过滤
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.aboSoftClamp" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">ABO tanh 软截断</span>
              </label>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.aboSoftClampScore" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">ABO 分数软截断</span>
              </label>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.aboBenchmarkNoiseFilter" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">过滤基准小波动</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">最小波动阈值(%)</label>
                <input v-model.number="indicatorForm.aboBenchmarkMinMovePct" type="number" min="0.01" max="5" step="0.01" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAbo || !indicatorForm.aboBenchmarkNoiseFilter" />
              </div>
            </div>
          </div>

          <!-- 4. Z-Score -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-900/40">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
              Z-Score（价差图 + 主图）
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">价差 Z 作用于下方对数价差 K 线；主图 Z 作用于主合约图。</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <label class="inline-flex items-center gap-2 lg:col-span-1">
                <input v-model="indicatorForm.showSpreadZscore" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">价差 Z-Score</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价差 Z 窗口</label>
                <input v-model.number="indicatorForm.spreadZscorePeriod" type="number" min="2" max="2000" step="1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showSpreadZscore" />
              </div>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.showMainZscore" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">主合约 Z-Score（主图）</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主图 Z 窗口</label>
                <input
                  v-model.number="indicatorForm.mainZscorePeriod"
                  type="number"
                  min="2"
                  max="2000"
                  step="1"
                  class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                  :disabled="!indicatorForm.showMainZscore"
                />
              </div>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.showMainZFastSlow" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">主图 Z 快慢线</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主图 Z 快线周期</label>
                <input
                  v-model.number="indicatorForm.mainZFastPeriod"
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                  :disabled="!indicatorForm.showMainZscore || !indicatorForm.showMainZFastSlow"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主图 Z 慢线周期</label>
                <input
                  v-model.number="indicatorForm.mainZSlowPeriod"
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                  :disabled="!indicatorForm.showMainZscore || !indicatorForm.showMainZFastSlow"
                />
              </div>
            </div>
          </div>

          <!-- 5. Kalman -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-900/40">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
              Kalman 滤波
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <label class="inline-flex items-center gap-2 lg:col-span-3">
                <input v-model="indicatorForm.showMainKalmanFastSlow" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm text-gray-800 dark:text-gray-200">主图 Kalman 快慢线（价差图 Kalman 在下方「对数价差」中开关）</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Kalman 快线 Q / R</label>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model.number="indicatorForm.kalmanFastQ"
                    type="number"
                    min="0.000001"
                    step="0.001"
                    class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                    :disabled="!indicatorForm.showMainZscore || !indicatorForm.showMainKalmanFastSlow"
                  />
                  <input
                    v-model.number="indicatorForm.kalmanFastR"
                    type="number"
                    min="0.000001"
                    step="0.001"
                    class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                    :disabled="!indicatorForm.showMainZscore || !indicatorForm.showMainKalmanFastSlow"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Kalman 慢线 Q / R</label>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model.number="indicatorForm.kalmanSlowQ"
                    type="number"
                    min="0.000001"
                    step="0.001"
                    class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                    :disabled="!indicatorForm.showMainZscore || !indicatorForm.showMainKalmanFastSlow"
                  />
                  <input
                    v-model.number="indicatorForm.kalmanSlowR"
                    type="number"
                    min="0.000001"
                    step="0.001"
                    class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                    :disabled="!indicatorForm.showMainZscore || !indicatorForm.showMainKalmanFastSlow"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Kalman 输入源</label>
                <select
                  v-model="indicatorForm.kalmanSource"
                  class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                  :disabled="!(indicatorForm.showMainKalmanFastSlow || indicatorForm.showSpreadKalmanFastSlow)"
                >
                  <option value="aboFast">ABO 快线</option>
                  <option value="aboSlow">ABO 慢线</option>
                  <option value="zscore">Z-Score</option>
                  <option value="aboZscore">ABO Z-Score</option>
                  <option value="aboAdi">ABO ADI</option>
                  <option value="aboAvi">ABO AVI</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 6. ABO Z / ADI -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-900/40">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
              ABO Z-Score 与 ADI
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.showAboZscore" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO Z-Score</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO Z 窗口</label>
                <input v-model.number="indicatorForm.aboZscorePeriod" type="number" min="2" max="2000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAboZscore" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO Z 来源</label>
                <select v-model="indicatorForm.aboZscoreSource" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAboZscore">
                  <option value="fast">快线</option>
                  <option value="slow">慢线</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO Z 阈值 ±</label>
                <input v-model.number="indicatorForm.aboZscoreThreshold" type="number" min="0.1" max="5" step="0.1" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAboZscore" />
              </div>
              <label class="inline-flex items-center gap-2">
                <input v-model="indicatorForm.showAboAdi" type="checkbox" class="rounded border-gray-300" />
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">显示 ABO ADI（统治力）</span>
              </label>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">ABO ADI 窗口</label>
                <input v-model.number="indicatorForm.aboAdiPeriod" type="number" min="2" max="2000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" :disabled="!indicatorForm.showAboAdi" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">K 线图</h2>
        <div v-if="bars.length">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">主合约 K 线</h3>
          <JbarKlineChart
            :bars="bars"
            :height="Math.max(620, Math.min(1200, Number(indicatorForm.chartHeight) || 760))"
            :price-decimals="4"
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
            :abo-soft-clamp="indicatorForm.aboSoftClamp"
            :abo-soft-clamp-score="indicatorForm.aboSoftClampScore"
            :abo-benchmark-noise-filter="indicatorForm.aboBenchmarkNoiseFilter"
            :abo-benchmark-min-move-pct="indicatorForm.aboBenchmarkMinMovePct"
            :show-zscore="indicatorForm.showMainZscore"
            :zscore-period="mainZscorePeriodEffective"
            :show-zscore-fast-slow="indicatorForm.showMainZFastSlow && indicatorForm.showMainZscore"
            :zscore-fast-period="indicatorForm.mainZFastPeriod"
            :zscore-slow-period="indicatorForm.mainZSlowPeriod"
            :show-kalman-fast-slow="indicatorForm.showMainKalmanFastSlow && indicatorForm.showMainZscore"
            :kalman-fast-q="indicatorForm.kalmanFastQ"
            :kalman-fast-r="indicatorForm.kalmanFastR"
            :kalman-slow-q="indicatorForm.kalmanSlowQ"
            :kalman-slow-r="indicatorForm.kalmanSlowR"
            :kalman-source="indicatorForm.kalmanSource"
            :show-abo-zscore="indicatorForm.showAboZscore"
            :abo-zscore-period="indicatorForm.aboZscorePeriod"
            :abo-zscore-source="indicatorForm.aboZscoreSource"
            :abo-zscore-threshold="indicatorForm.aboZscoreThreshold"
            :show-abo-adi="indicatorForm.showAboAdi"
            :abo-adi-period="indicatorForm.aboAdiPeriod"
            :show-abo-avi="indicatorForm.showAboAvi"
            :show-abo-avi-pdo-histogram="indicatorForm.showAviPdoHistogram"
            :abo-avi-period="indicatorForm.aboAviPeriod"
            :abo-benchmark-bars="benchmarkBars"
          />
          <div v-if="benchmarkBars.length" class="mt-6">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">基准合约 K 线</h3>
            <JbarKlineChart
              :bars="benchmarkBars"
              :height="Math.max(620, Math.min(1200, Number(indicatorForm.chartHeight) || 760))"
              :price-decimals="4"
              :show-abo="false"
              :show-zscore="false"
              :show-zscore-fast-slow="false"
              :show-kalman-fast-slow="false"
            />
          </div>
        </div>
        <div v-else class="text-sm text-gray-500 py-8">暂无数据。请先重构并查询。</div>
      </section>

      <section
        v-if="dashboardRows.length && benchmarkBars.length"
        class="mt-6 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow"
      >
        <div class="mb-3 flex flex-wrap items-end gap-4 text-xs text-gray-600 dark:text-gray-300">
          <div>
            <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">释放回看砖数 L</label>
            <input
              v-model.number="indicatorForm.releaseLookback"
              type="number"
              min="2"
              max="20"
              step="1"
              class="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">释放 |D| 下限（0=自适应）</label>
            <input
              v-model.number="indicatorForm.releaseCvdMomentumMin"
              type="number"
              min="0"
              step="any"
              class="w-36 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">释放 E 下限（0=自适应）</label>
            <input
              v-model.number="indicatorForm.releaseEfficiencyMin"
              type="number"
              min="0"
              step="any"
              class="w-36 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">CVD 动能 EMA 周期 P（砖）</label>
            <input
              v-model.number="indicatorForm.cvdMomentumEmaPeriod"
              type="number"
              min="1"
              max="200"
              step="1"
              class="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            <label class="inline-flex items-center gap-2 mt-2">
              <input v-model="indicatorForm.cvdMomentumUseKalman" type="checkbox" class="rounded border-gray-300" />
              <span class="text-[11px] text-gray-700 dark:text-gray-200">CVD 动能卡尔曼平滑</span>
            </label>
            <div class="mt-2 grid grid-cols-2 gap-2 max-w-xs">
              <div>
                <label class="block text-[10px] text-gray-500 dark:text-gray-400">KF Q</label>
                <input
                  v-model.number="indicatorForm.cvdMomentumKalmanQ"
                  type="number"
                  min="0.000001"
                  step="any"
                  class="w-full px-2 py-1 text-xs border rounded-md bg-white dark:bg-gray-800"
                  :disabled="!indicatorForm.cvdMomentumUseKalman"
                />
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 dark:text-gray-400">KF R</label>
                <input
                  v-model.number="indicatorForm.cvdMomentumKalmanR"
                  type="number"
                  min="0.000001"
                  step="any"
                  class="w-full px-2 py-1 text-xs border rounded-md bg-white dark:bg-gray-800"
                  :disabled="!indicatorForm.cvdMomentumUseKalman"
                />
              </div>
            </div>
            <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              右轴：动能柱（可选上方 Q/R 单通道 KF 后再缩到 ±3）。左轴：开启卡尔曼时显示<strong>快慢双线</strong>（K-F / K-S），Q/R 与上方「主合约 K 线」里 Kalman 快慢参数同源。累积 CVD 不显示，仍用于「释放」标记。
            </p>
          </div>
          <div
            class="basis-full w-full border-t border-gray-200 dark:border-gray-600 pt-3 mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
          >
            <div>
              <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">欧拉静风 A 阈（变色龙）</label>
              <input
                v-model.number="indicatorForm.eulerChameleonMinA"
                type="number"
                min="0"
                step="0.1"
                class="w-full max-w-[10rem] px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
              <p class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">A&lt;阈整砖中性灰；0=关闭</p>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">Z 方差地板比例</label>
              <input
                v-model.number="indicatorForm.eulerZVolatilityFloorRatio"
                type="number"
                min="0"
                max="2"
                step="0.05"
                class="w-full max-w-[10rem] px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
              <p class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">σ_eff=max(σ, σ̄×比例)；0=关闭</p>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700 dark:text-gray-200">Z σ 绝对下限（可选）</label>
              <input
                v-model.number="indicatorForm.eulerZSigmaFloorAbs"
                type="number"
                min="0"
                step="0.0001"
                class="w-full max-w-[10rem] px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
              <p class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">0=不用</p>
            </div>
          </div>
        </div>
        <RenkoFourPaneDashboard
          dashboard-heading="主合约 · 四维专业仪表盘"
          :rows="dashboardRows"
          :benchmark-bars="benchmarkBars"
          :profile="indicatorForm"
          :height="960"
          :price-decimals="4"
          :atr-period="14"
          :atr-stop-mult="1.5"
          :avi-period="indicatorForm.aboAviPeriod"
          :release-lookback="indicatorForm.releaseLookback"
          :release-cvd-momentum-min="indicatorForm.releaseCvdMomentumMin"
          :release-efficiency-min="indicatorForm.releaseEfficiencyMin"
          :cvd-momentum-ema-period="indicatorForm.cvdMomentumEmaPeriod"
        />
        <div
          v-if="symbolUpper !== benchmarkUpper"
          class="mt-10 pt-8 border-t border-gray-200 dark:border-gray-600"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-3xl">
            与上图<strong>同一砖钟与同一组参数</strong>：主图 K 线为<strong>基准合约</strong>砖；ABO / 欧拉 / CVD 均以基准腿为主序列，<strong>对照腿</strong>为主合约（已按基准砖钟对齐），与上图互为镜像。
          </p>
          <RenkoFourPaneDashboard
            dashboard-heading="基准合约 · 四维专业仪表盘"
            :rows="benchmarkBars"
            :benchmark-bars="dashboardRows"
            :profile="indicatorForm"
            :height="960"
            :price-decimals="4"
            :atr-period="14"
            :atr-stop-mult="1.5"
            :avi-period="indicatorForm.aboAviPeriod"
            :release-lookback="indicatorForm.releaseLookback"
            :release-cvd-momentum-min="indicatorForm.releaseCvdMomentumMin"
            :release-efficiency-min="indicatorForm.releaseEfficiencyMin"
            :cvd-momentum-ema-period="indicatorForm.cvdMomentumEmaPeriod"
          />
        </div>
      </section>

      <section class="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-2">主/基准 对数价差 K 线</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          公式：每根砖取主、基准<strong>同一 t</strong> 的 OHLC，算
          <code class="px-1 rounded bg-gray-200 dark:bg-gray-700">ln(主*)−ln(基*)</code> 四点取高低；单砖内
          <code class="px-1 rounded bg-gray-200 dark:bg-gray-700">收−开 = ln(主收/主开) − ln(基收/基开)</code>，
          小波动下十字线比价%≈主涨%−基涨%。勾选「合成价差·欧拉」后：主图蜡烛按<strong>同一套 I/Q 象限</strong>染绿/黄/红/紫（近轴仍涨跌色），副图为 PDO / sinθ / cosθ；公式为
          \(Q=Z(R_{主}-\beta R_{基})\)，\(I=Z(\mathrm{EMA}(\sum(\Delta CVD_{主}-\beta\Delta CVD_{基})))\)，与四维盘真欧拉同源（非 AVI 希尔伯特）。
          下方三张卡片与<strong>十字线</strong>上的振幅/涨跌幅%均按<strong>比价 R = exp(对数价差)</strong>（主÷基）口径，与主图按标价的%不同；纵轴仍为对数价差数值。
          <span class="block mt-1.5">
            「具体价差」若指<strong>主收盘价减基收盘价</strong>的 U 标价点数：两合约价位、乘数不同，没有统一「点差」定义；要做美元中性头寸需自定手数或 β。本图给出的是<strong>严格可算</strong>的 ln(主/基) 与 R=主/基（由对齐后的收盘逐砖算出）。
          </span>
        </p>
        <p v-if="spreadStats" class="mb-2 text-xs text-gray-600 dark:text-gray-400">
          末根收盘可核对：<span class="font-mono text-gray-800 dark:text-gray-200">R = 主/基 ≈ {{ spreadStats.ratioAtLast.toFixed(6) }}</span>，
          <span class="font-mono text-gray-800 dark:text-gray-200">ln R ≈ {{ spreadStats.logSpreadAtLast.toFixed(6) }}</span>（应与 K 线纵轴收一致）。
        </p>
        <div v-if="spreadStats" class="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">区间比价涨跌</div>
            <div :class="spreadStats.finalChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'" class="text-sm font-semibold">
              {{ formatPct(spreadStats.finalChangePct) }}
            </div>
          </div>
          <div class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">区间比价波动带</div>
            <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ formatPct(spreadStats.rangeAmplitudePct) }}
            </div>
          </div>
          <div class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">单砖比价最大摆动</div>
            <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ formatPct(spreadStats.maxCandleAmplitudePct) }}
            </div>
          </div>
        </div>
        <div class="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <label class="inline-flex items-center gap-2">
            <input v-model="indicatorForm.showSpreadZscore" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">显示价差 Z-Score</span>
          </label>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价差 Z-Score 窗口</label>
            <input
              v-model.number="indicatorForm.spreadZscorePeriod"
              type="number"
              min="2"
              max="2000"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSpreadZscore"
            />
          </div>
          <label class="inline-flex items-center gap-2">
            <input v-model="indicatorForm.showSpreadZFastSlow" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">显示 Z 快慢线（Z-MACD）</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="indicatorForm.showSpreadKalmanFastSlow" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">显示 Kalman 快慢线</span>
          </label>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Z 快线周期</label>
            <input
              v-model.number="indicatorForm.spreadZFastPeriod"
              type="number"
              min="1"
              max="500"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSpreadZFastSlow || !indicatorForm.showSpreadZscore"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">Z 慢线周期</label>
            <input
              v-model.number="indicatorForm.spreadZSlowPeriod"
              type="number"
              min="1"
              max="1000"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSpreadZFastSlow || !indicatorForm.showSpreadZscore"
            />
          </div>
          <label class="inline-flex items-center gap-2">
            <input v-model="indicatorForm.showSpreadAviPhaseOnMain" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">主图叠加 AVI 相位（Sin / 领先 Sin，与四维盘周期一致）</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="indicatorForm.showAviPdoHistogram" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">副图 PDO 柱（Lead−Sin，主 K 与价差图共用开关）</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="indicatorForm.showSpreadMa" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">显示价差均线</span>
          </label>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价差均线周期</label>
            <input
              v-model.number="indicatorForm.spreadMaPeriod"
              type="number"
              min="2"
              max="2000"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSpreadMa"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价差均线类型</label>
            <select
              v-model="indicatorForm.spreadMaType"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSpreadMa"
            >
              <option value="ema">EMA</option>
              <option value="sma">SMA</option>
            </select>
          </div>
          <label class="inline-flex items-center gap-2 sm:col-span-2">
            <input v-model="indicatorForm.showSyntheticSpreadEuler" type="checkbox" class="rounded border-gray-300" />
            <span class="text-sm text-gray-800 dark:text-gray-200">合成价差·欧拉副图（PDO / sinθ / cosθ，真相位）</span>
          </label>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价差对冲 β（收益与 ΔCVD）</label>
            <input
              v-model.number="indicatorForm.spreadEulerHedgeBeta"
              type="number"
              step="0.01"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSyntheticSpreadEuler"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">价差欧拉 Z 窗（砖）</label>
            <input
              v-model.number="indicatorForm.spreadEulerZWindow"
              type="number"
              min="2"
              max="2000"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSyntheticSpreadEuler"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">I/Q 波动对齐窗（砖，0 关闭；≥2 时展示层 I′=I·σ_Q/σ_I）</label>
            <input
              v-model.number="indicatorForm.spreadEulerIqVolBalanceWindow"
              type="number"
              min="0"
              max="2000"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSyntheticSpreadEuler"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">I 时间滞后 k（砖，0 关闭；≥1 时用 I<sub>t−k</sub> 与 Q<sub>t</sub> 配对算欧拉）</label>
            <input
              v-model.number="indicatorForm.spreadEulerIqLagBricks"
              type="number"
              min="0"
              max="20"
              step="1"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
              :disabled="!indicatorForm.showSyntheticSpreadEuler"
            />
          </div>
        </div>
        <div v-if="spreadBars.length">
          <JbarKlineChart
            :bars="spreadBars"
            :height="Math.max(520, Math.min(980, Number(indicatorForm.chartHeight) || 760))"
            :price-decimals="6"
            crosshair-pct-basis="logSpread"
            :ma-lines="spreadMaLines"
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
            :abo-soft-clamp="indicatorForm.aboSoftClamp"
            :abo-soft-clamp-score="indicatorForm.aboSoftClampScore"
            :abo-benchmark-noise-filter="indicatorForm.aboBenchmarkNoiseFilter"
            :abo-benchmark-min-move-pct="indicatorForm.aboBenchmarkMinMovePct"
            :show-zscore="indicatorForm.showSpreadZscore"
            :zscore-period="spreadZscorePeriodEffective"
            :show-zscore-fast-slow="indicatorForm.showSpreadZFastSlow && indicatorForm.showSpreadZscore"
            :zscore-fast-period="indicatorForm.spreadZFastPeriod"
            :zscore-slow-period="indicatorForm.spreadZSlowPeriod"
            :show-kalman-fast-slow="indicatorForm.showSpreadKalmanFastSlow && indicatorForm.showSpreadZscore"
            :kalman-fast-q="indicatorForm.kalmanFastQ"
            :kalman-fast-r="indicatorForm.kalmanFastR"
            :kalman-slow-q="indicatorForm.kalmanSlowQ"
            :kalman-slow-r="indicatorForm.kalmanSlowR"
            :kalman-source="indicatorForm.kalmanSource"
            :show-abo-zscore="indicatorForm.showAboZscore"
            :abo-zscore-period="indicatorForm.aboZscorePeriod"
            :abo-zscore-source="indicatorForm.aboZscoreSource"
            :abo-zscore-threshold="indicatorForm.aboZscoreThreshold"
            :show-abo-adi="indicatorForm.showAboAdi"
            :abo-adi-period="indicatorForm.aboAdiPeriod"
            :show-abo-avi="indicatorForm.showAboAvi"
            :show-abo-avi-phase-on-main="indicatorForm.showSpreadAviPhaseOnMain"
            :show-abo-avi-pdo-histogram="indicatorForm.showAviPdoHistogram"
            :abo-avi-period="indicatorForm.aboAviPeriod"
            :abo-source-bars="bars"
            :abo-benchmark-bars="benchmarkBars"
            :show-synthetic-spread-euler="indicatorForm.showSyntheticSpreadEuler"
            :synthetic-spread-euler-pts="spreadSyntheticEulerPts"
            :synthetic-euler-chameleon-min-a="indicatorForm.eulerChameleonMinA"
            :synthetic-euler-z-volatility-floor-ratio="indicatorForm.eulerZVolatilityFloorRatio"
            :synthetic-euler-z-sigma-floor-abs="indicatorForm.eulerZSigmaFloorAbs"
          />
        </div>
        <div v-else class="text-sm text-gray-500 py-4">
          当前区间无法构造价差 K 线（可能主/基准数据缺失）。
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { NSelect } from 'naive-ui'
import NavBar from '@/components/NavBar.vue'
import JbarKlineChart from '@/components/JbarKlineChart.vue'
import RenkoFourPaneDashboard from '@/components/RenkoFourPaneDashboard.vue'
import { buildBtcPointBrickKline, fetchBtcPointBrickKlineBars, getBinanceTopVolumeContracts } from '@/api'
import { eulerSpreadResonanceFromAlignedBrickRows } from '@/utils/chartIndicatorCore'

const FREE_OUTPUT_VARIANT = 'abo_benchmark'
const FREE_JBAR_TIMEFRAME = 'ABOPOINTBRICK'

const error = ref('')
const meta = ref(null)
const bars = ref([])
const benchmarkBars = ref([])
const aboBenchmarkBars = ref([])
const spreadBars = ref([])
const topVolumeSymbols = ref([])
const buildLoading = ref(false)
const queryLoading = ref(false)

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toTimestampMs(v) {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

const now = Date.now()
const form = ref({
  symbol: 'LINKUSDT',
  benchmarkSymbol: 'DOTUSDT',
  brickMovePercent: 0.5,
  limit: 5000,
  startAt: toLocalInputValue(new Date(now - 7 * 24 * 60 * 60 * 1000)),
  endAt: toLocalInputValue(new Date(now - 60 * 1000)),
  /** false：与后端 build + BrickAviStrategy 一致；true：研究端 UTC 午夜插砖 */
  enforceUtcDailyBrickCut: false,
})

const indicatorForm = ref({
  chartHeight: 760,
  showAbo: true,
  aboDisplayMode: 'both',
  aboFastPeriod: 14,
  aboSlowPeriod: 34,
  aboThreshold: 0.5,
  aboVolumeWeighted: true,
  aboVolumePeriod: 20,
  aboWinsorize: true,
  aboWinsorLimit: 5,
  aboPreSmoothPeriod: 3,
  aboSoftClamp: false,
  aboSoftClampScore: false,
  aboBenchmarkNoiseFilter: true,
  aboBenchmarkMinMovePct: 0.1,
  showMainZscore: false,
  mainZscorePeriod: 60,
  showMainZFastSlow: true,
  showMainKalmanFastSlow: false,
  mainZFastPeriod: 5,
  mainZSlowPeriod: 15,
  showSpreadZscore: true,
  spreadZscorePeriod: 60,
  showSpreadZFastSlow: true,
  showSpreadKalmanFastSlow: false,
  spreadZFastPeriod: 5,
  spreadZSlowPeriod: 15,
  kalmanFastQ: 0.08,
  kalmanFastR: 0.2,
  kalmanSlowQ: 0.01,
  kalmanSlowR: 0.8,
  kalmanSource: 'aboFast',
  showSpreadMa: true,
  spreadMaPeriod: 20,
  spreadMaType: 'ema',
  showAboZscore: true,
  aboZscorePeriod: 120,
  aboZscoreSource: 'fast',
  aboZscoreThreshold: 2.0,
  showAboAdi: false,
  aboAdiPeriod: 60,
  showAboAvi: false,
  /** 对数价差主图叠加与四维盘周期窗一致的 Sin(θ)/领先 Sin（由原始 AVI 驱动） */
  showSpreadAviPhaseOnMain: true,
  /** 主合约 K + 对数价差：副图 PDO 柱（Lead−Sin） */
  showAviPdoHistogram: true,
  aboAviPeriod: 100,
  releaseLookback: 3,
  releaseCvdMomentumMin: 0,
  releaseEfficiencyMin: 0,
  /** 四维盘 CVD 窗：动能 = CVD − EMA(CVD,P)，P 为砖数 */
  cvdMomentumEmaPeriod: 5,
  cvdMomentumUseKalman: true,
  cvdMomentumKalmanQ: 0.08,
  cvdMomentumKalmanR: 0.2,
  /** 对数价差图：合成资产欧拉（β 对冲 CVD + 价差收益 Z） */
  showSyntheticSpreadEuler: true,
  spreadEulerHedgeBeta: 1,
  spreadEulerZWindow: 100,
  /** 合成价差欧拉：展示层 I/Q 波动对齐滚动窗（砖）；0 关闭，≥2 启用 σ_Q/σ_I 缩放 I */
  spreadEulerIqVolBalanceWindow: 0,
  /** 合成价差欧拉：展示层 I 滞后 k 砖再与当前 Q 配对；0 关闭 */
  spreadEulerIqLagBricks: 0,
  /** 四维盘 + 价差变色龙：A 低于阈则整砖灰；0 关闭 */
  eulerChameleonMinA: 1.2,
  /** 欧拉 Z 滚动分母：前缀 stds[0..i] 中 σ&gt;0 的均值 × 比例作地板（因果）；0 关闭 */
  eulerZVolatilityFloorRatio: 0.2,
  /** 欧拉 Z σ 绝对下限；0 关闭 */
  eulerZSigmaFloorAbs: 0,
})

const symbolUpper = computed(() => String(form.value.symbol || '').trim().toUpperCase())
const benchmarkUpper = computed(() => String(form.value.benchmarkSymbol || '').trim().toUpperCase())

/** 与 ABO/AVI 同源：主合约 OHLCV 按基准砖时钟对齐（与对数价差主序列一致） */
const dashboardRows = computed(() => {
  const main = Array.isArray(bars.value) ? bars.value : []
  const bench = Array.isArray(benchmarkBars.value) ? benchmarkBars.value : []
  if (!main.length || !bench.length) return []
  if (symbolUpper.value === benchmarkUpper.value) return main
  return rebuildMainBarsOnBenchmarkClock(main, bench)
})
const symbolOptions = computed(() =>
  (Array.isArray(topVolumeSymbols.value) ? topVolumeSymbols.value : [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter((s) => !!s)
    .map((s) => ({ label: s, value: s }))
)
const spreadZscorePeriodEffective = computed(() => {
  const p = Math.max(2, Math.min(2000, Math.floor(Number(indicatorForm.value.spreadZscorePeriod)) || 60))
  const n = Array.isArray(spreadBars.value) ? spreadBars.value.length : 0
  if (n >= 2) return Math.min(p, n)
  return p
})
const mainZscorePeriodEffective = computed(() => {
  const p = Math.max(2, Math.min(2000, Math.floor(Number(indicatorForm.value.mainZscorePeriod)) || 60))
  const n = Array.isArray(bars.value) ? bars.value.length : 0
  if (n >= 2) return Math.min(p, n)
  return p
})
const spreadMaLines = computed(() => {
  if (!indicatorForm.value.showSpreadMa) return []
  const period = Math.max(2, Math.min(2000, Math.floor(Number(indicatorForm.value.spreadMaPeriod)) || 20))
  const type = String(indicatorForm.value.spreadMaType || 'ema').toLowerCase() === 'sma' ? 'sma' : 'ema'
  return [{ period, type, enabled: true }]
})

/** 主/基准对齐行上的合成价差欧拉，供下方对数价差 K 线副图（与四维盘 I/Q 定义对齐，β 标量可调） */
const spreadSyntheticEulerPts = computed(() => {
  if (!indicatorForm.value.showSyntheticSpreadEuler) return []
  if (symbolUpper.value === benchmarkUpper.value) return []
  const rows = dashboardRows.value
  const bench = benchmarkBars.value
  if (!rows?.length || !bench?.length) return []
  const zWin = Math.max(
    2,
    Math.min(2000, Math.floor(Number(indicatorForm.value.spreadEulerZWindow)) || 100)
  )
  const beta = Number(indicatorForm.value.spreadEulerHedgeBeta)
  const b = Number.isFinite(beta) ? beta : 1
  const cvdP = Math.max(1, Math.min(500, Math.floor(Number(indicatorForm.value.cvdMomentumEmaPeriod)) || 5))
  const zRatIn = Number(indicatorForm.value.eulerZVolatilityFloorRatio)
  let zVolatilityFloorRatio = 0
  if (!Number.isFinite(zRatIn)) zVolatilityFloorRatio = 0.2
  else if (zRatIn > 0) zVolatilityFloorRatio = zRatIn
  const zAbsIn = Number(indicatorForm.value.eulerZSigmaFloorAbs)
  const iqBalRaw = Number(indicatorForm.value.spreadEulerIqVolBalanceWindow)
  const iqBalW =
    Number.isFinite(iqBalRaw) && iqBalRaw >= 2
      ? Math.max(2, Math.min(2000, Math.floor(iqBalRaw)))
      : 0
  const iqLagRaw = Number(indicatorForm.value.spreadEulerIqLagBricks)
  const iqLagK =
    Number.isFinite(iqLagRaw) && iqLagRaw >= 1
      ? Math.max(1, Math.min(20, Math.floor(iqLagRaw)))
      : 0
  const spreadEulerOpts = {
    beta: b,
    zWindow: zWin,
    cvdEmaPeriod: cvdP,
  }
  if (zVolatilityFloorRatio > 0) spreadEulerOpts.zVolatilityFloorRatio = zVolatilityFloorRatio
  if (Number.isFinite(zAbsIn) && zAbsIn > 0) spreadEulerOpts.zSigmaFloorAbs = zAbsIn
  if (iqBalW >= 2) spreadEulerOpts.iqVolBalanceWindow = iqBalW
  if (iqLagK >= 1) spreadEulerOpts.iqLagBricks = iqLagK
  return eulerSpreadResonanceFromAlignedBrickRows(rows, bench, spreadEulerOpts)
})

/**
 * 对数价差砖的 OHLC 在「log 空间」；统计卡片改为比价 R = exp(logSpread)（主/基）上的百分比，避免 (Δlog/log)×100 的假天文数字。
 */
const spreadStats = computed(() => {
  const arr = Array.isArray(spreadBars.value) ? spreadBars.value : []
  if (!arr.length) return null
  const sFirst = Number(arr[0]?.o)
  const sLast = Number(arr[arr.length - 1]?.c)
  if (!Number.isFinite(sFirst) || !Number.isFinite(sLast)) return null

  const rFirst = Math.exp(Math.min(Math.max(sFirst, -80), 80))
  const rLast = Math.exp(Math.min(Math.max(sLast, -80), 80))
  const finalChangePct = rFirst > 1e-18 ? ((rLast / rFirst) - 1) * 100 : 0

  let ratioMin = Infinity
  let ratioMax = Number.NEGATIVE_INFINITY
  for (const b of arr) {
    for (const key of ['l', 'h', 'o', 'c']) {
      const sc = Number(b?.[key])
      if (!Number.isFinite(sc)) continue
      const r = Math.exp(Math.min(Math.max(sc, -80), 80))
      ratioMin = Math.min(ratioMin, r)
      ratioMax = Math.max(ratioMax, r)
    }
  }
  const rangeAmplitudePct =
    rFirst > 1e-18 && Number.isFinite(ratioMin) && Number.isFinite(ratioMax) && ratioMax >= ratioMin
      ? ((ratioMax - ratioMin) / rFirst) * 100
      : 0

  let maxCandleAmplitudePct = 0
  for (const b of arr) {
    const h = Number(b?.h)
    const l = Number(b?.l)
    if (Number.isFinite(h) && Number.isFinite(l)) {
      const d = Math.min(Math.max(h - l, -80), 80)
      const pct = (Math.exp(d) - 1) * 100
      if (Number.isFinite(pct)) maxCandleAmplitudePct = Math.max(maxCandleAmplitudePct, pct)
    }
  }

  return {
    finalChangePct,
    rangeAmplitudePct,
    maxCandleAmplitudePct,
    /** 主÷基，与 ln R 一一对应，可直接核对 */
    ratioAtLast: rLast,
    logSpreadAtLast: sLast,
  }
})

function formatPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function rebuildMainBarsOnBenchmarkClock(mainBars, benchmarkBars) {
  const main = Array.isArray(mainBars) ? mainBars.filter((b) => Number.isFinite(Number(b?.t))).map((b) => ({ ...b, t: Number(b.t) })).sort((a, b) => a.t - b.t) : []
  const bench = Array.isArray(benchmarkBars) ? benchmarkBars.filter((b) => Number.isFinite(Number(b?.t))).map((b) => ({ ...b, t: Number(b.t) })).sort((a, b) => a.t - b.t) : []
  if (!main.length || !bench.length) return []
  const out = []
  const mainByTs = new Map(main.map((m) => [Number(m.t), m]))
  let mi = 0
  let lastMain = null
  let prevSyncedClose = null
  for (const b of bench) {
    const bt = Number(b.t)
    while (mi < main.length && Number(main[mi].t) <= bt) {
      lastMain = main[mi]
      mi += 1
    }
    const exact = mainByTs.get(bt)
    const src = exact || lastMain
    if (!src) continue
    if (exact) {
      out.push({ ...exact, t: bt })
      const exactClose = Number(exact.c)
      if (Number.isFinite(exactClose)) prevSyncedClose = exactClose
      continue
    }
    const close = Number(src.c)
    if (!Number.isFinite(close)) continue
    const open = Number.isFinite(prevSyncedClose) ? prevSyncedClose : close
    out.push({ t: bt, o: open, h: Math.max(open, close), l: Math.min(open, close), c: close, v: 0 })
    prevSyncedClose = close
  }
  return out
}

function toPositive(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 与 BinanceJbarKline 一致：OHLC 缺项时用 c / o 兜底，保证价为正 */
function positivePrice(row, key, fallbackKey) {
  const a = toPositive(row?.[key])
  if (a != null) return a
  return toPositive(row?.[fallbackKey])
}

function utcDateKey(ms) {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function utcMidnightMs(ms) {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
}

/**
 * 每天 00:00 强制切一根砖（UTC）：
 * - 若跨天且当天没有 00:00 砖，则插入一根平砖（O=H=L=C=前收，V=0）
 * - 仅用于研究端展示与指标计算，避免改动后端落盘逻辑
 */
/** 排序 + 过滤无效 t/c；不插入午夜砖 */
function normalizeBrickBars(inputBars) {
  return Array.isArray(inputBars)
    ? inputBars
        .filter((b) => Number.isFinite(Number(b?.t)) && Number.isFinite(Number(b?.c)))
        .map((b) => ({ ...b, t: Number(b.t) }))
        .sort((a, b) => a.t - b.t)
    : []
}

function enforceDailyMidnightBrickCut(inputBars) {
  const arr = normalizeBrickBars(inputBars)
  if (!arr.length) return []

  const out = [arr[0]]
  for (let i = 1; i < arr.length; i++) {
    const prev = out[out.length - 1]
    const cur = arr[i]
    const prevDay = utcDateKey(prev.t)
    const curDay = utcDateKey(cur.t)
    if (prevDay !== curDay) {
      // 跨多天时逐天补 00:00 强制砖，避免大跳空导致中间天数缺失。
      const prevDate = new Date(prev.t)
      const curDate = new Date(cur.t)
      const d = new Date(Date.UTC(prevDate.getUTCFullYear(), prevDate.getUTCMonth(), prevDate.getUTCDate() + 1, 0, 0, 0, 0))
      while (d.getTime() < Date.UTC(curDate.getUTCFullYear(), curDate.getUTCMonth(), curDate.getUTCDate(), 0, 0, 0, 0) + 1) {
        const cutTs = d.getTime()
        const hasMidnightBrick = cur.t === cutTs
        if (!hasMidnightBrick && cutTs > prev.t && cutTs < cur.t) {
          const prevClose = Number(out[out.length - 1]?.c)
          if (Number.isFinite(prevClose)) {
            out.push({
              t: cutTs,
              o: prevClose,
              h: prevClose,
              l: prevClose,
              c: prevClose,
              v: 0,
            })
          }
        }
        d.setUTCDate(d.getUTCDate() + 1)
      }
    }
    out.push(cur)
  }
  return out
}

/**
 * 对数价差 K 线：每一根砖用主、基准<strong>同一时刻 t</strong> 的 OHLC 合成
 * ln(主*)−ln(基*)，再取四点的 max/min 为高/低。
 * 单砖内 (收−开) = ln(主收/主开) − ln(基收/基开)，小波动时十字线「比价%」≈ 主涨% − 基涨%（不再用上一砖价差收盘当本砖开盘）。
 */
function buildLogSpreadBars(mainBars, benchmarkBars) {
  const main = Array.isArray(mainBars) ? mainBars : []
  const bench = Array.isArray(benchmarkBars) ? benchmarkBars : []
  if (!main.length || !bench.length) return []

  const benchByT = new Map()
  for (const b of bench) {
    const t = Number(b?.t)
    if (Number.isFinite(t)) benchByT.set(t, b)
  }

  const out = []
  for (const m of main) {
    const t = Number(m?.t)
    if (!Number.isFinite(t)) continue
    const b = benchByT.get(t)
    if (!b) continue

    const mo = positivePrice(m, 'o', 'c')
    const mh = positivePrice(m, 'h', 'c')
    const ml = positivePrice(m, 'l', 'c')
    const mc = positivePrice(m, 'c', 'o')
    const bo = positivePrice(b, 'o', 'c')
    const bh = positivePrice(b, 'h', 'c')
    const bl = positivePrice(b, 'l', 'c')
    const bc = positivePrice(b, 'c', 'o')
    if (!mo || !mh || !ml || !mc || !bo || !bh || !bl || !bc) continue

    const so = Math.log(mo) - Math.log(bo)
    const sh = Math.log(mh) - Math.log(bh)
    const sl = Math.log(ml) - Math.log(bl)
    const sc = Math.log(mc) - Math.log(bc)
    const sHigh = Math.max(so, sh, sl, sc)
    const sLow = Math.min(so, sh, sl, sc)
    const sv = Number.isFinite(Number(m?.v)) ? Math.max(0, Number(m.v)) : 0
    out.push({ t, o: so, h: sHigh, l: sLow, c: sc, v: sv })
  }
  return out
}

async function doBuild() {
  error.value = ''
  const startMs = toTimestampMs(form.value.startAt)
  const endMs = toTimestampMs(form.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }
  if (!symbolUpper.value || !benchmarkUpper.value) {
    error.value = '请填写主合约和基准合约'
    return
  }
  buildLoading.value = true
  try {
    const symbols = Array.from(new Set([symbolUpper.value, benchmarkUpper.value]))
    await buildBtcPointBrickKline({
      startTimeMs: startMs,
      endTimeMs: endMs,
      brickMovePercent: form.value.brickMovePercent,
      clockMode: 'btc_master',
      masterSymbol: benchmarkUpper.value,
      symbols,
      allSymbols: false,
      outputVariant: FREE_OUTPUT_VARIANT,
      jbarTimeframe: FREE_JBAR_TIMEFRAME,
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
  benchmarkBars.value = []
  aboBenchmarkBars.value = []
  spreadBars.value = []
  const startMs = toTimestampMs(form.value.startAt)
  const endMs = toTimestampMs(form.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效的开始/结束时间（结束需大于开始）'
    return
  }
  if (!symbolUpper.value || !benchmarkUpper.value) {
    error.value = '请填写主合约和基准合约'
    return
  }
  queryLoading.value = true
  try {
    const reqMain = {
      symbol: symbolUpper.value,
      startMs,
      endMs,
      limit: form.value.limit,
      clockMode: 'btc_master',
      outputVariant: FREE_OUTPUT_VARIANT,
      jbarTimeframe: FREE_JBAR_TIMEFRAME,
    }
    const reqBench = {
      symbol: benchmarkUpper.value,
      startMs,
      endMs,
      limit: form.value.limit,
      clockMode: 'btc_master',
      outputVariant: FREE_OUTPUT_VARIANT,
      jbarTimeframe: FREE_JBAR_TIMEFRAME,
    }
    const [data, benchData] = await Promise.all([
      fetchBtcPointBrickKlineBars(reqMain),
      symbolUpper.value === benchmarkUpper.value ? Promise.resolve(null) : fetchBtcPointBrickKlineBars(reqBench),
    ])
    meta.value = data || null
    const rawMainBars = Array.isArray(data?.bars) ? data.bars : []
    const rawBenchBars = symbolUpper.value === benchmarkUpper.value
      ? rawMainBars
      : (Array.isArray(benchData?.bars) ? benchData.bars : [])

    const useMidnight = !!form.value.enforceUtcDailyBrickCut
    const mainProcessed = useMidnight ? enforceDailyMidnightBrickCut(rawMainBars) : normalizeBrickBars(rawMainBars)
    const benchProcessed = useMidnight ? enforceDailyMidnightBrickCut(rawBenchBars) : normalizeBrickBars(rawBenchBars)

    bars.value = mainProcessed
    benchmarkBars.value = benchProcessed
    aboBenchmarkBars.value = benchProcessed

    const mainBarsAlignedToBenchmarkClock = symbolUpper.value === benchmarkUpper.value
      ? benchProcessed
      : rebuildMainBarsOnBenchmarkClock(mainProcessed, benchProcessed)

    spreadBars.value = buildLogSpreadBars(mainBarsAlignedToBenchmarkClock, benchProcessed)
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
    benchmarkBars.value = []
    spreadBars.value = []
  } finally {
    queryLoading.value = false
  }
}

onMounted(async () => {
  try {
    const rows = await getBinanceTopVolumeContracts()
    const list = Array.isArray(rows)
      ? rows
          .map((r) => String(r?.symbol || '').trim().toUpperCase())
          .filter((s) => !!s)
      : []
    topVolumeSymbols.value = Array.from(new Set(list)).slice(0, 150)
  } catch (e) {
    console.warn('BtcPointBrickKlineFreeBenchmark: load top150 symbols failed', e?.message || e)
    topVolumeSymbols.value = []
  }
})
</script>
