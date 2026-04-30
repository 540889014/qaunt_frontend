<template>
  <div class="relative">
  <div
    ref="wrapRef"
    class="jbar-kline-chart w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600"
    :style="{ minHeight: height + 'px' }"
  />
    <div
      v-if="hoverMetrics.visible"
      class="pointer-events-none absolute z-10 rounded-md border border-gray-300/80 dark:border-gray-600/90 bg-white/95 dark:bg-gray-900/95 px-2 py-1 text-xs shadow"
      :style="{ left: hoverMetrics.left + 'px', top: hoverMetrics.top + 'px' }"
    >
      <div class="text-gray-700 dark:text-gray-200">开: <span class="font-semibold">{{ hoverMetrics.openText }}</span></div>
      <div class="text-gray-700 dark:text-gray-200">高: <span class="font-semibold">{{ hoverMetrics.highText }}</span></div>
      <div class="text-gray-700 dark:text-gray-200">低: <span class="font-semibold">{{ hoverMetrics.lowText }}</span></div>
      <div class="text-gray-700 dark:text-gray-200">收: <span class="font-semibold">{{ hoverMetrics.closeText }}</span></div>
      <div class="text-gray-700 dark:text-gray-200">振幅: <span class="font-semibold">{{ hoverMetrics.amplitudeText }}</span></div>
      <div :class="hoverMetrics.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
        涨跌幅: <span class="font-semibold">{{ hoverMetrics.changeText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import {
  toCandles,
  atrEmaSeries,
  aboSeriesDual,
  hilbertSineLeadFromInput,
  pdoSeriesValues,
  kalmanFromPoints,
  buildEulerChameleonCandles,
} from '@/utils/chartIndicatorCore'

const MA_COLORS = ['#2962FF', '#FF9800', '#9C27B0', '#00BCD4', '#E91E63', '#4CAF50']

const props = defineProps({
  bars: {
    type: Array,
    default: () => [],
  },
  height: {
    type: Number,
    default: 440,
  },
  /**
   * 均线列表（优先）。每项：{ period, type: 'sma'|'ema', enabled? }。
   * 传入数组（含空数组）时只用该列表；不传此 prop 时用下方 maPeriods + maType（兼容旧用法）。
   */
  maLines: {
    type: Array,
    default: undefined,
  },
  /** 均线周期列表，如 [5, 20, 60]；仅在未传 maLines 时生效 */
  maPeriods: {
    type: Array,
    default: () => [],
  },
  /** 'sma' | 'ema'；仅在 maLines 为 null 时生效 */
  maType: {
    type: String,
    default: 'sma',
  },
  /** AEMA（连击加速 EMA）的加速系数 */
  maAccelerationFactor: {
    type: Number,
    default: 0.5,
  },
  showBollinger: {
    type: Boolean,
    default: false,
  },
  bollingerPeriod: {
    type: Number,
    default: 20,
  },
  bollingerMult: {
    type: Number,
    default: 2,
  },
  /** 是否在独立窗格显示 RSI（基于收盘价） */
  showRsi: {
    type: Boolean,
    default: false,
  },
  /** RSI 周期，默认 14 */
  rsiPeriod: {
    type: Number,
    default: 14,
  },
  /** 是否显示 MACD（独立窗格） */
  showMacd: {
    type: Boolean,
    default: false,
  },
  /** MACD 快线周期 */
  macdFastPeriod: {
    type: Number,
    default: 12,
  },
  /** MACD 慢线周期 */
  macdSlowPeriod: {
    type: Number,
    default: 26,
  },
  /** MACD 信号线周期 */
  macdSignalPeriod: {
    type: Number,
    default: 9,
  },
  /** AMACD 连击加速步长（每连击一根增加 alpha） */
  macdBoostFactor: {
    type: Number,
    default: 0.05,
  },
  /** AMACD 反转势能释放系数（连击反向时额外放大） */
  macdReversalFactor: {
    type: Number,
    default: 0.45,
  },
  /** 是否显示 ATR（独立窗格）：TR 后对周期 N 做 EMA 平滑（海龟常用 N=20） */
  showAtr: {
    type: Boolean,
    default: false,
  },
  /** ATR 周期 N（对 TR 序列的 EMA 长度），默认 20 */
  atrPeriod: {
    type: Number,
    default: 20,
  },
  /**
   * 是否将 ATR 做滚动窗口 Min-Max 归一化到 [0,1]：
   * ATR_norm = (ATR - min) / (max - min)，min/max 取最近 atrNormPeriod 根已算出的 ATR。
   */
  atrNormalize: {
    type: Boolean,
    default: false,
  },
  /** 归一化滚动窗口长度（块数），默认 100 */
  atrNormPeriod: {
    type: Number,
    default: 100,
  },
  /** 主图叠加 SuperTrend（ATR 用 Wilder；与 ATR 子图 EMA 算法不同） */
  showSuperTrend: {
    type: Boolean,
    default: false,
  },
  /** SuperTrend 的 ATR 周期（默认 10） */
  superTrendAtrPeriod: {
    type: Number,
    default: 10,
  },
  /** SuperTrend 的 ATR 乘数（默认 3） */
  superTrendMultiplier: {
    type: Number,
    default: 3,
  },
  /** 是否显示 Z-Score（独立窗格，基于 close 的滚动标准分） */
  showZscore: {
    type: Boolean,
    default: false,
  },
  /** Z-Score 的滚动窗口长度 */
  zscorePeriod: {
    type: Number,
    default: 60,
  },
  /** 是否显示 Z-Score 快慢线（对 Z 序列做 EMA） */
  showZscoreFastSlow: {
    type: Boolean,
    default: false,
  },
  /** Z-Score 快线 EMA 周期 */
  zscoreFastPeriod: {
    type: Number,
    default: 5,
  },
  /** Z-Score 慢线 EMA 周期 */
  zscoreSlowPeriod: {
    type: Number,
    default: 15,
  },
  /** 是否显示卡尔曼快慢线（基于 Z-Score 序列） */
  showKalmanFastSlow: {
    type: Boolean,
    default: false,
  },
  /** 卡尔曼快线过程噪声 Q（越大越灵敏） */
  kalmanFastQ: {
    type: Number,
    default: 0.08,
  },
  /** 卡尔曼快线测量噪声 R（越大越平滑） */
  kalmanFastR: {
    type: Number,
    default: 0.2,
  },
  /** 卡尔曼慢线过程噪声 Q（越小越平滑） */
  kalmanSlowQ: {
    type: Number,
    default: 0.01,
  },
  /** 卡尔曼慢线测量噪声 R（越大越平滑） */
  kalmanSlowR: {
    type: Number,
    default: 0.8,
  },
  /** 卡尔曼输入源：zscore / aboFast / aboSlow / aboZscore / aboAdi / aboAvi */
  kalmanSource: {
    type: String,
    default: 'zscore',
    validator: (v) =>
      v === 'zscore' ||
      v === 'aboFast' ||
      v === 'aboSlow' ||
      v === 'aboZscore' ||
      v === 'aboAdi' ||
      v === 'aboAvi',
  },
  /** 是否显示 ABO（Asymmetric Beta Oscillator） */
  showAbo: {
    type: Boolean,
    default: false,
  },
  /** ABO 的 EMA 平滑周期 */
  aboEmaPeriod: {
    type: Number,
    default: 14,
  },
  /** ABO 快线周期（默认 7） */
  aboFastPeriod: {
    type: Number,
    default: 7,
  },
  /** ABO 慢线周期（默认 21） */
  aboSlowPeriod: {
    type: Number,
    default: 21,
  },
  /** ABO 展示模式：fast / slow / both */
  aboDisplayMode: {
    type: String,
    default: 'fast',
    validator: (v) => v === 'fast' || v === 'slow' || v === 'both',
  },
  /** ABO 强弱阈值（±threshold） */
  aboThreshold: {
    type: Number,
    default: 0.5,
  },
  /** ABO beta 是否启用非线性软截断（tanh），用于抑制分母接近 0 的数值爆炸 */
  aboSoftClamp: {
    type: Boolean,
    default: false,
  },
  /** tanh 输入缩放：beta' = tanh(raw / div) * range */
  aboSoftClampDiv: {
    type: Number,
    default: 2.0,
  },
  /** tanh 输出区间幅度：默认压到 (-3, 3) */
  aboSoftClampRange: {
    type: Number,
    default: 3.0,
  },
  /** 是否对最终 ABO 分数（EMA 差值）再做一次 tanh 收缩，确保显示严格落在 (-range, range) */
  aboSoftClampScore: {
    type: Boolean,
    default: false,
  },
  /** ABO 连击反转加速开关：反转首根对 score 变化做一次性放大 */
  aboReversalBoost: {
    type: Boolean,
    default: false,
  },
  /** ABO 连击反转加速系数（One-Shot Momentum Booster） */
  aboReversalBoostFactor: {
    type: Number,
    default: 0.45,
  },
  /** ABO 使用成交量加权收益率：R'_alt = R_alt * (V_t / SMA(V, N)) */
  aboVolumeWeighted: {
    type: Boolean,
    default: false,
  },
  /** 成交量因子周期 N（SMA） */
  aboVolumePeriod: {
    type: Number,
    default: 20,
  },
  /** ABO 是否启用 beta 极值截断（Winsorizing） */
  aboWinsorize: {
    type: Boolean,
    default: true,
  },
  /** ABO beta 极值截断阈值：rawBeta 被限制到 [-limit, +limit] */
  aboWinsorLimit: {
    type: Number,
    default: 5.0,
  },
  /** ABO 收益率计算前价格预平滑 EMA 周期（1=关闭） */
  aboPreSmoothPeriod: {
    type: Number,
    default: 3,
  },
  /** ABO 去噪：过滤基准小波动（低于阈值则沿用上一根 ABO 值） */
  aboBenchmarkNoiseFilter: {
    type: Boolean,
    default: false,
  },
  /** 基准最小波动阈值（百分比），例如 0.1 表示 0.1% */
  aboBenchmarkMinMovePct: {
    type: Number,
    default: 0.1,
  },
  /** 是否显示 ABO Z-Score（独立窗格） */
  showAboZscore: {
    type: Boolean,
    default: false,
  },
  /** ABO Z-Score 滚动窗口长度 */
  aboZscorePeriod: {
    type: Number,
    default: 120,
  },
  /** ABO Z-Score 基于哪条线：fast / slow */
  aboZscoreSource: {
    type: String,
    default: 'fast',
    validator: (v) => v === 'fast' || v === 'slow',
  },
  /** ABO Z-Score 阈值线（±） */
  aboZscoreThreshold: {
    type: Number,
    default: 2.0,
  },
  /** 是否显示 ABO ADI (Asymmetric Dominance Index) */
  showAboAdi: {
    type: Boolean,
    default: false,
  },
  /** ABO ADI 滚动窗口长度 */
  aboAdiPeriod: {
    type: Number,
    default: 60,
  },
  /** 是否显示 ABO AVI (ABO Valuation Index) */
  showAboAvi: {
    type: Boolean,
    default: false,
  },
  /** ABO AVI 滚动窗口长度 */
  aboAviPeriod: {
    type: Number,
    default: 100,
  },
  /** AVI 柱是否做一维卡尔曼平滑；默认 false 与 BrickAviStrategy 原始 AVI 对齐，需要更平滑柱体时再打开 */
  aboAviUseKalman: {
    type: Boolean,
    default: false,
  },
  /** AVI 卡尔曼过程噪声 Q（越大状态越跟测量） */
  aboAviKalmanQ: {
    type: Number,
    default: 0.08,
  },
  /** AVI 卡尔曼测量噪声 R（越大柱体越平滑） */
  aboAviKalmanR: {
    type: Number,
    default: 0.2,
  },
  /**
   * 在与 ABO 同源算出原始 AVI 后，将四维盘「周期」窗的希尔伯特 Sin(θ)、领先 Sin(θ+45°) 叠在主图 K 线窗格（独立 overlay 价位轴，与蜡烛量纲分离）。
   * 与 Renko 周期子图一致：基于**原始 AVI**，不受 AVI 柱卡尔曼开关影响。
   */
  showAboAviPhaseOnMain: {
    type: Boolean,
    default: false,
  },
  /**
   * 相位差振荡器 PDO：副图柱状图 LeadSin−Sin（过零≈两线交叉；柱顶/底平台≈两线平行、周期锁死）。
   * 与 hilbertSineLeadFromInput 同源，基于原始 AVI。
   */
  showAboAviPdoHistogram: {
    type: Boolean,
    default: false,
  },
  /** ABO 基准（通常是 BTC）K 线 bars，结构同主 bars */
  aboBenchmarkBars: {
    type: Array,
    default: () => [],
  },
  /** ABO 计算源 K 线 bars；不传时默认使用主 bars（用于展示与计算解耦） */
  aboSourceBars: {
    type: Array,
    default: () => [],
  },
  /**
   * 合成价差欧拉序列（真 θ）：与当前 `bars` 时间对齐，由父组件用
   * `eulerSpreadResonanceFromAlignedBrickRows`（chartIndicatorCore）算出；用于对数价差图副图 PDO/sin/cos。
   */
  syntheticSpreadEulerPts: {
    type: Array,
    default: () => [],
  },
  /** 在独立副图绘制 PDO·价差欧拉 + sinθ + cosθ（非 AVI 希尔伯特） */
  showSyntheticSpreadEuler: {
    type: Boolean,
    default: false,
  },
  /** 价差主图变色龙：A 低于该阈（共振模长）时用中性灰；≤0 关闭 */
  syntheticEulerChameleonMinA: {
    type: Number,
    default: 1.2,
  },
  /** 价差欧拉 Z 的滚动 σ 相对地板：全序列窗 σ 均值 × 该比例；≤0 关闭 */
  syntheticEulerZVolatilityFloorRatio: {
    type: Number,
    default: 0.2,
  },
  /** 价差欧拉 Z 的 σ 绝对下限；≤0 关闭 */
  syntheticEulerZSigmaFloorAbs: {
    type: Number,
    default: 0,
  },
  /**
   * RSI 平滑方式：
   * - 'wilder'：经典 Wilder，与多数软件一致
   * - 'ema'：对涨跌用 EMA，反应更快
   * - 'streak-ema'：EMA + 连涨连跌动能加权（与 Java 端 Streak-Weighted EMA RSI 对齐）
   * - 'damped-ema'：EMA + 连击阻尼（连击越长，新增动能推力越小）
   * - 'spring-reversal'：弹簧势能反转（顺势阻尼 + 反向加速）
   */
  rsiSmoothing: {
    type: String,
    default: 'wilder',
    validator: (v) =>
      v === 'wilder' || v === 'ema' || v === 'streak-ema' || v === 'damped-ema' || v === 'spring-reversal',
  },
  /** streak-ema 模式的连涨/连跌惩罚系数（每连一根增幅） */
  rsiStreakPenalty: {
    type: Number,
    default: 0.1,
  },
  /** damped-ema 模式的连击阻尼系数（每连一根衰减力度） */
  rsiDampeningFactor: {
    type: Number,
    default: 0.2,
  },
  /** spring-reversal 模式的反转加速系数（顺势累计越大，反向一根放大越强） */
  rsiReversalFactor: {
    type: Number,
    default: 0.45,
  },
  /** damped-ema 模式的连击记忆保留率（反向时保留多少既有惯性） */
  rsiRetentionRate: {
    type: Number,
    default: 0.6,
  },
  /**
   * 右侧价格轴与十字线/OHLC 显示的小数位数；不传则使用库默认（多为 2 位）。
   * 砖石图等需与数据精度一致时可设为 4。
   */
  priceDecimals: {
    type: Number,
    default: undefined,
  },
  /**
   * 十字线「振幅% / 涨跌幅%」口径：
   * - price（默认）：按价格 K 线，(h−l)/o、(c−o)/o×100。
   * - logSpread：OHLC 为 ln(主)−ln(基) 时，在比价 R=exp(价差) 上算 (R收/R开−1)×100 与单砖内比价极差%，避免把小量级 o 当分母导致荒谬百分比。
   */
  crosshairPctBasis: {
    type: String,
    default: 'price',
    validator: (v) => v === 'price' || v === 'logSpread',
  },
  /** 时间显示时区（用于横轴刻度/十字线时间），默认与回测报告一致 */
  timeZone: {
    type: String,
    default: 'Asia/Tokyo',
  },
  /** 主图类型：candlestick(默认) 或 line（收盘价折线） */
  mainSeriesType: {
    type: String,
    default: 'candlestick',
  },
})

const wrapRef = ref(null)
let chart = null
let candleSeries = null
let mainLineSeries = null
/** @type {import('lightweight-charts').ISeriesApi<'Line'>[]} */
let lineSeriesList = []
let ro = null
let crosshairHandler = null
const hoverMetrics = ref({
  visible: false,
  left: 0,
  top: 0,
  openText: '0',
  highText: '0',
  lowText: '0',
  closeText: '0',
  amplitudeText: '0.00%',
  changeText: '0.00%',
  changePct: 0,
})

function toEpochSeconds(time) {
  if (typeof time === 'number') return time
  if (time && typeof time === 'object' && Number.isFinite(time.year) && Number.isFinite(time.month) && Number.isFinite(time.day)) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000)
  }
  return NaN
}

function formatChartTime(time, timeZone, withSeconds) {
  const sec = toEpochSeconds(time)
  if (!Number.isFinite(sec)) return ''
  const d = new Date(sec * 1000)
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: timeZone || 'Asia/Tokyo',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(d)
}

function extractClosesAndTimes(candles) {
  const closes = []
  const times = []
  for (const c of candles) {
    closes.push(c.close)
    times.push(c.time)
  }
  return { closes, times }
}

/**
 * 对 ATR 序列做滚动窗口 Min-Max 归一化到 [0,1]。
 * 窗口为当前点及之前共 window 个 ATR 值（不足 window 时用已有历史）。
 * min==max 时输出 0.5，避免除零。
 */
function rollingMinMaxNormalizeAtr(atrPoints, windowSize) {
  const W = Math.max(2, Math.min(2000, Math.floor(Number(windowSize)) || 100))
  if (!atrPoints?.length) return []
  // 基准收益过小会导致 beta 爆炸；并且单边行情时未更新的一侧应随时间衰减。
  const eps = 1e-6
  const out = []
  for (let i = 0; i < atrPoints.length; i++) {
    const start = Math.max(0, i - W + 1)
    let minV = Infinity
    let maxV = -Infinity
    for (let j = start; j <= i; j++) {
      const v = atrPoints[j].value
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const v = atrPoints[i].value
    let norm
    if (maxV - minV < eps) {
      norm = 0.5
    } else {
      norm = (v - minV) / (maxV - minV)
    }
    out.push({ time: atrPoints[i].time, value: norm })
  }
  return out
}

/**
 * Wilder ATR（RMA）：对 TR 序列首段 SMA 种子，之后 ATR = (ATR_prev * (n-1) + TR) / n。
 * 与常见 SuperTrend 实现一致（与 ATR 子图里用的 EMA 版不同）。
 */
function wilderAtrArray(candles, period) {
  const n = candles.length
  const atr = new Array(n).fill(NaN)
  const p = Math.max(2, Math.min(200, Math.floor(Number(period)) || 10))
  if (n < p + 1) return atr

  const tr = new Array(n).fill(NaN)
  for (let i = 1; i < n; i++) {
    const h = candles[i].high
    const l = candles[i].low
    const pc = candles[i - 1].close
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
  }

  let sum = 0
  for (let i = 1; i <= p; i++) sum += tr[i]
  let atrVal = sum / p
  atr[p] = atrVal

  for (let i = p + 1; i < n; i++) {
    atrVal = (atrVal * (p - 1) + tr[i]) / p
    atr[i] = atrVal
  }
  return atr
}

/**
 * SuperTrend：中轨 MP=(H+L)/2，ATR 用 Wilder；最终上下轨锁定；收盘相对最终上轨决定显示上轨（红）或下轨（绿）。
 * 返回两组折线，便于在 lightweight-charts 里用双色绘制。
 */
function superTrendSeries(candles, atrPeriod, multiplier) {
  const bull = []
  const bear = []
  const n = candles.length
  const p = Math.max(2, Math.min(200, Math.floor(Number(atrPeriod)) || 10))
  const mult = Math.max(0.1, Math.min(20, Number(multiplier) || 3))
  const atr = wilderAtrArray(candles, p)
  if (n < p + 1) return { bull, bear }

  let prevFU = NaN
  let prevFL = NaN
  let prevClose = NaN

  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(atr[i])) continue
    const h = candles[i].high
    const l = candles[i].low
    const c = candles[i].close
    const t = candles[i].time
    const mp = (h + l) / 2
    const bu = mp + mult * atr[i]
    const bl = mp - mult * atr[i]

    let fu
    let fl
    if (!Number.isFinite(prevFU)) {
      fu = bu
      fl = bl
    } else {
      fu = bu < prevFU || prevClose > prevFU ? bu : prevFU
      fl = bl > prevFL || prevClose < prevFL ? bl : prevFL
    }

    if (c <= fu) {
      bear.push({ time: t, value: fu })
    } else {
      bull.push({ time: t, value: fl })
    }

    prevFU = fu
    prevFL = fl
    prevClose = c
  }
  return { bull, bear }
}

function smaSeries(closes, times, period) {
  const out = []
  for (let i = period - 1; i < closes.length; i++) {
    let s = 0
    for (let j = i - period + 1; j <= i; j++) s += closes[j]
    out.push({ time: times[i], value: s / period })
  }
  return out
}

function emaSeries(closes, times, period) {
  const k = 2 / (period + 1)
  const out = []
  let ema = 0
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue
    if (i === period - 1) {
      let s = 0
      for (let j = 0; j < period; j++) s += closes[j]
      ema = s / period
    } else {
      ema = closes[i] * k + ema * (1 - k)
    }
    out.push({ time: times[i], value: ema })
  }
  return out
}

/**
 * 连击加速 EMA（AEMA）：
 * 连涨/连跌时动态放大 alpha，使均线更贴近价格。
 */
function acceleratedEmaSeries(closes, times, period, accelerationFactor) {
  if (!closes.length) return []
  const p = Math.max(2, period)
  const kBase = 2 / (p + 1)
  const af = Math.max(0, Math.min(2, Number(accelerationFactor) || 0.5))
  const out = []

  let ema = closes[0]
  let streakUp = 0
  let streakDown = 0
  out.push({ time: times[0], value: ema })

  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]
    const cur = closes[i]
    if (cur > prev + 1e-12) {
      streakUp += 1
      streakDown = 0
    } else if (cur < prev - 1e-12) {
      streakDown += 1
      streakUp = 0
    } else {
      streakUp = 0
      streakDown = 0
    }
    const streak = Math.max(streakUp, streakDown)
    const k = Math.min(1, kBase * (1 + Math.max(0, streak - 1) * af))
    ema = cur * k + ema * (1 - k)
    out.push({ time: times[i], value: ema })
  }

  return out.slice(Math.max(0, p - 1))
}

/** Wilder RSI，与常见交易软件一致；输出与 times 对齐的 { time, value }[] */
function wilderRsiSeries(closes, times, period) {
  const len = closes.length
  if (len < period + 1) return []

  const changes = []
  for (let i = 1; i < len; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    const ch = changes[i]
    if (ch > 0) avgGain += ch
    else avgLoss -= ch
  }
  avgGain /= period
  avgLoss /= period

  const out = []
  const rsiAt = () => {
    let rsi
    if (avgLoss === 0 && avgGain === 0) rsi = 50
    else if (avgLoss === 0) rsi = 100
    else {
      const rs = avgGain / avgLoss
      rsi = 100 - 100 / (1 + rs)
    }
    return rsi
  }

  out.push({ time: times[period], value: rsiAt() })

  for (let i = period + 1; i < len; i++) {
    const ch = changes[i - 1]
    const gain = ch > 0 ? ch : 0
    const loss = ch < 0 ? -ch : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out.push({ time: times[i], value: rsiAt() })
  }
  return out
}

/**
 * RSI（EMA 平滑版）：首段用 SMA 种子，之后对 avgGain/avgLoss 用 EMA，alpha = 2/(period+1)。
 * 比 Wilder 更灵敏，适合砖石图等已降噪的序列上做动能/反转。
 */
function emaRsiSeries(closes, times, period) {
  const len = closes.length
  if (len < period + 1) return []

  const changes = []
  for (let i = 1; i < len; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    const ch = changes[i]
    if (ch > 0) avgGain += ch
    else avgLoss -= ch
  }
  avgGain /= period
  avgLoss /= period

  const k = 2 / (period + 1)
  const out = []
  const rsiAt = () => {
    if (avgLoss === 0 && avgGain === 0) return 50
    if (avgLoss === 0) return 100
    if (avgGain === 0) return 0
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }

  out.push({ time: times[period], value: rsiAt() })

  for (let i = period + 1; i < len; i++) {
    const ch = changes[i - 1]
    const gain = ch > 0 ? ch : 0
    const loss = ch < 0 ? -ch : 0
    avgGain = avgGain * (1 - k) + gain * k
    avgLoss = avgLoss * (1 - k) + loss * k
    out.push({ time: times[i], value: rsiAt() })
  }
  return out
}

/**
 * RSI（Streak-Weighted EMA）：
 * EMA 平滑 avgGain/avgLoss，同时按连续涨跌根数放大对应动能。
 * 对齐 Java 端 RsiState 的 streakPenalty 逻辑。
 */
function streakEmaRsiSeries(closes, times, period, streakPenalty) {
  const len = closes.length
  if (len < period + 1) return []

  const changes = []
  for (let i = 1; i < len; i++) changes.push(closes[i] - closes[i - 1])

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    const ch = changes[i]
    if (ch > 0) avgGain += ch
    else avgLoss -= ch
  }
  avgGain /= period
  avgLoss /= period

  const k = 2 / (period + 1)
  let streakUp = 0
  let streakDown = 0
  for (let i = 0; i < period; i++) {
    const ch = changes[i]
    if (ch > 0) {
      streakUp++
      streakDown = 0
    } else if (ch < 0) {
      streakDown++
      streakUp = 0
    }
  }

  const rsiFromAdjusted = (u, d) => {
    if (d === 0 && u === 0) return 50
    if (d === 0) return 100
    if (u === 0) return 0
    const rs = u / d
    return 100 - 100 / (1 + rs)
  }

  const out = []
  const firstUp = avgGain * (1 + streakUp * streakPenalty)
  const firstDown = avgLoss * (1 + streakDown * streakPenalty)
  out.push({ time: times[period], value: rsiFromAdjusted(firstUp, firstDown) })

  for (let i = period + 1; i < len; i++) {
    const ch = changes[i - 1]
    const gain = ch > 0 ? ch : 0
    const loss = ch < 0 ? -ch : 0
    avgGain = gain * k + avgGain * (1 - k)
    avgLoss = loss * k + avgLoss * (1 - k)
    if (gain > 0) {
      streakUp++
      streakDown = 0
    } else if (loss > 0) {
      streakDown++
      streakUp = 0
    }
    const adjustedUp = avgGain * (1 + streakUp * streakPenalty)
    const adjustedDown = avgLoss * (1 + streakDown * streakPenalty)
    out.push({ time: times[i], value: rsiFromAdjusted(adjustedUp, adjustedDown) })
  }
  return out
}

/**
 * RSI（Memory-Decay + Dampened EMA）：
 * 使用浮点 streak，并在反向时按 retentionRate 衰减而非清零。
 * streak 越长，当前砖对 avgGain/avgLoss 的新增推力越小。
 * 公式：damped = raw / (1 + max(0, streak-1) * dampeningFactor)
 */
function dampedEmaRsiSeries(closes, times, period, dampeningFactor, retentionRate) {
  const len = closes.length
  if (len < period + 1) return []

  const changes = []
  for (let i = 1; i < len; i++) changes.push(closes[i] - closes[i - 1])

  let avgGain = 0
  let avgLoss = 0
  let streakUp = 0.0
  let streakDown = 0.0

  for (let i = 0; i < period; i++) {
    const ch = changes[i]
    const rawUp = ch > 0 ? ch : 0
    const rawDown = ch < 0 ? -ch : 0
    if (rawUp > 0) {
      streakUp = streakUp * retentionRate + 1.0
      streakDown = streakDown * retentionRate
    } else if (rawDown > 0) {
      streakDown = streakDown * retentionRate + 1.0
      streakUp = streakUp * retentionRate
    } else {
      streakUp = streakUp * retentionRate
      streakDown = streakDown * retentionRate
    }
    const dampedUp = rawUp / (1 + Math.max(0, streakUp - 1.0) * dampeningFactor)
    const dampedDown = rawDown / (1 + Math.max(0, streakDown - 1.0) * dampeningFactor)
    avgGain += dampedUp
    avgLoss += dampedDown
  }
  avgGain /= period
  avgLoss /= period

  const k = 2 / (period + 1)
  const out = []
  const rsiAt = () => {
    if (avgLoss === 0 && avgGain === 0) return 50
    if (avgLoss === 0) return 100
    if (avgGain === 0) return 0
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }
  out.push({ time: times[period], value: rsiAt() })

  for (let i = period + 1; i < len; i++) {
    const ch = changes[i - 1]
    const rawUp = ch > 0 ? ch : 0
    const rawDown = ch < 0 ? -ch : 0
    if (rawUp > 0) {
      streakUp = streakUp * retentionRate + 1.0
      streakDown = streakDown * retentionRate
    } else if (rawDown > 0) {
      streakDown = streakDown * retentionRate + 1.0
      streakUp = streakUp * retentionRate
    } else {
      streakUp = streakUp * retentionRate
      streakDown = streakDown * retentionRate
    }
    const dampedUp = rawUp / (1 + Math.max(0, streakUp - 1.0) * dampeningFactor)
    const dampedDown = rawDown / (1 + Math.max(0, streakDown - 1.0) * dampeningFactor)
    avgGain = dampedUp * k + avgGain * (1 - k)
    avgLoss = dampedDown * k + avgLoss * (1 - k)
    out.push({ time: times[i], value: rsiAt() })
  }
  return out
}

/**
 * RSI（Spring Reversal）：
 * 顺势时做阻尼（越涨/跌越“吃力”），反转首根放大（把前序连击势能一次释放）。
 * 逻辑与策略端 RsiState 对齐：ModifiedUp/ModifiedDown 后再做 EMA 平滑。
 */
function springReversalRsiSeries(closes, times, period, dampeningFactor, reversalFactor) {
  const len = closes.length
  if (len < period + 1) return []

  const changes = []
  for (let i = 1; i < len; i++) changes.push(closes[i] - closes[i - 1])

  let avgGain = 0
  let avgLoss = 0
  let count = 0
  let consecutiveUp = 0
  let consecutiveDown = 0
  const alpha = 2 / (period + 1)
  const out = []

  const rsiAt = () => {
    if (avgLoss === 0 && avgGain === 0) return 50
    if (avgLoss === 0) return 100
    if (avgGain === 0) return 0
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }

  for (let i = 0; i < changes.length; i++) {
    const ch = changes[i]
    const rawUp = ch > 0 ? ch : 0
    const rawDown = ch < 0 ? -ch : 0
    let modifiedUp = 0
    let modifiedDown = 0

    if (rawUp > 0) {
      if (consecutiveDown > 0) {
        modifiedUp = rawUp * (1 + consecutiveDown * reversalFactor)
      } else {
        modifiedUp = rawUp / (1 + consecutiveUp * dampeningFactor)
      }
      consecutiveUp += 1
      consecutiveDown = 0
    } else if (rawDown > 0) {
      if (consecutiveUp > 0) {
        modifiedDown = rawDown * (1 + consecutiveUp * reversalFactor)
      } else {
        modifiedDown = rawDown / (1 + consecutiveDown * dampeningFactor)
      }
      consecutiveDown += 1
      consecutiveUp = 0
    }

    if (count < period) {
      avgGain += modifiedUp
      avgLoss += modifiedDown
      count += 1
      if (count === period) {
        avgGain /= period
        avgLoss /= period
        out.push({ time: times[i + 1], value: rsiAt() })
      }
    } else {
      avgGain = modifiedUp * alpha + avgGain * (1 - alpha)
      avgLoss = modifiedDown * alpha + avgLoss * (1 - alpha)
      out.push({ time: times[i + 1], value: rsiAt() })
    }
  }

  return out
}

function computeRsiSeries(
  closes,
  times,
  period,
  smoothing,
  streakPenalty,
  dampeningFactor,
  retentionRate,
  reversalFactor
) {
  if (smoothing === 'ema') return emaRsiSeries(closes, times, period)
  if (smoothing === 'streak-ema') return streakEmaRsiSeries(closes, times, period, streakPenalty)
  if (smoothing === 'damped-ema') return dampedEmaRsiSeries(closes, times, period, dampeningFactor, retentionRate)
  if (smoothing === 'spring-reversal')
    return springReversalRsiSeries(closes, times, period, dampeningFactor, reversalFactor)
  return wilderRsiSeries(closes, times, period)
}

function bollingerSeries(closes, times, period, mult) {
  const upper = []
  const middle = []
  const lower = []
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, x) => a + (x - mean) ** 2, 0) / period
    const sd = Math.sqrt(Math.max(0, variance))
    const t = times[i]
    middle.push({ time: t, value: mean })
    upper.push({ time: t, value: mean + mult * sd })
    lower.push({ time: t, value: mean - mult * sd })
  }
  return { upper, middle, lower }
}

/**
 * Z-Score（滚动标准分）：
 * z = (x - mean(window)) / std(window)，窗口包含当前点。
 * std 过小（近似常数）时输出 0，避免除零噪声。
 */
function zscoreSeries(closes, times, period) {
  const p = Math.max(2, Math.min(1000, Math.floor(Number(period)) || 60))
  if (!Array.isArray(closes) || closes.length < p) return []
  const out = []
  for (let i = p - 1; i < closes.length; i++) {
    const start = i - p + 1
    let sum = 0
    for (let j = start; j <= i; j++) sum += closes[j]
    const mean = sum / p
    let varSum = 0
    for (let j = start; j <= i; j++) {
      const d = closes[j] - mean
      varSum += d * d
    }
    const std = Math.sqrt(Math.max(0, varSum / p))
    const z = std > 1e-12 ? (closes[i] - mean) / std : 0
    out.push({ time: times[i], value: z })
  }
  return out
}

/** 输入点序列 [{time,value}]，输出对应 rolling z-score 点序列 */
function zscoreFromPoints(points, period) {
  const p = Math.max(2, Math.min(2000, Math.floor(Number(period)) || 120))
  if (!Array.isArray(points) || points.length < p) return []
  const vals = []
  const ts = []
  for (const pt of points) {
    const t = Number(pt?.time)
    const v = Number(pt?.value)
    if (Number.isFinite(t) && Number.isFinite(v)) {
      ts.push(t)
      vals.push(v)
    }
  }
  if (vals.length < p) return []
  return zscoreSeries(vals, ts, p)
}

/** 输入点序列 [{time,value}]，输出 EMA 点序列（首点作为 EMA 初值） */
function emaFromPoints(points, period) {
  const p = Math.max(1, Math.min(1000, Math.floor(Number(period)) || 5))
  if (!Array.isArray(points) || !points.length) return []
  const k = 2 / (p + 1)
  const out = []
  let ema = Number.NaN
  for (const pt of points) {
    const t = Number(pt?.time)
    const v = Number(pt?.value)
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue
    if (!Number.isFinite(ema)) ema = v
    else ema = v * k + ema * (1 - k)
    out.push({ time: t, value: ema })
  }
  return out
}

/** AMACD：连击加速 + 反转势能释放版 MACD */
function acceleratedMacdSeries(
  closes,
  times,
  fastPeriod,
  slowPeriod,
  signalPeriod,
  boostFactor,
  reversalFactor,
  isDark
) {
  const len = closes.length
  if (len < 3) return { macd: [], signal: [], hist: [] }

  const fast = Math.max(2, Math.floor(Number(fastPeriod) || 12))
  const slow = Math.max(fast + 1, Math.floor(Number(slowPeriod) || 26))
  const signal = Math.max(2, Math.floor(Number(signalPeriod) || 9))
  const boost = Math.max(0, Math.min(0.3, Number(boostFactor) || 0.05))
  const reversal = Math.max(0, Math.min(3, Number(reversalFactor) || 0.45))
  if (len < slow + signal) return { macd: [], signal: [], hist: [] }

  const alphaFastBase = 2.0 / (fast + 1.0)
  const alphaSlowBase = 2.0 / (slow + 1.0)
  const alphaSignalBase = 2.0 / (signal + 1.0)
  const adaptiveAlpha = (base, streak) => Math.min(0.8, base + Math.abs(streak) * boost)

  let emaFast = Number.NaN
  let emaSlow = Number.NaN
  let emaSignal = Number.NaN
  let dif = Number.NaN
  let dea = Number.NaN

  let priceStreak = 0
  let lastDif = Number.NaN
  let difConsecutiveUp = 0
  let difConsecutiveDown = 0
  let signalSeedSum = 0
  let signalSeedCount = 0
  let count = 0

  const macdOut = []
  const signalOut = []
  const histOut = []

  for (let i = 0; i < len; i++) {
    const c = closes[i]

    // 1) 价格连击：用于快慢线 alpha 自适应
    if (i > 0) {
      const prev = closes[i - 1]
      if (c > prev + 1e-12) {
        priceStreak = priceStreak > 0 ? priceStreak + 1 : 1
      } else if (c < prev - 1e-12) {
        priceStreak = priceStreak < 0 ? priceStreak - 1 : -1
      } else {
        priceStreak = 0
      }
    }

    const alphaFast = adaptiveAlpha(alphaFastBase, priceStreak)
    const alphaSlow = adaptiveAlpha(alphaSlowBase, priceStreak)
    if (!Number.isFinite(emaFast)) emaFast = c
    else emaFast = (c - emaFast) * alphaFast + emaFast
    if (!Number.isFinite(emaSlow)) emaSlow = c
    else emaSlow = (c - emaSlow) * alphaSlow + emaSlow

    count++
    if (count < slow) continue

    // 2) DIF 反转势能释放：涨转跌/跌转涨时把 change 放大
    const rawDif = emaFast - emaSlow
    if (!Number.isFinite(lastDif)) {
      dif = rawDif
      lastDif = dif
      continue
    }

    let modifiedChange = 0
    const change = rawDif - lastDif
    if (change > 1e-12) {
      if (difConsecutiveDown > 0) modifiedChange = change * (1.0 + difConsecutiveDown * reversal)
      else modifiedChange = change
      difConsecutiveUp += 1
      difConsecutiveDown = 0
    } else if (change < -1e-12) {
      if (difConsecutiveUp > 0) modifiedChange = change * (1.0 + difConsecutiveUp * reversal)
      else modifiedChange = change
      difConsecutiveDown += 1
      difConsecutiveUp = 0
    } else {
      modifiedChange = 0
    }
    dif = lastDif + modifiedChange
    lastDif = dif

    // 3) DEA 继续用 DIF 连击加速
    const difNetStreak = difConsecutiveUp > 0 ? difConsecutiveUp : -difConsecutiveDown
    if (!Number.isFinite(emaSignal)) {
      signalSeedSum += dif
      signalSeedCount += 1
      if (signalSeedCount < signal) continue
      emaSignal = signalSeedSum / signal
    } else {
      const alphaSignal = adaptiveAlpha(alphaSignalBase, difNetStreak)
      emaSignal = (dif - emaSignal) * alphaSignal + emaSignal
    }
    dea = emaSignal

    const h = dif - dea
    macdOut.push({ time: times[i], value: dif })
    signalOut.push({ time: times[i], value: dea })
    histOut.push({
      time: times[i],
      value: h,
      color: h >= 0 ? (isDark ? '#22c55e' : '#16a34a') : (isDark ? '#f87171' : '#dc2626'),
    })
  }

  if (macdOut.length < 1) {
    return { macd: [], signal: [], hist: [] }
  }

  return { macd: macdOut, signal: signalOut, hist: histOut }
}

function normalizeMaPeriods(raw) {
  if (!raw?.length) return []
  const seen = new Set()
  const out = []
  for (const x of raw) {
    const n = Math.floor(Number(x))
    if (Number.isFinite(n) && n >= 2 && n <= 500 && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out.sort((a, b) => a - b)
}

/** @returns {{ period: number, type: 'sma'|'ema'|'aema' }[]} */
/** @returns {{ type: 'price', precision: number, minMove: number } | undefined} */
function priceFormatFromDecimals(decimals) {
  const n = Number(decimals)
  if (!Number.isFinite(n) || n < 0 || n > 8) return undefined
  const p = Math.floor(n)
  const minMove = p === 0 ? 1 : 10 ** -p
  return { type: 'price', precision: p, minMove }
}

function resolveMaDefinitions(props) {
  if (Array.isArray(props.maLines)) {
    return props.maLines
      .filter((x) => x && x.enabled !== false && Number.isFinite(Number(x.period)))
      .map((x) => ({
        period: Math.max(2, Math.min(500, Math.floor(Number(x.period)))),
        type: x.type === 'ema' ? 'ema' : x.type === 'aema' ? 'aema' : 'sma',
      }))
  }
  const periods = normalizeMaPeriods(props.maPeriods)
  const useAema = props.maType === 'aema'
  const useEma = props.maType === 'ema'
  return periods.map((p) => ({ period: p, type: useAema ? 'aema' : useEma ? 'ema' : 'sma' }))
}

function mountChart() {
  const el = wrapRef.value
  if (!el) return
  teardownChart()
  const w = Math.max(el.clientWidth || 320, 320)
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  chart = createChart(el, {
    width: w,
    height: props.height,
    layout: {
      background: { color: isDark ? '#1e1e2e' : '#ffffff' },
      textColor: isDark ? '#cdd6f4' : '#333333',
      panes: {
        separatorColor: isDark ? '#45475a' : '#dddddd',
        separatorHoverColor: isDark ? '#585b70' : '#cccccc',
      },
    },
    grid: {
      vertLines: { color: isDark ? '#313244' : '#eeeeee' },
      horzLines: { color: isDark ? '#313244' : '#eeeeee' },
    },
    localization: {
      // Keep crosshair time in a fixed timezone so it matches report pages.
      timeFormatter: (time) => formatChartTime(time, props.timeZone, true),
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter: (time) => formatChartTime(time, props.timeZone, false),
    },
    rightPriceScale: { borderColor: isDark ? '#45475a' : '#cccccc' },
  })
  const pf = priceFormatFromDecimals(props.priceDecimals)
  const candles = toCandles(props.bars)
  if (props.mainSeriesType === 'line') {
    const mainLineOpts = {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
    }
    if (pf) {
      mainLineOpts.priceFormat = pf
    }
    mainLineSeries = chart.addSeries(LineSeries, mainLineOpts)
    if (candles.length) {
      mainLineSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })))
    }
  } else {
    const candleOpts = {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    }
    if (pf) {
      candleOpts.priceFormat = pf
    }
    candleSeries = chart.addSeries(CandlestickSeries, candleOpts)
    if (candles.length) {
      const useSpreadEulerChameleon =
        props.showSyntheticSpreadEuler &&
        Array.isArray(props.syntheticSpreadEulerPts) &&
        props.syntheticSpreadEulerPts.length > 0
      const minA = Number(props.syntheticEulerChameleonMinA)
      const chameleonOpts = Number.isFinite(minA) && minA > 0 ? { minAForColor: minA } : {}
      const candlePayload = useSpreadEulerChameleon
        ? buildEulerChameleonCandles(candles, props.syntheticSpreadEulerPts, isDark, chameleonOpts)
        : candles
      candleSeries.setData(candlePayload)
    }
  }

  const { closes, times } = extractClosesAndTimes(candles)
  const candleByTime = new Map()
  for (const c of candles) candleByTime.set(c.time, c)
  const maDefs = resolveMaDefinitions(props)
  let nextIndicatorPaneIndex = 1

  maDefs.forEach((def, idx) => {
    const p = def.period
    const useAema = def.type === 'aema'
    const useEma = def.type === 'ema'
    const data = useAema
      ? acceleratedEmaSeries(closes, times, p, props.maAccelerationFactor)
      : useEma
        ? emaSeries(closes, times, p)
        : smaSeries(closes, times, p)
    if (!data.length) return
    const lineOpts = {
      color: MA_COLORS[idx % MA_COLORS.length],
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: `${useAema ? 'AEMA' : useEma ? 'EMA' : 'MA'}${p}`,
    }
    if (pf) {
      lineOpts.priceFormat = pf
    }
    const ls = chart.addSeries(LineSeries, lineOpts)
    ls.setData(data)
    lineSeriesList.push(ls)
  })

  if (props.showBollinger && closes.length) {
    const bp = Math.max(2, Math.min(200, Math.floor(props.bollingerPeriod) || 20))
    const bm = Math.max(0.5, Math.min(6, Number(props.bollingerMult) || 2))
    if (closes.length >= bp) {
      const { upper, middle, lower } = bollingerSeries(closes, times, bp, bm)
      const bollStyle = {
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        ...(pf ? { priceFormat: pf } : {}),
      }
      const u = chart.addSeries(LineSeries, {
        ...bollStyle,
        color: isDark ? '#7f8c9a' : '#90a4ae',
        lineStyle: 2,
        title: `BB+${bp}`,
      })
      u.setData(upper)
      lineSeriesList.push(u)
      const m = chart.addSeries(LineSeries, {
        ...bollStyle,
        color: isDark ? '#a0a8b0' : '#78909c',
        title: `BB${bp}`,
      })
      m.setData(middle)
      lineSeriesList.push(m)
      const l = chart.addSeries(LineSeries, {
        ...bollStyle,
        color: isDark ? '#7f8c9a' : '#90a4ae',
        lineStyle: 2,
        title: `BB-${bp}`,
      })
      l.setData(lower)
      lineSeriesList.push(l)
    }
  }

  // SuperTrend：主图叠加，绿=多头（下轨），红=空头（上轨）；ATR 为 Wilder
  if (props.showSuperTrend && candles.length >= 2) {
    const stp = Math.max(2, Math.min(200, Math.floor(Number(props.superTrendAtrPeriod)) || 10))
    const stm = Math.max(0.1, Math.min(20, Number(props.superTrendMultiplier) || 3))
    const { bull, bear } = superTrendSeries(candles, stp, stm)
    const stLineOpts = {
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      ...(pf ? { priceFormat: pf } : {}),
    }
    if (bull.length) {
      const lb = chart.addSeries(LineSeries, {
        ...stLineOpts,
        color: '#26a69a',
        title: `SuperTrend 多(${stp},${stm})`,
      })
      lb.setData(bull)
      lineSeriesList.push(lb)
    }
    if (bear.length) {
      const ub = chart.addSeries(LineSeries, {
        ...stLineOpts,
        color: '#ef5350',
        title: `SuperTrend 空(${stp},${stm})`,
      })
      ub.setData(bear)
      lineSeriesList.push(ub)
    }
  }

  // RSI 子图（pane >=1）：主图为 pane 0（K 线 + 均线 + 布林）
  if (props.showRsi && closes.length) {
    const rp = Math.max(2, Math.min(200, Math.floor(Number(props.rsiPeriod)) || 14))
    const smooth = ['ema', 'streak-ema', 'damped-ema', 'spring-reversal'].includes(props.rsiSmoothing)
      ? props.rsiSmoothing
      : 'wilder'
    const spRaw = Number(props.rsiStreakPenalty)
    const dfRaw = Number(props.rsiDampeningFactor)
    const rrRaw = Number(props.rsiRetentionRate)
    const rfRaw = Number(props.rsiReversalFactor)
    const sp = Math.max(0, Math.min(1, Number.isFinite(spRaw) ? spRaw : 0.1))
    const df = Math.max(0, Math.min(2, Number.isFinite(dfRaw) ? dfRaw : 0.2))
    const rr = Math.max(0, Math.min(0.99, Number.isFinite(rrRaw) ? rrRaw : 0.6))
    const rf = Math.max(0, Math.min(5, Number.isFinite(rfRaw) ? rfRaw : 0.45))
    const rsiData = computeRsiSeries(closes, times, rp, smooth, sp, df, rr, rf)
    if (rsiData.length) {
      const rsiSuffix =
        smooth === 'ema'
          ? '-EMA'
          : smooth === 'streak-ema'
            ? '-STREAK'
            : smooth === 'damped-ema'
              ? '-DAMP'
              : smooth === 'spring-reversal'
                ? '-SPRING'
                : ''
      const rsiLineOpts = {
        color: isDark ? '#cba6f7' : '#9333ea',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `RSI${rsiSuffix}${rp}`,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      }
      const rsiPaneIndex = nextIndicatorPaneIndex++
      const rsiSeries = chart.addSeries(LineSeries, rsiLineOpts, rsiPaneIndex)
      rsiSeries.setData(rsiData)
      lineSeriesList.push(rsiSeries)

      const refLine = (price, alpha) => ({
        price,
        color: isDark ? `rgba(205,214,244,${alpha})` : `rgba(100,116,139,${alpha})`,
        lineWidth: 1,
        lineStyle: 2,
      })
      rsiSeries.createPriceLine(refLine(70, 0.45))
      rsiSeries.createPriceLine(refLine(30, 0.45))
      rsiSeries.createPriceLine({
        price: 50,
        color: isDark ? 'rgba(69,71,90,0.7)' : 'rgba(203,213,225,0.9)',
        lineWidth: 1,
        lineStyle: 2,
      })
    }
  }

  // MACD 子图（独立窗格）
  if (props.showMacd && closes.length) {
    const fast = Math.max(2, Math.min(200, Math.floor(Number(props.macdFastPeriod)) || 12))
    const slow = Math.max(fast + 1, Math.min(300, Math.floor(Number(props.macdSlowPeriod)) || 26))
    const signal = Math.max(2, Math.min(100, Math.floor(Number(props.macdSignalPeriod)) || 9))
    const boostRaw = Number(props.macdBoostFactor)
    const reversalRaw = Number(props.macdReversalFactor)
    const boost = Math.max(0, Math.min(0.3, Number.isFinite(boostRaw) ? boostRaw : 0.05))
    const reversal = Math.max(0, Math.min(3, Number.isFinite(reversalRaw) ? reversalRaw : 0.45))
    const macdData = acceleratedMacdSeries(closes, times, fast, slow, signal, boost, reversal, isDark)
    if (macdData.macd.length && macdData.signal.length) {
      const macdPaneIndex = nextIndicatorPaneIndex++
      const histSeries = chart.addSeries(
        HistogramSeries,
        {
          title: `AMACD-H(${fast},${slow},${signal})`,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        },
        macdPaneIndex
      )
      histSeries.setData(macdData.hist)
      lineSeriesList.push(histSeries)

      const macdLine = chart.addSeries(
        LineSeries,
        {
          color: isDark ? '#60a5fa' : '#2563eb',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: `AMACD(${fast},${slow})`,
          priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        },
        macdPaneIndex
      )
      macdLine.setData(macdData.macd)
      lineSeriesList.push(macdLine)

      const signalLine = chart.addSeries(
        LineSeries,
        {
          color: isDark ? '#fbbf24' : '#d97706',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: `SIGNAL(${signal})`,
          priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        },
        macdPaneIndex
      )
      signalLine.setData(macdData.signal)
      lineSeriesList.push(signalLine)

      macdLine.createPriceLine({
        price: 0,
        color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
        lineWidth: 1,
        lineStyle: 2,
      })
    }
  }

  // ATR 子图（独立窗格）：TR + N 周期 EMA；可选滚动 Min-Max 归一化到 [0,1]
  if (props.showAtr && candles.length >= 2) {
    const ap = Math.max(2, Math.min(200, Math.floor(Number(props.atrPeriod)) || 20))
    const rawAtr = atrEmaSeries(candles, ap)
    if (rawAtr.length) {
      const useNorm = !!props.atrNormalize
      const nw = Math.max(2, Math.min(2000, Math.floor(Number(props.atrNormPeriod)) || 100))
      const atrData = useNorm ? rollingMinMaxNormalizeAtr(rawAtr, nw) : rawAtr
      const atrPaneIndex = nextIndicatorPaneIndex++
      const atrTitle = useNorm
        ? `ATR_norm[0-1] EMA${ap} W${nw}`
        : `ATR(EMA${ap})`
      const atrPrec = useNorm
        ? 4
        : Number.isFinite(Number(props.priceDecimals))
          ? Math.max(0, Math.min(8, Math.floor(Number(props.priceDecimals))))
          : 4
      const atrMinMove = atrPrec === 0 ? 1 : 10 ** -atrPrec
      const atrSeries = chart.addSeries(
        LineSeries,
        {
          color: isDark ? '#94a3b8' : '#64748b',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: atrTitle,
          priceFormat: { type: 'price', precision: atrPrec, minMove: atrMinMove },
        },
        atrPaneIndex
      )
      atrSeries.setData(atrData)
      lineSeriesList.push(atrSeries)
      if (useNorm) {
        atrSeries.createPriceLine({
          price: 0.3,
          color: isDark ? 'rgba(251,191,36,0.85)' : 'rgba(217,119,6,0.9)',
          lineWidth: 1,
          lineStyle: 2,
        })
      }
    }
  }

  // Z-Score 子图（独立窗格）：基于 close 的滚动标准分
  if (props.showZscore && closes.length) {
    const zp = Math.max(2, Math.min(1000, Math.floor(Number(props.zscorePeriod)) || 60))
    const zData = zscoreSeries(closes, times, zp)
    if (zData.length) {
      const zPaneIndex = nextIndicatorPaneIndex++
      const zSeries = chart.addSeries(
        LineSeries,
        {
          color: isDark ? '#f472b6' : '#db2777',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: `Z-Score(${zp})`,
          priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
        },
        zPaneIndex
      )
      zSeries.setData(zData)
      lineSeriesList.push(zSeries)
      zSeries.createPriceLine({
        price: 0,
        color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
        lineWidth: 1,
        lineStyle: 2,
      })
      zSeries.createPriceLine({
        price: 2,
        color: isDark ? 'rgba(248,113,113,0.9)' : 'rgba(220,38,38,0.9)',
        lineWidth: 1,
        lineStyle: 2,
      })
      zSeries.createPriceLine({
        price: -2,
        color: isDark ? 'rgba(34,197,94,0.9)' : 'rgba(22,163,74,0.9)',
        lineWidth: 1,
        lineStyle: 2,
      })

      if (props.showZscoreFastSlow) {
        const zFastP = Math.max(1, Math.min(300, Math.floor(Number(props.zscoreFastPeriod)) || 5))
        const zSlowP = Math.max(1, Math.min(500, Math.floor(Number(props.zscoreSlowPeriod)) || 15))
        const zFast = emaFromPoints(zData, zFastP)
        const zSlow = emaFromPoints(zData, zSlowP)
        if (zFast.length) {
          const fastLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#22d3ee' : '#0891b2',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `Z-F(${zFastP})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            zPaneIndex
          )
          fastLine.setData(zFast)
          lineSeriesList.push(fastLine)
        }
        if (zSlow.length) {
          const slowLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#f59e0b' : '#d97706',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `Z-S(${zSlowP})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            zPaneIndex
          )
          slowLine.setData(zSlow)
          lineSeriesList.push(slowLine)
        }
      }

      if (props.showKalmanFastSlow && props.kalmanSource === 'zscore') {
        const kFast = kalmanFromPoints(zData, props.kalmanFastQ, props.kalmanFastR)
        const kSlow = kalmanFromPoints(zData, props.kalmanSlowQ, props.kalmanSlowR)
        if (kFast.length) {
          const kfLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#38bdf8' : '#0284c7',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: 'K-F(Z)',
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            zPaneIndex
          )
          kfLine.setData(kFast)
          lineSeriesList.push(kfLine)
        }
        if (kSlow.length) {
          const ksLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#facc15' : '#ca8a04',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: 'K-S(Z)',
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            zPaneIndex
          )
          ksLine.setData(kSlow)
          lineSeriesList.push(ksLine)
        }
      }
    }
  }

  // ABO 子图（独立窗格）：基于计算源序列 vs 基准序列（通常 BTC）
  const aboSourceRows = Array.isArray(props.aboSourceBars) && props.aboSourceBars.length ? props.aboSourceBars : props.bars
  const aboSourceCandles = toCandles(aboSourceRows)
  if (
    (props.showAbo ||
      props.showAboZscore ||
      props.showAboAdi ||
      props.showAboAvi ||
      props.showAboAviPhaseOnMain ||
      props.showAboAviPdoHistogram) &&
    aboSourceCandles.length &&
    Array.isArray(props.aboBenchmarkBars) &&
    props.aboBenchmarkBars.length
  ) {
    const benchmarkCandles = toCandles(props.aboBenchmarkBars)
    const thr = Math.max(0, Number.isFinite(Number(props.aboThreshold)) ? Number(props.aboThreshold) : 0.5)
    const fastP = Math.max(1, Math.min(200, Math.floor(Number(props.aboFastPeriod)) || Math.floor(Number(props.aboEmaPeriod)) || 7))
    const slowP = Math.max(1, Math.min(300, Math.floor(Number(props.aboSlowPeriod)) || 21))
    const mode = props.aboDisplayMode === 'both' || props.aboDisplayMode === 'slow' ? props.aboDisplayMode : 'fast'
    const abo = aboSeriesDual(
      aboSourceCandles,
      benchmarkCandles,
      fastP,
      slowP,
      thr,
      isDark,
      props.aboSoftClamp,
      props.aboSoftClampDiv,
      props.aboSoftClampRange
      ,
      props.aboSoftClampScore,
      props.aboReversalBoost,
      props.aboReversalBoostFactor,
      props.aboVolumeWeighted,
      props.aboVolumePeriod,
      props.aboWinsorize,
      props.aboWinsorLimit,
      props.aboPreSmoothPeriod,
      props.aboBenchmarkNoiseFilter,
      props.aboBenchmarkMinMovePct
    )
    if (props.showAbo && (abo.fast.length || abo.slow.length || abo.fastHist.length || abo.slowHist.length)) {
      const aboPaneIndex = nextIndicatorPaneIndex++
      if (mode === 'both') {
        if (abo.fast.length) {
          const fastLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#22d3ee' : '#0891b2',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `ABO-F(${fastP})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            aboPaneIndex
          )
          fastLine.setData(abo.fast)
          lineSeriesList.push(fastLine)
          fastLine.createPriceLine({
            price: 0,
            color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
            lineWidth: 1,
            lineStyle: 2,
          })
          fastLine.createPriceLine({
            price: thr,
            color: isDark ? 'rgba(34,197,94,0.9)' : 'rgba(22,163,74,0.9)',
            lineWidth: 1,
            lineStyle: 2,
          })
          fastLine.createPriceLine({
            price: -thr,
            color: isDark ? 'rgba(248,113,113,0.9)' : 'rgba(220,38,38,0.9)',
            lineWidth: 1,
            lineStyle: 2,
          })
        }
        if (abo.slow.length) {
          const slowLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#fbbf24' : '#d97706',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `ABO-S(${slowP})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            aboPaneIndex
          )
          slowLine.setData(abo.slow)
          lineSeriesList.push(slowLine)
        }
      } else {
        const isSlow = mode === 'slow'
        const histData = isSlow ? abo.slowHist : abo.fastHist
        const period = isSlow ? slowP : fastP
        if (histData.length) {
          const aboHist = chart.addSeries(
            HistogramSeries,
            {
              title: `${isSlow ? 'ABO-S' : 'ABO-F'}(${period})`,
              priceLineVisible: false,
              lastValueVisible: true,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            aboPaneIndex
          )
          aboHist.setData(histData)
          lineSeriesList.push(aboHist)
          aboHist.createPriceLine({
            price: 0,
            color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
            lineWidth: 1,
            lineStyle: 2,
          })
          aboHist.createPriceLine({
            price: thr,
            color: isDark ? 'rgba(34,197,94,0.9)' : 'rgba(22,163,74,0.9)',
            lineWidth: 1,
            lineStyle: 2,
          })
          aboHist.createPriceLine({
            price: -thr,
            color: isDark ? 'rgba(248,113,113,0.9)' : 'rgba(220,38,38,0.9)',
            lineWidth: 1,
            lineStyle: 2,
          })
        }
      }

      if (props.showKalmanFastSlow && (props.kalmanSource === 'aboFast' || props.kalmanSource === 'aboSlow')) {
        const srcPoints = props.kalmanSource === 'aboSlow' ? abo.slow : abo.fast
        const kFast = kalmanFromPoints(srcPoints, props.kalmanFastQ, props.kalmanFastR)
        const kSlow = kalmanFromPoints(srcPoints, props.kalmanSlowQ, props.kalmanSlowR)
        const srcTag = props.kalmanSource === 'aboSlow' ? 'ABO-S' : 'ABO-F'
        if (kFast.length) {
          const kfLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#38bdf8' : '#0284c7',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `K-F(${srcTag})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            aboPaneIndex
          )
          kfLine.setData(kFast)
          lineSeriesList.push(kfLine)
        }
        if (kSlow.length) {
          const ksLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#facc15' : '#ca8a04',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `K-S(${srcTag})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            aboPaneIndex
          )
          ksLine.setData(kSlow)
          lineSeriesList.push(ksLine)
        }
      }
    }

    // ABO Z-Score 子图（独立窗格）：针对 ABO 快/慢线做 rolling z-score
    if (props.showAboZscore) {
      const zSrc = props.aboZscoreSource === 'slow' ? 'slow' : 'fast'
      const srcPoints = zSrc === 'slow' ? abo.slow : abo.fast
      const zp = Math.max(2, Math.min(2000, Math.floor(Number(props.aboZscorePeriod)) || 120))
      const zt = Math.max(0.1, Math.min(10, Number.isFinite(Number(props.aboZscoreThreshold)) ? Number(props.aboZscoreThreshold) : 2.0))
      const zData = zscoreFromPoints(srcPoints, zp)
      if (zData.length) {
        const zPaneIndex = nextIndicatorPaneIndex++
        const zSeries = chart.addSeries(
          LineSeries,
          {
            color: isDark ? '#a78bfa' : '#7c3aed',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: `ABO-${zSrc === 'slow' ? 'S' : 'F'} Z(${zp})`,
            priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
          },
          zPaneIndex
        )
        zSeries.setData(zData)
        lineSeriesList.push(zSeries)
        zSeries.createPriceLine({
          price: 0,
          color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
          lineWidth: 1,
          lineStyle: 2,
        })
        zSeries.createPriceLine({
          price: zt,
          color: isDark ? 'rgba(248,113,113,0.9)' : 'rgba(220,38,38,0.9)',
          lineWidth: 1,
          lineStyle: 2,
        })
        zSeries.createPriceLine({
          price: -zt,
          color: isDark ? 'rgba(34,197,94,0.9)' : 'rgba(22,163,74,0.9)',
          lineWidth: 1,
          lineStyle: 2,
        })

        if (props.showKalmanFastSlow && props.kalmanSource === 'aboZscore') {
          const kfQ = Math.max(1e-6, Number(props.kalmanFastQ) || 0.08)
          const kfR = Math.max(1e-6, Number(props.kalmanFastR) || 0.20)
          const ksQ = Math.max(1e-6, Number(props.kalmanSlowQ) || 0.01)
          const ksR = Math.max(1e-6, Number(props.kalmanSlowR) || 0.80)

          const kFast = kalmanFromPoints(zData, kfQ, kfR)
          const kSlow = kalmanFromPoints(zData, ksQ, ksR)

          if (kFast.length) {
            const kfLine = chart.addSeries(
              LineSeries,
              {
                color: isDark ? '#2dd4bf' : '#0891b2',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
                title: 'K-F',
                priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
              },
              zPaneIndex
            )
            kfLine.setData(kFast)
            lineSeriesList.push(kfLine)
          }
          if (kSlow.length) {
            const ksLine = chart.addSeries(
              LineSeries,
              {
                color: isDark ? '#fbbf24' : '#d97706',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
                title: 'K-S',
                priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
              },
              zPaneIndex
            )
            ksLine.setData(kSlow)
            lineSeriesList.push(ksLine)
          }
        }
      }
    }

    // ABO ADI 子图（独立窗格）：ABO 统治力指数
    if (props.showAboAdi) {
      const adiP = Math.max(2, Math.min(2000, Math.floor(Number(props.aboAdiPeriod)) || 60))
      const srcPoints = abo.fast // 默认基于快线
      const adiData = []
      const window = []
      let sum = 0
      for (const pt of srcPoints) {
        const sign = pt.value > 1e-9 ? 1 : (pt.value < -1e-9 ? -1 : 0)
        window.push(sign)
        sum += sign
        if (window.length > adiP) {
          sum -= window.shift()
        }
        const val = window.length > 0 ? (sum / window.length) * 100 : 0
        adiData.push({ time: pt.time, value: val })
      }

      if (adiData.length) {
        const adiPaneIndex = nextIndicatorPaneIndex++
        const adiSeries = chart.addSeries(
          LineSeries,
          {
            color: isDark ? '#38bdf8' : '#0ea5e9', // cyan
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: `ADI(${adiP})`,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          },
          adiPaneIndex
        )
        adiSeries.setData(adiData)
        lineSeriesList.push(adiSeries)

        // 0轴
        adiSeries.createPriceLine({
          price: 0,
          color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
          lineWidth: 1,
          lineStyle: 2,
        })
        // +80 极强
        adiSeries.createPriceLine({
          price: 80,
          color: isDark ? 'rgba(34,197,94,0.7)' : 'rgba(22,163,74,0.7)',
          lineWidth: 1,
          lineStyle: 2,
        })
        // -80 极弱
        adiSeries.createPriceLine({
          price: -80,
          color: isDark ? 'rgba(248,113,113,0.7)' : 'rgba(220,38,38,0.7)',
          lineWidth: 1,
          lineStyle: 2,
        })

        if (props.showKalmanFastSlow && props.kalmanSource === 'aboAdi') {
          const kfQ = Math.max(1e-6, Number(props.kalmanFastQ) || 0.08)
          const kfR = Math.max(1e-6, Number(props.kalmanFastR) || 0.20)
          const ksQ = Math.max(1e-6, Number(props.kalmanSlowQ) || 0.01)
          const ksR = Math.max(1e-6, Number(props.kalmanSlowR) || 0.80)

          const kFast = kalmanFromPoints(adiData, kfQ, kfR)
          const kSlow = kalmanFromPoints(adiData, ksQ, ksR)

          if (kFast.length) {
            const kfLine = chart.addSeries(
              LineSeries,
              {
                color: isDark ? '#2dd4bf' : '#0891b2',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
                title: 'K-F',
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
              },
              adiPaneIndex
            )
            kfLine.setData(kFast)
            lineSeriesList.push(kfLine)
          }
          if (kSlow.length) {
            const ksLine = chart.addSeries(
              LineSeries,
              {
                color: isDark ? '#fbbf24' : '#d97706',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
                title: 'K-S',
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
              },
              adiPaneIndex
            )
            ksLine.setData(kSlow)
            lineSeriesList.push(ksLine)
          }
        }
      }
    }

    if (
      (props.showAboAvi || props.showAboAviPhaseOnMain || props.showAboAviPdoHistogram) &&
      abo.cumAboSeries &&
      abo.priceSeries
    ) {
      const aviP = Math.max(2, Math.min(2000, Math.floor(Number(props.aboAviPeriod)) || 100))
      /** @type {{ time: import('lightweight-charts').Time, value: number }[]} */
      const aviRawData = []

      const priceQ = []
      let priceSum = 0
      let priceSumSq = 0
      
      const cumQ = []
      let cumSum = 0
      let cumSumSq = 0

      for (let i = 0; i < abo.cumAboSeries.length; i++) {
        const pt = abo.cumAboSeries[i]
        const pVal = abo.priceSeries[i].value
        const cVal = pt.value

        priceQ.push(pVal)
        priceSum += pVal
        priceSumSq += pVal * pVal

        cumQ.push(cVal)
        cumSum += cVal
        cumSumSq += cVal * cVal

        if (priceQ.length > aviP) {
          const oldP = priceQ.shift()
          priceSum -= oldP
          priceSumSq -= oldP * oldP
          
          const oldC = cumQ.shift()
          cumSum -= oldC
          cumSumSq -= oldC * oldC
        }

        let aviVal = 0
        if (priceQ.length >= aviP) {
          const n = priceQ.length
          const pMean = priceSum / n
          // 样本方差 (n-1)，与 BrickAviStrategy AboValuationEngine.calculateZScore 一致
          const pVar =
            n > 1 ? Math.max(0, (priceSumSq - (priceSum * priceSum) / n) / (n - 1)) : 0
          const pStd = Math.sqrt(pVar)
          const zPrice = pStd > 1e-9 ? (pVal - pMean) / pStd : 0

          const cMean = cumSum / n
          const cVar =
            n > 1 ? Math.max(0, (cumSumSq - (cumSum * cumSum) / n) / (n - 1)) : 0
          const cStd = Math.sqrt(cVar)
          const zCum = cStd > 1e-9 ? (cVal - cMean) / cStd : 0

          aviVal = zCum - zPrice
        }

        aviRawData.push({ time: pt.time, value: aviVal })
      }

      if (
        (props.showAboAviPhaseOnMain || props.showAboAviPdoHistogram) &&
        aviRawData.length
      ) {
        const aviVals = aviRawData.map((r) => r.value)
        const { sine, lead } = hilbertSineLeadFromInput(aviVals)
        const pdoVals = pdoSeriesValues(sine, lead)

        if (props.showAboAviPdoHistogram) {
          const up = isDark ? '#4ade80' : '#16a34a'
          const down = isDark ? '#f87171' : '#dc2626'
          const pdoData = aviRawData.map((r, i) => {
            const d = pdoVals[i]
            const color = Number.isFinite(d) && d >= 0 ? up : down
            return { time: r.time, value: d, color }
          })
          const pdoPaneIndex = nextIndicatorPaneIndex++
          const pdoSeries = chart.addSeries(
            HistogramSeries,
            {
              priceLineVisible: false,
              lastValueVisible: true,
              title: `PDO·AVI(${aviP})`,
              priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            },
            pdoPaneIndex
          )
          pdoSeries.setData(pdoData)
          pdoSeries.createPriceLine({
            price: 0,
            color: isDark ? 'rgba(69,71,90,0.85)' : 'rgba(203,213,225,0.95)',
            lineWidth: 1,
            lineStyle: 2,
          })
          lineSeriesList.push(pdoSeries)
        }

        if (props.showAboAviPhaseOnMain) {
          const hilbertScaleId = 'avi_hilbert_phase'
          const sinePts = aviRawData.map((r, i) => ({ time: r.time, value: sine[i] }))
          const leadPts = aviRawData.map((r, i) => ({ time: r.time, value: lead[i] }))
          const phaseFmt = { type: 'price', precision: 3, minMove: 0.001 }
          const sineLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#60a5fa' : '#2563eb',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `Sin(θ)·AVI(${aviP})`,
              priceFormat: phaseFmt,
              priceScaleId: hilbertScaleId,
            },
            0
          )
          sineLine.setData(sinePts)
          lineSeriesList.push(sineLine)
          const leadLine = chart.addSeries(
            LineSeries,
            {
              color: isDark ? '#facc15' : '#ca8a04',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: `Lead·AVI(${aviP})`,
              priceFormat: phaseFmt,
              priceScaleId: hilbertScaleId,
            },
            0
          )
          leadLine.setData(leadPts)
          lineSeriesList.push(leadLine)
          sineLine.createPriceLine({
            price: 1,
            color: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.55)',
            lineWidth: 1,
            lineStyle: 2,
          })
          sineLine.createPriceLine({
            price: -1,
            color: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.55)',
            lineWidth: 1,
            lineStyle: 2,
          })
        }
      }

      if (props.showAboAvi) {
      const aviKfQ = Math.max(1e-9, Number.isFinite(Number(props.aboAviKalmanQ)) ? Number(props.aboAviKalmanQ) : 0.08)
      const aviKfR = Math.max(1e-9, Number.isFinite(Number(props.aboAviKalmanR)) ? Number(props.aboAviKalmanR) : 0.2)
      const aviSmoothedPts = props.aboAviUseKalman
        ? kalmanFromPoints(aviRawData, aviKfQ, aviKfR)
        : aviRawData

      const aviData = aviSmoothedPts.map((row) => {
        const aviVal = row.value
        let color = isDark ? '#9ca3af' : '#6b7280'
        if (aviVal >= 2.0) color = isDark ? '#22c55e' : '#16a34a' // 极度低估 绿
        else if (aviVal <= -2.0) color = isDark ? '#f87171' : '#dc2626' // 极度高估 红
        else if (aviVal > 0) color = isDark ? 'rgba(34,197,94,0.4)' : 'rgba(22,163,74,0.4)'
        else color = isDark ? 'rgba(248,113,113,0.4)' : 'rgba(220,38,38,0.4)'
        return { time: row.time, value: aviVal, color }
      })

      if (aviData.length) {
        const aviPaneIndex = nextIndicatorPaneIndex++
        const aviSeries = chart.addSeries(
          HistogramSeries,
          {
            color: isDark ? '#38bdf8' : '#0ea5e9',
            priceLineVisible: false,
            lastValueVisible: true,
            title: props.aboAviUseKalman ? `AVI(${aviP})·KF` : `AVI(${aviP})`,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          },
          aviPaneIndex
        )
        aviSeries.setData(aviData)
        
        // 0轴
        aviSeries.createPriceLine({
          price: 0,
          color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)',
          lineWidth: 1,
          lineStyle: 2,
        })
        // +2.0
        aviSeries.createPriceLine({
          price: 2.0,
          color: isDark ? 'rgba(34,197,94,0.7)' : 'rgba(22,163,74,0.7)',
          lineWidth: 1,
          lineStyle: 2,
        })
        // -2.0
        aviSeries.createPriceLine({
          price: -2.0,
          color: isDark ? 'rgba(248,113,113,0.7)' : 'rgba(220,38,38,0.7)',
          lineWidth: 1,
          lineStyle: 2,
        })

        if (props.showKalmanFastSlow && props.kalmanSource === 'aboAvi') {
          const kfQ = Math.max(1e-6, Number(props.kalmanFastQ) || 0.08)
          const kfR = Math.max(1e-6, Number(props.kalmanFastR) || 0.20)
          const ksQ = Math.max(1e-6, Number(props.kalmanSlowQ) || 0.01)
          const ksR = Math.max(1e-6, Number(props.kalmanSlowR) || 0.80)

          // 叠加线基于原始 AVI，避免与柱体已做 KF 时双重平滑
          const kFast = kalmanFromPoints(aviRawData, kfQ, kfR)
          const kSlow = kalmanFromPoints(aviRawData, ksQ, ksR)

          if (kFast.length) {
            const kfLine = chart.addSeries(
              LineSeries,
              {
                color: isDark ? '#2dd4bf' : '#0891b2',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
                title: 'K-F',
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
              },
              aviPaneIndex
            )
            kfLine.setData(kFast)
            lineSeriesList.push(kfLine)
          }
          if (kSlow.length) {
            const ksLine = chart.addSeries(
              LineSeries,
              {
                color: isDark ? '#fbbf24' : '#d97706',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
                title: 'K-S',
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
              },
              aviPaneIndex
            )
            ksLine.setData(kSlow)
            lineSeriesList.push(ksLine)
          }
        }
      }
      }
    }
  }

  if (
    props.showSyntheticSpreadEuler &&
    Array.isArray(props.syntheticSpreadEulerPts) &&
    props.syntheticSpreadEulerPts.length >= 2 &&
    candles.length
  ) {
    const barSec = new Set(candles.map((c) => Number(c.time)))
    const sep = props.syntheticSpreadEulerPts.filter(
      (p) => p && p.time != null && barSec.has(Number(p.time)) && Number.isFinite(Number(p.pdo))
    )
    if (sep.length >= 2) {
      const spreadEulerPane = nextIndicatorPaneIndex++
      const scaleId = 'synthetic_spread_euler'
      const phaseFmt = { type: 'price', precision: 3, minMove: 0.001 }
      const up = isDark ? '#4ade80' : '#16a34a'
      const down = isDark ? '#f87171' : '#dc2626'
      const pdoData = sep.map((e) => {
        const d = Number(e.pdo)
        const color = Number.isFinite(d) && d >= 0 ? up : down
        return { time: e.time, value: d, color }
      })
      const pdoHist = chart.addSeries(
        HistogramSeries,
        {
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'PDO·价差欧拉',
          priceFormat: phaseFmt,
        },
        spreadEulerPane
      )
      pdoHist.setData(pdoData)
      pdoHist.createPriceLine({
        price: 0,
        color: isDark ? 'rgba(69,71,90,0.85)' : 'rgba(203,213,225,0.95)',
        lineWidth: 1,
        lineStyle: 2,
      })
      lineSeriesList.push(pdoHist)

      const sinPts = sep.map((e) => ({ time: e.time, value: Number.isFinite(e.sinTheta) ? e.sinTheta : 0 }))
      const cosPts = sep.map((e) => ({ time: e.time, value: Number.isFinite(e.cosTheta) ? e.cosTheta : 0 }))
      const sineLine = chart.addSeries(
        LineSeries,
        {
          color: isDark ? '#60a5fa' : '#2563eb',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'sinθ·价差',
          priceFormat: phaseFmt,
          priceScaleId: scaleId,
        },
        spreadEulerPane
      )
      sineLine.setData(sinPts)
      lineSeriesList.push(sineLine)
      const leadLine = chart.addSeries(
        LineSeries,
        {
          color: isDark ? '#facc15' : '#ca8a04',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'cosθ·价差',
          priceFormat: phaseFmt,
          priceScaleId: scaleId,
        },
        spreadEulerPane
      )
      leadLine.setData(cosPts)
      leadLine.createPriceLine({
        price: 0.5,
        color: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.55)',
        lineWidth: 1,
        lineStyle: 2,
      })
      sineLine.createPriceLine({
        price: -0.5,
        color: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.55)',
        lineWidth: 1,
        lineStyle: 2,
      })
      lineSeriesList.push(leadLine)
    }
  }

  const indicatorPaneCount = Math.max(0, nextIndicatorPaneIndex - 1)
  if (indicatorPaneCount > 0) {
    const panes = chart.panes()
    const paneH =
      indicatorPaneCount === 1
        ? Math.min(150, Math.max(72, Math.floor(props.height * 0.28)))
        : Math.min(120, Math.max(64, Math.floor(props.height * 0.22)))
    for (let i = 1; i <= indicatorPaneCount; i++) {
      if (panes[i]) panes[i].setHeight(paneH)
    }
  }

  if (candles.length) {
    chart.timeScale().fitContent()
  }

  const tipW = 190
  const tipH = 128
  const priceText = (x) => {
    const n = Number(x)
    if (!Number.isFinite(n)) return '—'
    const p = Number.isFinite(Number(props.priceDecimals))
      ? Math.max(0, Math.min(8, Math.floor(Number(props.priceDecimals))))
      : 4
    return n.toFixed(p)
  }
  crosshairHandler = (param) => {
    if (!chart || !wrapRef.value || !param || !param.time || !param.point) {
      hoverMetrics.value.visible = false
      return
    }
    const sec = toEpochSeconds(param.time)
    const c = candleByTime.get(sec)
    if (!c || !Number.isFinite(c.open) || !Number.isFinite(c.high) || !Number.isFinite(c.low) || !Number.isFinite(c.close)) {
      hoverMetrics.value.visible = false
      return
    }
    const clampExpArg = (x) => Math.min(Math.max(x, -80), 80)
    let ampPct
    let chgPct
    if (props.crosshairPctBasis === 'logSpread') {
      const dCo = c.close - c.open
      chgPct = (Math.exp(clampExpArg(dCo)) - 1) * 100
      const rH = Math.exp(clampExpArg(c.high - c.open))
      const rL = Math.exp(clampExpArg(c.low - c.open))
      const rC = Math.exp(clampExpArg(c.close - c.open))
      const mx = Math.max(1, rH, rL, rC)
      const mn = Math.min(1, rH, rL, rC)
      ampPct = (mx - mn) * 100
    } else {
      if (c.open <= 0) {
        hoverMetrics.value.visible = false
        return
      }
      ampPct = ((c.high - c.low) / c.open) * 100
      chgPct = ((c.close - c.open) / c.open) * 100
    }
    const sign = chgPct > 0 ? '+' : ''
    const w = Math.max(320, wrapRef.value.clientWidth || 320)
    const x = Math.max(0, Math.min(param.point.x + 12, w - tipW))
    const y = Math.max(0, Math.min(param.point.y + 12, props.height - tipH))
    hoverMetrics.value = {
      visible: true,
      left: x,
      top: y,
      openText: priceText(c.open),
      highText: priceText(c.high),
      lowText: priceText(c.low),
      closeText: priceText(c.close),
      amplitudeText: `${ampPct.toFixed(2)}%`,
      changeText: `${sign}${chgPct.toFixed(2)}%`,
      changePct: chgPct,
    }
  }
  chart.subscribeCrosshairMove(crosshairHandler)
}

function teardownChart() {
  lineSeriesList = []
  candleSeries = null
  mainLineSeries = null
  hoverMetrics.value.visible = false
  if (chart && crosshairHandler) {
    chart.unsubscribeCrosshairMove(crosshairHandler)
  }
  crosshairHandler = null
  if (chart) {
    chart.remove()
    chart = null
  }
}

watch(
  () => [
    props.bars,
    props.maLines,
    props.maPeriods,
    props.maType,
    props.maAccelerationFactor,
    props.showBollinger,
    props.bollingerPeriod,
    props.bollingerMult,
    props.priceDecimals,
    props.mainSeriesType,
    props.showRsi,
    props.rsiPeriod,
    props.rsiSmoothing,
    props.rsiStreakPenalty,
    props.rsiDampeningFactor,
    props.rsiReversalFactor,
    props.rsiRetentionRate,
    props.showMacd,
    props.macdFastPeriod,
    props.macdSlowPeriod,
    props.macdSignalPeriod,
    props.macdBoostFactor,
    props.macdReversalFactor,
    props.showAtr,
    props.atrPeriod,
    props.atrNormalize,
    props.atrNormPeriod,
    props.showZscore,
    props.zscorePeriod,
    props.showZscoreFastSlow,
    props.zscoreFastPeriod,
    props.zscoreSlowPeriod,
    props.showKalmanFastSlow,
    props.kalmanFastQ,
    props.kalmanFastR,
    props.kalmanSlowQ,
    props.kalmanSlowR,
    props.kalmanSource,
    props.showAbo,
    props.aboEmaPeriod,
    props.aboFastPeriod,
    props.aboSlowPeriod,
    props.aboDisplayMode,
    props.aboThreshold,
    props.aboSoftClamp,
    props.aboSoftClampDiv,
    props.aboSoftClampRange,
    props.aboSoftClampScore,
    props.aboReversalBoost,
    props.aboReversalBoostFactor,
    props.aboVolumeWeighted,
    props.aboVolumePeriod,
    props.aboWinsorize,
    props.aboWinsorLimit,
    props.aboPreSmoothPeriod,
    props.aboBenchmarkNoiseFilter,
    props.aboBenchmarkMinMovePct,
    props.showAboZscore,
    props.aboZscorePeriod,
    props.aboZscoreSource,
    props.aboZscoreThreshold,
    props.showAboAdi,
    props.aboAdiPeriod,
    props.showAboAvi,
    props.showAboAviPhaseOnMain,
    props.showAboAviPdoHistogram,
    props.aboAviPeriod,
    props.aboAviUseKalman,
    props.aboAviKalmanQ,
    props.aboAviKalmanR,
    props.aboBenchmarkBars,
    props.aboSourceBars,
    props.showSyntheticSpreadEuler,
    props.syntheticSpreadEulerPts,
    props.syntheticEulerChameleonMinA,
    props.syntheticEulerZVolatilityFloorRatio,
    props.syntheticEulerZSigmaFloorAbs,
    props.showSuperTrend,
    props.superTrendAtrPeriod,
    props.superTrendMultiplier,
    props.timeZone,
  ],
  () => {
    nextTick(() => mountChart())
  },
  { deep: true }
)

watch(
  () => props.height,
  () => {
    if (chart && wrapRef.value) {
      chart.applyOptions({ height: props.height, width: wrapRef.value.clientWidth })
      const panes = chart.panes()
      const indicatorPaneCount = Math.max(0, panes.length - 1)
      if (indicatorPaneCount > 0) {
        const paneH =
          indicatorPaneCount === 1
            ? Math.min(150, Math.max(72, Math.floor(props.height * 0.28)))
            : Math.min(120, Math.max(64, Math.floor(props.height * 0.22)))
        for (let i = 1; i <= indicatorPaneCount; i++) {
          if (panes[i]) panes[i].setHeight(paneH)
        }
      }
    }
  }
)

onMounted(() => {
  nextTick(() => {
    mountChart()
    ro = new ResizeObserver(() => {
      if (chart && wrapRef.value) {
        chart.applyOptions({ width: Math.max(wrapRef.value.clientWidth, 320) })
      }
    })
    if (wrapRef.value) ro.observe(wrapRef.value)
  })
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  teardownChart()
})
</script>
