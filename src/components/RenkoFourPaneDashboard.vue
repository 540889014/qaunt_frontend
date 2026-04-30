<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ dashboardHeading }}</h3>
      <div class="text-xs text-gray-500 dark:text-gray-400 max-w-3xl space-y-1">
        <p>
          自上而下：<strong>主图砖按欧拉象限染色</strong>（1 绿健康、4 黄吸收、3 深红杀跌、2 紫诱多；<strong>A</strong> 低于 profile 静默阈时整砖中性灰；近轴仍默认涨跌色；欧拉 Z 可带 σ 方差地板）+ 1.5×ATR 动态支撑 → 订单流（<strong>右轴</strong>：CVD 动能柱 CVD−EMA，可选单通道 KF 后缩放到 ±3；<strong>左轴</strong>：开启 KF 时快慢卡尔曼双线 K-F/K-S；砖上 V 为 USDT 额时 Δ=2×takerQuote−V；累积 CVD 参与「释放」标记）→ 估值（AVI）→ <strong>独立窗：欧拉角 θ（°）</strong>，atan2(Q,I)，Y 轴固定约 ±180° → <strong>cosθ=I/A</strong>、<strong>sinθ=Q/A</strong>、<strong>PDO</strong>=sin(θ+45°)−sin(θ) → <strong>欧拉·A 共振能量柱</strong>（|A| 为柱高，象限定色；Q4 半透明黄；柱高<strong>分位软钳制</strong> + 对称固定 Y 轴，极端 Z 不压扁全程，I/Q/A 定义不变）→ 可选最底<strong>螺旋副图 σ/ω</strong>（<strong>σ</strong>=d ln(A)/dt 能量衰扩率，三色柱：<span class="text-emerald-500">绿=发散螺旋</span>/<span class="text-red-500">红=收敛螺旋</span>/<span class="text-yellow-500">黄=极限环</span>；<strong>ω</strong>=dθ/dt 角速度叠加折线）。
          <strong>欧拉共振（Beta 时钟相空间）</strong>：<strong>I</strong> = Z(EMA(累积CVD)) 为资金推力（Effort），<strong>Q</strong> = Z(主砖收益) − Z(基准砖收益) 为超额结果（Result）；<strong>A</strong> = √(I²+Q²)，<strong>θ</strong> = atan2(Q,I)。主图「欧拉」标：PDO 上穿零且 A 过共识阈（默认 2）时触发。
          时间轴与 ABO 同源：主合约按<strong>基准砖时钟</strong>对齐（Forward-fill 时 ABO/AVI 与欧拉 I/Q 共用该轴）。<strong>(I,Q) 复平面</strong>叠在主图窗格内右上角：逐砖轨迹、橙虚线杂讯界，悬停/点击与时间轴联动。
        </p>
        <p>
          结构窗 ATR 为 EMA 平滑（α=2/(N+1)），较 Wilder RMA（α=1/N）更敏捷；与 TradingView 默认 ATR 可能有细微差异。
        </p>
        <p>
          主图「释放」：近 L 根砖 CVD 净变化 D = CVD − CVD(−L)，价格效率 E = ΔP / D（ΔP 为同窗收盘差）；要求 |D|、E 过阈且 sign(D)=sign(ΔP)。动量/效率下限填 0 时按当前样本分位自适应门槛。
        </p>
      </div>
    </div>
    <div
      ref="chartHostRef"
      class="relative w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
      :style="{ width: '100%', height: totalHeight + 'px', minHeight: totalHeight + 'px' }"
    >
      <div ref="chartMountRef" class="absolute inset-0" />
      <div
        v-if="hoverBrickMetrics.visible"
        class="pointer-events-none absolute z-30 rounded-md border border-gray-300/80 dark:border-gray-600/90 bg-white/95 dark:bg-gray-900/95 px-2 py-1.5 text-xs shadow"
        :style="{ left: hoverBrickMetrics.left + 'px', top: hoverBrickMetrics.top + 'px' }"
      >
        <div class="text-gray-700 dark:text-gray-200">开: <span class="font-semibold">{{ hoverBrickMetrics.openText }}</span></div>
        <div class="text-gray-700 dark:text-gray-200">高: <span class="font-semibold">{{ hoverBrickMetrics.highText }}</span></div>
        <div class="text-gray-700 dark:text-gray-200">低: <span class="font-semibold">{{ hoverBrickMetrics.lowText }}</span></div>
        <div class="text-gray-700 dark:text-gray-200">收: <span class="font-semibold">{{ hoverBrickMetrics.closeText }}</span></div>
        <div class="text-gray-700 dark:text-gray-200">振幅: <span class="font-semibold">{{ hoverBrickMetrics.amplitudeText }}</span></div>
        <div :class="hoverBrickMetrics.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
          涨跌: <span class="font-semibold">{{ hoverBrickMetrics.changeText }}</span>
        </div>
      </div>
      <div
        v-if="eulerPlaneSeries.length"
        class="pointer-events-none absolute right-2 top-2 z-20 w-[min(100%,400px)] max-h-[min(42vh,40%)] min-w-0 flex flex-col items-end"
      >
        <EulerIQPlane
          embedded
          class="pointer-events-auto max-h-full min-h-0 overflow-y-auto rounded-md bg-white/93 shadow-xl ring-1 ring-gray-300/90 backdrop-blur-sm dark:bg-gray-950/93 dark:ring-gray-600/90"
          :points="eulerPlaneSeries"
          :noise-radius="eulerNoiseRadiusEffective"
          :is-dark="planeIsDark"
          :svg-height="embeddedEulerSvgHeight"
          @brick-pick="onEulerBrickPick"
        />
      </div>
    </div>
    <p v-if="hint" class="text-xs text-amber-700 dark:text-amber-300">{{ hint }}</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import EulerIQPlane from '@/components/EulerIQPlane.vue'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts'
import {
  toCandles,
  atrEmaSeries,
  aboSeriesDual,
  cvdUsdtQuoteMismatchReason,
  cvdMomentumSeriesFromCumulative,
  buildReleaseMarkers,
  eulerResonanceFromBricks,
  eulerEnrichWithDeltaTheta,
  eulerSpiralEnrich,
  sigmaSmoothModeLabel,
  spiralPhaseColor,
  buildEulerChameleonCandles,
  buildEulerEnergyHistogramPoints,
  kalmanFromPoints,
  classicMacdSeriesFromCandles,
  bollingerBandsFromCandles,
} from '@/utils/chartIndicatorCore'

const props = defineProps({
  /**
   * 主图 K 线对应的 jbar 行：通常为主合约按基准砖钟对齐；也可传基准腿本身，此时 `benchmarkBars` 宜为另一腿对齐行。
   */
  rows: { type: Array, default: () => [] },
  /** 与 `rows` 配对的另一腿 OHLC（ABO/欧拉相对收益与 CVD 对照） */
  benchmarkBars: { type: Array, default: () => [] },
  /** 卡片标题，如「主合约 · 四维专业仪表盘」 */
  dashboardHeading: { type: String, default: '四维专业仪表盘' },
  /** 与 BtcPointBrickKlineFreeBenchmark.indicatorForm 同结构 */
  profile: { type: Object, default: () => ({}) },
  height: { type: Number, default: 920 },
  priceDecimals: { type: Number, default: 4 },
  /** ATR 周期（海龟 EMA 版） */
  atrPeriod: { type: Number, default: 14 },
  /** 动态支撑：收盘 − mult×ATR */
  atrStopMult: { type: Number, default: 1.5 },
  /** AVI 滚动窗口 */
  aviPeriod: { type: Number, default: 100 },
  /** 「释放」：回看砖数 L（D = CVD[i]−CVD[i−L]） */
  releaseLookback: { type: Number, default: 3 },
  /** |D| 下限；≤0 时用样本自适应分位 */
  releaseCvdMomentumMin: { type: Number, default: 0 },
  /** E = ΔP/D 下限；≤0 时用样本自适应分位 */
  releaseEfficiencyMin: { type: Number, default: 0 },
  /** CVD 动能 EMA(CVD) 周期 P（砖数），动能 = CVD − EMA；亦用于欧拉 I 轨上 EMA(累积CVD) */
  cvdMomentumEmaPeriod: { type: Number, default: 5 },
  /** 欧拉模长 A 的共识门槛：主图「欧拉」标要求 A ≥ 该值且 PDO 上穿零 */
  eulerConsensusA: { type: Number, default: 2 },
  /** 复平面杂讯圆半径 R（|A|&lt;R 视为原点邻域杂讯）；可被 profile.eulerNoiseRadius 覆盖 */
  eulerNoiseRadius: { type: Number, default: 1.5 },
  /** CVD 动能柱：是否先做一维卡尔曼再缩放到 ±3（profile 可覆盖） */
  cvdMomentumUseKalman: { type: Boolean, default: true },
  cvdMomentumKalmanQ: { type: Number, default: 0.08 },
  cvdMomentumKalmanR: { type: Number, default: 0.2 },
  /** CVD 窗卡尔曼双线：快线 Q/R（profile.kalmanFastQ/R 优先） */
  cvdKalmanFastQ: { type: Number, default: 0.08 },
  cvdKalmanFastR: { type: Number, default: 0.2 },
  cvdKalmanSlowQ: { type: Number, default: 0.01 },
  cvdKalmanSlowR: { type: Number, default: 0.8 },
  /**
   * 与 `rows` 砖数一致时替换内置 `eulerResonanceFromBricks`（如单边 OI 加权欧拉）。
   * 每项须含 time、I、Q、A、theta、sinTheta、cosTheta、pdo（与 chartIndicatorCore 欧拉输出同构）。
   */
  customEulerPoints: { type: Array, default: null },
  /**
   * 与主图砖数一致时，变色龙按每砖「展示象限」上色（如施密特输出），见 {@link buildEulerChameleonCandles} 的 `paintQuadrants`。
   */
  customEulerChameleonPaintQuadrants: { type: Array, default: null },
})

const chartHostRef = ref(null)
const chartMountRef = ref(null)
const hint = ref('')
/** 供 (I,Q) 复平面：与 {@link eulerEnrichWithDeltaTheta} 同构 */
const eulerPlaneSeries = ref([])
const planeIsDark = ref(false)
/** 供复平面点击后滚动主图时间轴 */
const chartRef = ref(null)
/** 十字线悬停：主图砖 OHLC、振幅%、涨跌% */
const hoverBrickMetrics = ref({
  visible: false,
  left: 0,
  top: 0,
  openText: '',
  highText: '',
  lowText: '',
  closeText: '',
  amplitudeText: '',
  changeText: '',
  changePct: 0,
})
let chart = null
/** @type {import('lightweight-charts').ISeriesApi<any>[]} */
const seriesList = []

const totalHeight = computed(() => Math.max(640, Math.min(1400, Number(props.height) || 920)))

/** 叠在主图上的复平面 SVG 高度（随总图高度略变） */
const embeddedEulerSvgHeight = computed(() =>
  Math.round(Math.min(200, Math.max(130, totalHeight.value * 0.19)))
)

const eulerNoiseRadiusEffective = computed(() => {
  const fromProf = Number(props.profile?.eulerNoiseRadius)
  const base = Number(props.eulerNoiseRadius)
  const v = Number.isFinite(fromProf) && fromProf > 0 ? fromProf : base
  return Math.max(0.5, Math.min(12, Number.isFinite(v) ? v : 1.5))
})

function toEpochSeconds(time) {
  if (typeof time === 'number') return time
  if (time && typeof time === 'object' && Number.isFinite(time.year)) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000)
  }
  return NaN
}

function formatChartTime(time) {
  const sec = toEpochSeconds(time)
  if (!Number.isFinite(sec)) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(sec * 1000))
}

/** 去非有限值、按 time 排序、同秒去重（后者避免 setData 抛错导致副图未挂载） */
function sanitizeTimePoints(points, getValue) {
  const bySec = new Map()
  for (const p of points) {
    if (!p || p.time == null) continue
    const sec = toEpochSeconds(p.time)
    const v = getValue(p)
    if (!Number.isFinite(sec) || !Number.isFinite(v)) continue
    bySec.set(sec, p)
  }
  return Array.from(bySec.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => p)
}

function applyPaneHeights(H) {
  if (!chart) return
  const panes = chart.panes()
  const n = panes.length
  if (n < 4) return
  const hasMacd = !!chart._hasMacdPane
  const hasTheta = !!chart._hasThetaPane

  /** 主 + MACD + CVD + AVI + θ(°) + Hilbert + 欧拉能量 */
  if (hasMacd && hasTheta && n >= 7) {
    const hEuler = Math.max(52, Math.round(H * 0.085))
    const hMacd = Math.max(48, Math.round(H * 0.09))
    const hTheta = Math.max(44, Math.round(H * 0.065))
    const h0 = Math.round(H * 0.21)
    const rem = H - h0 - hMacd - hEuler - hTheta
    const hMid = Math.max(48, Math.floor(rem / 3))
    if (panes[0]) panes[0].setHeight(h0)
    if (panes[1]) panes[1].setHeight(hMacd)
    if (panes[2]) panes[2].setHeight(hMid)
    if (panes[3]) panes[3].setHeight(hMid)
    if (panes[4]) panes[4].setHeight(hTheta)
    if (panes[5]) panes[5].setHeight(hMid)
    if (panes[6]) {
      const used = h0 + hMacd + hEuler + hTheta + hMid * 3
      panes[6].setHeight(Math.max(52, H - used))
    }
    return
  }

  /** 主 + CVD + AVI + θ(°) + Hilbert + 欧拉能量 */
  if (!hasMacd && hasTheta && n >= 6) {
    const hEuler = Math.max(52, Math.round(H * 0.09))
    const hTheta = Math.max(44, Math.round(H * 0.07))
    const h0 = Math.round(H * 0.25)
    const rem = H - h0 - hEuler - hTheta
    const hMid = Math.max(50, Math.floor(rem / 3))
    if (panes[0]) panes[0].setHeight(h0)
    if (panes[1]) panes[1].setHeight(hMid)
    if (panes[2]) panes[2].setHeight(hMid)
    if (panes[3]) panes[3].setHeight(hTheta)
    if (panes[4]) panes[4].setHeight(hMid)
    if (panes[5]) {
      const used = h0 + hEuler + hTheta + hMid * 3
      panes[5].setHeight(Math.max(52, H - used))
    }
    return
  }

  /** 主 + MACD + CVD + AVI + Hilbert + 欧拉能量（无独立 θ 窗） */
  if (hasMacd && !hasTheta && n >= 6) {
    const hEuler = Math.max(56, Math.round(H * 0.09))
    const hMacd = Math.max(52, Math.round(H * 0.1))
    const h0 = Math.round(H * 0.26)
    const rem = H - h0 - hMacd - hEuler
    const hMid = Math.max(52, Math.floor(rem / 3))
    if (panes[0]) panes[0].setHeight(h0)
    if (panes[1]) panes[1].setHeight(hMacd)
    if (panes[2]) panes[2].setHeight(hMid)
    if (panes[3]) panes[3].setHeight(hMid)
    if (panes[4]) panes[4].setHeight(hMid)
    if (panes[5]) {
      const used = h0 + hMacd + 3 * hMid
      panes[5].setHeight(Math.max(56, H - used))
    }
    return
  }

  const hasEnergy = n >= 5
  const hEnergy = hasEnergy ? Math.max(56, Math.round(H * 0.09)) : 0
  const h0 = Math.round(H * (hasEnergy ? 0.34 : 0.4))
  const rem = H - h0 - hEnergy
  const hMid = Math.max(60, Math.floor(rem / 3))
  if (panes[0]) panes[0].setHeight(h0)
  for (let i = 1; i <= 3; i++) {
    if (panes[i]) panes[i].setHeight(hMid)
  }
  if (hasEnergy && panes[4]) {
    const used = h0 + hMid * 3
    panes[4].setHeight(Math.max(56, H - used))
  }
}

/**
 * 多 pane：addSeries 到 paneIndex>0 时库只走 lightUpdate，不会 _syncGuiWithModel，
 * 子窗格 DOM/canvas 不会被创建；必须触发一次尺寸变化以走 resize → fullUpdate。
 */
function forceChartLayoutRefresh(w, h) {
  if (!chart) return
  const rw = Math.max(1, Math.floor(w))
  const rh = Math.max(1, Math.floor(h))
  chart.resize(rw + 2, rh)
  chart.resize(rw, rh)
}

/** createSeriesMarkers 内部对逻辑序号二分可见区，须按时间升序，否则缩放后标记整段丢失 */
function sortMarkersForLightweightCharts(markers) {
  const order = {
    欧拉: 0,
    吸收: 1,
    释放: 2,
    P0: 3,
    P1: 4,
    P2: 5,
    P3: 6,
    P4: 7,
    '✓': 12,
    '×': 13,
  }
  markers.sort((a, b) => {
    const ta = toEpochSeconds(a.time)
    const tb = toEpochSeconds(b.time)
    if (ta !== tb) return ta - tb
    const oa = order[a.text] ?? 9
    const ob = order[b.text] ?? 9
    if (oa !== ob) return oa - ob
    return String(a.text || '').localeCompare(String(b.text || ''))
  })
}

function priceFormatFromDecimals(decimals) {
  const n = Number(decimals)
  if (!Number.isFinite(n) || n < 0 || n > 8) return undefined
  const p = Math.floor(n)
  const minMove = p === 0 ? 1 : 10 ** -p
  return { type: 'price', precision: p, minMove }
}

function takerBuyBaseFromRow(b) {
  const v = b?.takerBuyBaseVolume ?? b?.taker_buy_base_volume
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function takerBuyQuoteFromRow(b) {
  const v = b?.takerBuyQuoteVolume ?? b?.taker_buy_quote_volume
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function buildAboParams(isDark) {
  const p = props.profile || {}
  return {
    fastP: Math.max(1, Math.min(200, Math.floor(Number(p.aboFastPeriod)) || 14)),
    slowP: Math.max(1, Math.min(300, Math.floor(Number(p.aboSlowPeriod)) || 34)),
    thr: Math.max(0, Number.isFinite(Number(p.aboThreshold)) ? Number(p.aboThreshold) : 0.5),
    softClamp: !!p.aboSoftClamp,
    softClampDiv: Number.isFinite(Number(p.aboSoftClampDiv)) ? Number(p.aboSoftClampDiv) : 2,
    softClampRange: Number.isFinite(Number(p.aboSoftClampRange)) ? Number(p.aboSoftClampRange) : 3,
    softClampScore: !!p.aboSoftClampScore,
    reversalBoost: !!p.aboReversalBoost,
    reversalBoostFactor: Number.isFinite(Number(p.aboReversalBoostFactor)) ? Number(p.aboReversalBoostFactor) : 0.45,
    volumeWeighted: p.aboVolumeWeighted !== false,
    volumePeriod: Math.max(2, Math.min(500, Math.floor(Number(p.aboVolumePeriod)) || 20)),
    winsorize: p.aboWinsorize !== false,
    winsorLimit: Number.isFinite(Number(p.aboWinsorLimit)) ? Number(p.aboWinsorLimit) : 5,
    preSmoothPeriod: Math.max(1, Math.min(100, Math.floor(Number(p.aboPreSmoothPeriod)) || 3)),
    benchmarkNoiseFilter: p.aboBenchmarkNoiseFilter !== false,
    benchmarkMinMovePct: Number.isFinite(Number(p.aboBenchmarkMinMovePct)) ? Number(p.aboBenchmarkMinMovePct) : 0.1,
    isDark,
  }
}

function computeAviRaw(cumAboSeries, priceSeries, aviP) {
  const P = Math.max(2, Math.min(2000, Math.floor(Number(aviP)) || 100))
  const aviRawData = []
  const priceQ = []
  let priceSum = 0
  let priceSumSq = 0
  const cumQ = []
  let cumSum = 0
  let cumSumSq = 0
  for (let i = 0; i < cumAboSeries.length; i++) {
    const pt = cumAboSeries[i]
    const pVal = priceSeries[i].value
    const cVal = pt.value
    priceQ.push(pVal)
    priceSum += pVal
    priceSumSq += pVal * pVal
    cumQ.push(cVal)
    cumSum += cVal
    cumSumSq += cVal * cVal
    if (priceQ.length > P) {
      const oldP = priceQ.shift()
      priceSum -= oldP
      priceSumSq -= oldP * oldP
      const oldC = cumQ.shift()
      cumSum -= oldC
      cumSumSq -= oldC * oldC
    }
    let aviVal = 0
    if (priceQ.length >= P) {
      const n = priceQ.length
      const pMean = priceSum / n
      const pVar = n > 1 ? Math.max(0, (priceSumSq - (priceSum * priceSum) / n) / (n - 1)) : 0
      const pStd = Math.sqrt(pVar)
      const zPrice = pStd > 1e-9 ? (pVal - pMean) / pStd : 0
      const cMean = cumSum / n
      const cVar = n > 1 ? Math.max(0, (cumSumSq - (cumSum * cumSum) / n) / (n - 1)) : 0
      const cStd = Math.sqrt(cVar)
      const zCum = cStd > 1e-9 ? (cVal - cMean) / cStd : 0
      aviVal = zCum - zPrice
    }
    aviRawData.push({ time: pt.time, value: aviVal })
  }
  return aviRawData
}

function teardown() {
  hoverBrickMetrics.value = {
    visible: false,
    left: 0,
    top: 0,
    openText: '',
    highText: '',
    lowText: '',
    closeText: '',
    amplitudeText: '',
    changeText: '',
    changePct: 0,
  }
  seriesList.length = 0
  chartRef.value = null
  if (chart) {
    if (chart._crosshairHandler) {
      try {
        chart.unsubscribeCrosshairMove(chart._crosshairHandler)
      } catch {
        /* ignore */
      }
      delete chart._crosshairHandler
    }
    chart.remove()
    chart = null
  }
}

/**
 * 复平面点击：把主图时间轴滚到该砖附近（Unix 秒），便于与 K 线对齐查看。
 * @param {{ time: number }} ev
 */
function onEulerBrickPick(ev) {
  const c = chartRef.value
  const t = Number(ev?.time)
  if (!c || !Number.isFinite(t)) return
  const span = 96 * 3600
  const from = t - span / 2
  const to = t + span / 2
  try {
    c.timeScale().setVisibleRange({ from, to })
  } catch {
    /* 部分 Time 类型边界下可能抛错，忽略 */
  }
}

function mountChart() {
  teardown()
  eulerPlaneSeries.value = []
  const el = chartMountRef.value
  if (!el) return

  const rows = Array.isArray(props.rows) ? props.rows : []
  const bench = Array.isArray(props.benchmarkBars) ? props.benchmarkBars : []
  if (!rows.length || !bench.length) {
    hint.value = '缺少主图序列或对照腿 K 线，无法绘制仪表盘。'
    return
  }
  hint.value = ''

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  planeIsDark.value = isDark
  const candles = toCandles(rows)
  if (!candles.length) {
    eulerPlaneSeries.value = []
    return
  }

  const rowBySec = new Map()
  for (const b of rows) {
    const sec = Math.floor(Number(b.t) / 1000)
    if (Number.isFinite(sec)) rowBySec.set(sec, b)
  }

  const ap = buildAboParams(isDark)
  const benchCandles = toCandles(bench)
  const abo = aboSeriesDual(
    candles,
    benchCandles,
    ap.fastP,
    ap.slowP,
    ap.thr,
    ap.isDark,
    ap.softClamp,
    ap.softClampDiv,
    ap.softClampRange,
    ap.softClampScore,
    ap.reversalBoost,
    ap.reversalBoostFactor,
    ap.volumeWeighted,
    ap.volumePeriod,
    ap.winsorize,
    ap.winsorLimit,
    ap.preSmoothPeriod,
    ap.benchmarkNoiseFilter,
    ap.benchmarkMinMovePct
  )
  if (!abo.cumAboSeries?.length) {
    hint.value = 'ABO 序列为空（检查主/基准数据是否重叠）。'
    eulerPlaneSeries.value = []
    return
  }

  const aviP = Math.max(2, Math.min(2000, Math.floor(Number(props.aviPeriod)) || 100))
  const aviRaw = computeAviRaw(abo.cumAboSeries, abo.priceSeries, aviP)

  const atrP = Math.max(2, Math.min(200, Math.floor(Number(props.atrPeriod)) || 14))
  const mult = Math.max(0.5, Math.min(6, Number(props.atrStopMult) || 1.5))
  const atrPts = atrEmaSeries(candles, atrP)
  const atrByTime = new Map(atrPts.map((x) => [x.time, x.value]))
  const supportData = []
  for (const c of candles) {
    const atr = atrByTime.get(c.time)
    if (!Number.isFinite(atr)) continue
    supportData.push({ time: c.time, value: c.close - mult * atr })
  }

  /** CVD：逐砖 Δ 后累积。砖/1m 为 USDT 额 + takerQuote 时 Δ=2×takerQuote−V；否则有 takerBase 且 V 为基础量时用 2×takerBase−V；否则 sign×V */
  const cvdLine = []
  let cum = 0
  let usedTaker = false
  let cvdQuoteMismatch = false
  for (const c of candles) {
    const row = rowBySec.get(c.time)
    const vol = Number.isFinite(c.volume) ? c.volume : Number(row?.v) || 0
    const tbq = row ? takerBuyQuoteFromRow(row) : null
    const tbb = row ? takerBuyBaseFromRow(row) : null
    let delta
    if (tbq != null && vol > 1e-12) {
      const mismatchMsg = cvdUsdtQuoteMismatchReason(vol, tbq)
      if (mismatchMsg) {
        cvdQuoteMismatch = true
        delta = (c.close >= c.open ? 1 : -1) * vol
      } else {
        delta = 2 * tbq - vol
        usedTaker = true
      }
    } else if (tbb != null && vol > 1e-12) {
      delta = 2 * tbb - vol
      usedTaker = true
    } else {
      delta = (c.close >= c.open ? 1 : -1) * vol
    }
    cum += delta
    cvdLine.push({ time: c.time, value: cum })
  }
  const hintParts = []
  if (!usedTaker && !cvdQuoteMismatch) {
    hintParts.push('当前 K 线无 taker 字段或砖为旧版，CVD 采用 sign(涨跌)×V 近似；请用含 taker 的 1m V3 .jbar 重新构建点砖。')
  }
  if (cvdQuoteMismatch) {
    hintParts.push(
      '部分砖检测到 takerBuyQuote > V（同砖），疑似 Base/USDT 口径混用；这些砖 CVD 已降级为 sign(涨跌)×V。'
    )
  }
  hint.value = hintParts.join(' ')

  /** 欧拉 I/Q/A/θ/PDO：公式与步进见 `@/utils/chartIndicatorCore.js` 顶部「Beta 时钟 · 欧拉共振」；此处只绑参 + 转 Lightweight Charts 序列 */
  const eulerZWin = Math.max(2, Math.min(2000, Math.floor(Number(props.aviPeriod)) || 100))
  const cvdEmaForEuler = Math.max(
    1,
    Math.min(
      500,
      Math.floor(Number(props.profile?.cvdMomentumEmaPeriod ?? props.cvdMomentumEmaPeriod)) || 5
    )
  )
  const pfE = props.profile || {}
  const zRatIn = Number(pfE.eulerZVolatilityFloorRatio)
  let zVolatilityFloorRatio = 0
  if (!Number.isFinite(zRatIn)) zVolatilityFloorRatio = 0.2
  else if (zRatIn > 0) zVolatilityFloorRatio = zRatIn
  const zSigmaAbsIn = Number(pfE.eulerZSigmaFloorAbs)
  const zSigmaFloorAbs = Number.isFinite(zSigmaAbsIn) && zSigmaAbsIn > 0 ? zSigmaAbsIn : undefined
  const minAIn = Number(pfE.eulerChameleonMinA)
  let eulerChameleonMinA = 0
  if (!Number.isFinite(minAIn)) eulerChameleonMinA = 1.2
  else if (minAIn > 0) eulerChameleonMinA = minAIn

  const eulerResOpts = {
    zWindow: eulerZWin,
    cvdEmaPeriod: cvdEmaForEuler,
  }
  if (zVolatilityFloorRatio > 0) eulerResOpts.zVolatilityFloorRatio = zVolatilityFloorRatio
  if (zSigmaFloorAbs != null) eulerResOpts.zSigmaFloorAbs = zSigmaFloorAbs
  const mahaW = Number(pfE.eulerMahaWindow ?? pfE.mahaWindowBricks)
  if (Number.isFinite(mahaW) && mahaW >= 2) {
    eulerResOpts.eulerMahaWindow = Math.max(2, Math.min(500, Math.floor(mahaW)))
  }

  const custom = Array.isArray(props.customEulerPoints) ? props.customEulerPoints : null
  const eulerPtsRaw =
    custom && custom.length === candles.length
      ? custom
      : eulerResonanceFromBricks(candles, benchCandles, cvdLine, eulerResOpts)
  const spiralSmooth = Math.max(0, Math.floor(Number(pfE.spiralSigmaSmooth) || 5))
  const spiralTh = Number.isFinite(Number(pfE.spiralSigmaThreshold)) ? Math.abs(Number(pfE.spiralSigmaThreshold)) : 0.05
  const spiralMode = ['ema', 'zlema', 'hma'].includes(pfE.spiralSigmaSmoothMode) ? pfE.spiralSigmaSmoothMode : 'zlema'
  const spiralModeLabel = sigmaSmoothModeLabel(spiralMode)
  const eulerSpiralPts = eulerSpiralEnrich(eulerPtsRaw, { sigmaSmooth: spiralSmooth, sigmaThreshold: spiralTh, sigmaSmoothMode: spiralMode })
  eulerPlaneSeries.value = eulerSpiralPts

  const eulerPts = eulerPtsRaw
  const chameleonOpts = {}
  if (eulerChameleonMinA > 0) chameleonOpts.minAForColor = eulerChameleonMinA
  const paintQCustom = Array.isArray(props.customEulerChameleonPaintQuadrants)
    ? props.customEulerChameleonPaintQuadrants
    : null
  if (paintQCustom && paintQCustom.length === candles.length) {
    chameleonOpts.paintQuadrants = paintQCustom
  }
  const candlesChameleon = buildEulerChameleonCandles(candles, eulerPts, isDark, chameleonOpts)

  const { points: eulerEnergyRaw, displayAbsCap: eulerEnergyDisplayAbsCap } = buildEulerEnergyHistogramPoints(
    eulerPts,
    isDark
  )

  const sineData = []
  const leadData = []
  const pdoData = []
  /** 独立窗格纵轴：度（−180～180）；theta 缺失时用 I,Q 回算 atan2 */
  const thetaDegData = []
  for (const e of eulerPts) {
    sineData.push({ time: e.time, value: e.sinTheta })
    leadData.push({ time: e.time, value: e.cosTheta })
    let th = e.theta
    if (!Number.isFinite(th)) {
      const Ii = Number(e.I)
      const Qi = Number(e.Q)
      th = Number.isFinite(Ii) && Number.isFinite(Qi) ? Math.atan2(Qi, Ii) : NaN
    }
    const deg = Number.isFinite(th) ? (th * 180) / Math.PI : NaN
    thetaDegData.push({ time: e.time, value: deg })
    const d = e.pdo
    const up = isDark ? '#4ade80' : '#16a34a'
    const down = isDark ? '#f87171' : '#dc2626'
    const color = Number.isFinite(d) && d >= 0 ? up : down
    pdoData.push({ time: e.time, value: d, color })
  }

  const showSpiral = pfE.showSpiral === true || String(pfE.showSpiral) === 'true' || Number(pfE.showSpiral) > 0
  const sigmaData = []
  const omegaData = []
  if (showSpiral && eulerSpiralPts.length) {
    for (const sp of eulerSpiralPts) {
      const sv = Number(sp.sigmaSmoothed)
      const ov = Number(sp.omega)
      const phColor = spiralPhaseColor(sp.spiralPhase, isDark)
      sigmaData.push({ time: sp.time, value: Number.isFinite(sv) ? sv : 0, color: phColor })
      const omegaDeg = Number.isFinite(ov) ? (ov * 180) / Math.PI : 0
      omegaData.push({ time: sp.time, value: omegaDeg })
    }
  }

  /** 主图标记：欧拉 PDO 上穿零且模长 A 过阈；另保留价格新低 + CVD 抬高（吸收） */
  const markers = []
  const eulerAProf = Number(props.profile?.eulerConsensusA)
  const eulerAThresh = Math.max(
    0.5,
    Math.min(
      20,
      (Number.isFinite(eulerAProf) && eulerAProf > 0 ? eulerAProf : Number(props.eulerConsensusA)) || 2
    )
  )
  for (let i = 1; i < eulerPts.length; i++) {
    const prevP = eulerPts[i - 1].pdo
    const curP = eulerPts[i].pdo
    if (prevP < 0 && curP >= 0 && eulerPts[i].A >= eulerAThresh) {
      markers.push({
        time: eulerPts[i].time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: '欧拉',
      })
    }
  }

  const W = 8
  for (let i = W; i < candles.length; i++) {
    let minLow = Infinity
    let minCvd = Infinity
    for (let j = i - W; j < i; j++) {
      minLow = Math.min(minLow, candles[j].low)
      minCvd = Math.min(minCvd, cvdLine[j].value)
    }
    const lowI = candles[i].low
    const cvdI = cvdLine[i].value
    if (lowI < minLow - 1e-12 && cvdI > minCvd + 1e-9) {
      markers.push({
        time: candles[i].time,
        position: 'belowBar',
        color: '#4ade80',
        shape: 'circle',
        text: '吸收',
      })
    }
  }

  const relLb = Math.max(2, Math.min(20, Math.floor(Number(props.releaseLookback)) || 3))
  const relMom = Number(props.releaseCvdMomentumMin)
  const relEff = Number(props.releaseEfficiencyMin)
  const { markers: releaseMarkers } = buildReleaseMarkers(candles, cvdLine, {
    lookback: relLb,
    momentumMin: Number.isFinite(relMom) && relMom > 0 ? relMom : null,
    efficiencyMin: Number.isFinite(relEff) && relEff > 0 ? relEff : null,
  })
  const occupiedReleaseTimes = new Set(markers.map((m) => toEpochSeconds(m.time)))
  for (const rm of releaseMarkers) {
    const ts = toEpochSeconds(rm.time)
    if (occupiedReleaseTimes.has(ts)) continue
    occupiedReleaseTimes.add(ts)
    markers.push(rm)
  }

  const w = Math.max(el.clientWidth || 320, 320)
  const H = totalHeight.value
  const pf = priceFormatFromDecimals(props.priceDecimals)

  const cvdLineClean = sanitizeTimePoints(cvdLine, (p) => p.value)
  const cvdMomP = Math.max(
    1,
    Math.min(
      500,
      Math.floor(Number(props.profile?.cvdMomentumEmaPeriod ?? props.cvdMomentumEmaPeriod)) || 5
    )
  )
  const cvdMomRaw = cvdMomentumSeriesFromCumulative(cvdLineClean, cvdMomP)
  const prof = props.profile || {}
  const useCvdKalman =
    prof.cvdMomentumUseKalman !== undefined && prof.cvdMomentumUseKalman !== null
      ? !!(prof.cvdMomentumUseKalman === true || Number(prof.cvdMomentumUseKalman) > 0.5)
      : props.cvdMomentumUseKalman
  const cvdKfQ = Math.max(
    1e-9,
    Number.isFinite(Number(prof.cvdMomentumKalmanQ))
      ? Number(prof.cvdMomentumKalmanQ)
      : Number(props.cvdMomentumKalmanQ) || 0.08
  )
  const cvdKfR = Math.max(
    1e-9,
    Number.isFinite(Number(prof.cvdMomentumKalmanR))
      ? Number(prof.cvdMomentumKalmanR)
      : Number(props.cvdMomentumKalmanR) || 0.2
  )
  const cvdMomForScale = useCvdKalman && cvdMomRaw.length ? kalmanFromPoints(cvdMomRaw, cvdKfQ, cvdKfR) : cvdMomRaw

  /** 双线：对原始动能做快/慢两套 KF（与 Jbar Z 区 Kalman 同源参数，经 profile 传入） */
  const kfLineQ = Math.max(
    1e-6,
    Number.isFinite(Number(prof.kalmanFastQ)) ? Number(prof.kalmanFastQ) : Number(props.cvdKalmanFastQ) || 0.08
  )
  const kfLineR = Math.max(
    1e-6,
    Number.isFinite(Number(prof.kalmanFastR)) ? Number(prof.kalmanFastR) : Number(props.cvdKalmanFastR) || 0.2
  )
  const ksLineQ = Math.max(
    1e-6,
    Number.isFinite(Number(prof.kalmanSlowQ)) ? Number(prof.kalmanSlowQ) : Number(props.cvdKalmanSlowQ) || 0.01
  )
  const ksLineR = Math.max(
    1e-6,
    Number.isFinite(Number(prof.kalmanSlowR)) ? Number(prof.kalmanSlowR) : Number(props.cvdKalmanSlowR) || 0.8
  )
  const cvdKfLinePts =
    useCvdKalman && cvdMomRaw.length ? kalmanFromPoints(cvdMomRaw, kfLineQ, kfLineR) : []
  const cvdKsLinePts =
    useCvdKalman && cvdMomRaw.length ? kalmanFromPoints(cvdMomRaw, ksLineQ, ksLineR) : []

  /** 动能柱量纲随品种/成交额很大；柱体按本段 max|值| 线性映射到 [−3,3]（可选 KF 后）；累积 CVD 不绘制，仍用于动能与「释放」标记 */
  let cvdMomMaxAbs = 0
  for (const p of cvdMomForScale) {
    const a = Math.abs(p.value)
    if (Number.isFinite(a)) cvdMomMaxAbs = Math.max(cvdMomMaxAbs, a)
  }
  const cvdMomVisualMul = cvdMomMaxAbs > 1e-30 ? 3 / cvdMomMaxAbs : 1
  const cvdMomColored = cvdMomForScale.map((p) => {
    const v = p.value
    const vs = Number.isFinite(v) ? Math.max(-3, Math.min(3, v * cvdMomVisualMul)) : v
    const up = isDark ? '#4ade80' : '#16a34a'
    const down = isDark ? '#f87171' : '#dc2626'
    const color = Number.isFinite(vs) && vs >= 0 ? up : down
    return { time: p.time, value: vs, color }
  })
  const cvdMomClean = sanitizeTimePoints(cvdMomColored, (p) => p.value)
  const supportClean = sanitizeTimePoints(supportData, (p) => p.value)
  const aviDataRaw = aviRaw.map((row) => {
    const aviVal = row.value
    let color = isDark ? '#9ca3af' : '#6b7280'
    if (aviVal >= 2.0) color = isDark ? '#15803d' : '#166534'
    else if (aviVal <= -2.0) color = isDark ? '#b91c1c' : '#991b1b'
    else if (aviVal > 0) color = isDark ? 'rgba(34,197,94,0.45)' : 'rgba(22,163,74,0.45)'
    else color = isDark ? 'rgba(248,113,113,0.45)' : 'rgba(220,38,38,0.45)'
    return { time: row.time, value: aviVal, color }
  })
  const aviDataClean = sanitizeTimePoints(aviDataRaw, (p) => p.value)
  const sineDataClean = sanitizeTimePoints(sineData, (p) => p.value)
  const leadDataClean = sanitizeTimePoints(leadData, (p) => p.value)
  const thetaDegDataClean = sanitizeTimePoints(thetaDegData, (p) => p.value)
  const pdoDataClean = sanitizeTimePoints(pdoData, (p) => p.value)
  const eulerEnergyClean = sanitizeTimePoints(eulerEnergyRaw, (p) => p.value)
  const sigmaDataClean = sanitizeTimePoints(sigmaData, (p) => p.value)
  const omegaDataClean = sanitizeTimePoints(omegaData, (p) => p.value)

  const showMacdRaw = prof.showMacd
  const showMacd =
    showMacdRaw === true || String(showMacdRaw) === 'true' || Number(showMacdRaw) > 0
  const macdFast = Math.max(2, Math.min(200, Math.floor(Number(prof.macdFastPeriod)) || 12))
  const macdSlow = Math.max(macdFast + 1, Math.min(300, Math.floor(Number(prof.macdSlowPeriod)) || 26))
  const macdSig = Math.max(2, Math.min(100, Math.floor(Number(prof.macdSignalPeriod)) || 9))
  let macdBundle = { macd: [], signal: [], hist: [] }
  if (showMacd && candles.length >= macdSlow + macdSig) {
    macdBundle = classicMacdSeriesFromCandles(candles, macdFast, macdSlow, macdSig, isDark)
  }
  const hasMacdPane = showMacd && macdBundle.hist.length > 0
  const macdHistClean = hasMacdPane ? sanitizeTimePoints(macdBundle.hist, (p) => p.value) : []
  const macdLineClean = hasMacdPane ? sanitizeTimePoints(macdBundle.macd, (p) => p.value) : []
  const macdSignalClean = hasMacdPane ? sanitizeTimePoints(macdBundle.signal, (p) => p.value) : []

  const hasThetaPane = thetaDegDataClean.length > 0
  const hasSpiralPane = showSpiral && sigmaDataClean.length > 0
  const macdPaneIdx = 1
  const cvdPane = hasMacdPane ? 2 : 1
  const aviPane = hasMacdPane ? 3 : 2
  const thetaPane = hasThetaPane ? (hasMacdPane ? 4 : 3) : -1
  const hilPane = hasMacdPane ? (hasThetaPane ? 5 : 4) : hasThetaPane ? 4 : 3
  const eulerEnergyPane = hasMacdPane ? (hasThetaPane ? 6 : 5) : hasThetaPane ? 5 : 4
  const spiralPane = hasSpiralPane ? eulerEnergyPane + 1 : -1

  const showBoll =
    prof.showBollinger === true ||
    String(prof.showBollinger) === 'true' ||
    Number(prof.showBollinger) > 0
  const bollP = Math.max(2, Math.min(200, Math.floor(Number(prof.bollingerPeriod)) || 20))
  const bollM = Math.max(0.5, Math.min(6, Number(prof.bollingerMult) || 2))
  const bollBands =
    showBoll && candles.length >= bollP
      ? bollingerBandsFromCandles(candles, bollP, bollM)
      : { upper: [], middle: [], lower: [] }
  const hasBoll = showBoll && bollBands.upper.length > 0
  const bollUpperClean = hasBoll ? sanitizeTimePoints(bollBands.upper, (p) => p.value) : []
  const bollMiddleClean = hasBoll ? sanitizeTimePoints(bollBands.middle, (p) => p.value) : []
  const bollLowerClean = hasBoll ? sanitizeTimePoints(bollBands.lower, (p) => p.value) : []

  chart = createChart(el, {
    autoSize: false,
    width: w,
    height: H,
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
    localization: { timeFormatter: (time) => formatChartTime(time) },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter: (time) => formatChartTime(time),
    },
    rightPriceScale: { borderColor: isDark ? '#45475a' : '#cccccc' },
  })
  chartRef.value = chart
  chart._hasMacdPane = hasMacdPane
  chart._hasThetaPane = hasThetaPane

  const candleOpts = {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  }
  if (pf) candleOpts.priceFormat = pf
  const candleSeries = chart.addSeries(CandlestickSeries, candleOpts, 0)
  candleSeries.setData(candlesChameleon)
  seriesList.push(candleSeries)

  if (hasBoll && bollUpperClean.length) {
    const bollStyle = {
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      ...(pf ? { priceFormat: pf } : {}),
    }
    const bollU = chart.addSeries(
      LineSeries,
      {
        ...bollStyle,
        color: isDark ? '#7f8c9a' : '#90a4ae',
        lineStyle: 2,
        title: `BB+${bollP}`,
      },
      0
    )
    bollU.setData(bollUpperClean)
    seriesList.push(bollU)
    const bollMid = chart.addSeries(
      LineSeries,
      {
        ...bollStyle,
        color: isDark ? '#a0a8b0' : '#78909c',
        title: `BB${bollP}`,
      },
      0
    )
    bollMid.setData(bollMiddleClean)
    seriesList.push(bollMid)
    const bollL = chart.addSeries(
      LineSeries,
      {
        ...bollStyle,
        color: isDark ? '#7f8c9a' : '#90a4ae',
        lineStyle: 2,
        title: `BB-${bollP}`,
      },
      0
    )
    bollL.setData(bollLowerClean)
    seriesList.push(bollL)
  }

  if (supportClean.length) {
    const sup = chart.addSeries(
      LineSeries,
      {
        color: isDark ? '#a78bfa' : '#7c3aed',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `支撑 C−${mult}ATR`,
        ...(pf ? { priceFormat: pf } : {}),
      },
      0
    )
    sup.setData(supportClean)
    seriesList.push(sup)
  }

  if (markers.length) {
    sortMarkersForLightweightCharts(markers)
    createSeriesMarkers(candleSeries, markers)
  }

  if (hasMacdPane && macdHistClean.length) {
    const macdFmt = { type: 'price', precision: 4, minMove: 0.0001 }
    const macdHist = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: 'right',
        priceLineVisible: false,
        lastValueVisible: true,
        title: `MACD柱(${macdFast},${macdSlow},${macdSig})`,
        priceFormat: macdFmt,
      },
      macdPaneIdx
    )
    macdHist.setData(macdHistClean)
    macdHist.createPriceLine({
      price: 0,
      color: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.65)',
      lineWidth: 1,
      lineStyle: 2,
    })
    seriesList.push(macdHist)
    const macdDif = chart.addSeries(
      LineSeries,
      {
        color: isDark ? '#38bdf8' : '#0284c7',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'DIF',
        priceFormat: macdFmt,
      },
      macdPaneIdx
    )
    macdDif.setData(macdLineClean)
    seriesList.push(macdDif)
    const macdDea = chart.addSeries(
      LineSeries,
      {
        color: isDark ? '#f472b6' : '#db2777',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'DEA',
        priceFormat: macdFmt,
      },
      macdPaneIdx
    )
    macdDea.setData(macdSignalClean)
    seriesList.push(macdDea)
  }

  const candleByTime = new Map()
  for (const c of candles) {
    candleByTime.set(c.time, c)
  }
  const tipW = 200
  const tipH = 168
  const priceText = (x) => {
    const n = Number(x)
    if (!Number.isFinite(n)) return '—'
    const p = Math.max(0, Math.min(8, Math.floor(Number(props.priceDecimals))))
    return n.toFixed(p)
  }
  const crosshairHandler = (param) => {
    if (!chart || !chartHostRef.value || !param?.time || !param?.point) {
      hoverBrickMetrics.value.visible = false
      return
    }
    const sec = toEpochSeconds(param.time)
    const c = candleByTime.get(sec)
    if (
      !c ||
      !Number.isFinite(c.open) ||
      c.open <= 0 ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close)
    ) {
      hoverBrickMetrics.value.visible = false
      return
    }
    const ampPct = ((c.high - c.low) / c.open) * 100
    const chgPct = ((c.close - c.open) / c.open) * 100
    const sign = chgPct > 0 ? '+' : ''
    const w = Math.max(320, chartHostRef.value.clientWidth || 320)
    const x = Math.max(0, Math.min(param.point.x + 12, w - tipW))
    const Hpx = totalHeight.value
    const y = Math.max(0, Math.min(param.point.y + 12, Hpx - tipH))
    hoverBrickMetrics.value = {
      visible: true,
      left: x,
      top: y,
      openText: priceText(c.open),
      highText: priceText(c.high),
      lowText: priceText(c.low),
      closeText: priceText(c.close),
      amplitudeText: `${Number.isFinite(ampPct) ? ampPct.toFixed(2) : '—'}%`,
      changeText: `${sign}${Number.isFinite(chgPct) ? chgPct.toFixed(2) : '—'}%`,
      changePct: chgPct,
    }
  }
  chart.subscribeCrosshairMove(crosshairHandler)
  chart._crosshairHandler = crosshairHandler

  if (cvdMomClean.length) {
    const momHist = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: 'right',
        priceLineVisible: false,
        lastValueVisible: true,
        title: useCvdKalman
          ? `CVD动能(KF·柱±3, CVD−EMA${cvdMomP})`
          : `CVD动能(柱±3, CVD−EMA${cvdMomP})`,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      },
      cvdPane
    )
    momHist.setData(cvdMomClean)
    momHist.createPriceLine({
      price: 0,
      color: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.65)',
      lineWidth: 1,
      lineStyle: 2,
    })
    seriesList.push(momHist)

    if (useCvdKalman && cvdKfLinePts.length) {
      const kfFmt = { type: 'price', precision: 2, minMove: 0.01 }
      const kfLine = chart.addSeries(
        LineSeries,
        {
          priceScaleId: 'left',
          color: isDark ? '#2dd4bf' : '#0891b2',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'CVDΔ K-F',
          priceFormat: kfFmt,
        },
        cvdPane
      )
      kfLine.setData(cvdKfLinePts)
      seriesList.push(kfLine)
    }
    if (useCvdKalman && cvdKsLinePts.length) {
      const kfFmt = { type: 'price', precision: 2, minMove: 0.01 }
      const ksLine = chart.addSeries(
        LineSeries,
        {
          priceScaleId: 'left',
          color: isDark ? '#fbbf24' : '#d97706',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'CVDΔ K-S',
          priceFormat: kfFmt,
        },
        cvdPane
      )
      ksLine.setData(cvdKsLinePts)
      seriesList.push(ksLine)
    }
  }

  const aviSeries = chart.addSeries(
    HistogramSeries,
    {
      color: isDark ? '#22d3ee' : '#0891b2',
      priceLineVisible: false,
      lastValueVisible: true,
      title: `AVI(${aviP})`,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    },
    aviPane
  )
  aviSeries.setData(aviDataClean)
  aviSeries.createPriceLine({ price: 0, color: isDark ? 'rgba(69,71,90,0.8)' : 'rgba(203,213,225,0.95)', lineWidth: 1, lineStyle: 2 })
  aviSeries.createPriceLine({ price: 2, color: isDark ? 'rgba(34,197,94,0.75)' : 'rgba(22,163,74,0.75)', lineWidth: 1, lineStyle: 2 })
  aviSeries.createPriceLine({ price: -2, color: isDark ? 'rgba(248,113,113,0.75)' : 'rgba(220,38,38,0.75)', lineWidth: 1, lineStyle: 2 })
  seriesList.push(aviSeries)

  if (hasThetaPane && thetaPane >= 0 && thetaDegDataClean.length) {
    const thetaLine = chart.addSeries(
      LineSeries,
      {
        color: isDark ? '#e879f9' : '#a21caf',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'θ(°) atan2(Q,I)',
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: -180,
            maxValue: 180,
          },
        }),
      },
      thetaPane
    )
    thetaLine.setData(thetaDegDataClean)
    seriesList.push(thetaLine)
  }

  if (pdoDataClean.length) {
    const pdoHist = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: 'left',
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'PDO (Euler)',
        priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
      },
      hilPane
    )
    pdoHist.setData(pdoDataClean)
    pdoHist.createPriceLine({
      price: 0,
      color: isDark ? 'rgba(148,163,184,0.65)' : 'rgba(100,116,139,0.75)',
      lineWidth: 1,
      lineStyle: 2,
    })
    seriesList.push(pdoHist)
  }

  const sineLine = chart.addSeries(
    LineSeries,
    {
      color: isDark ? '#60a5fa' : '#2563eb',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'sinθ (Q/A)',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    },
    hilPane
  )
  sineLine.setData(sineDataClean)
  seriesList.push(sineLine)

  const leadLine = chart.addSeries(
    LineSeries,
    {
      color: isDark ? '#facc15' : '#ca8a04',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'cosθ (I/A)',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    },
    hilPane
  )
  leadLine.setData(leadDataClean)
  seriesList.push(leadLine)

  leadLine.createPriceLine({
    price: 0.5,
    color: isDark ? '#facc15' : '#ca8a04',
    lineWidth: 1,
    lineStyle: 2,
    axisLabelVisible: true,
    title: 'cosθ +0.5',
  })
  sineLine.createPriceLine({
    price: -0.5,
    color: isDark ? '#60a5fa' : '#2563eb',
    lineWidth: 1,
    lineStyle: 2,
    axisLabelVisible: true,
    title: 'sinθ −0.5',
  })

  /** 方案三：欧拉共振能量柱 A（象限定色/方向），独立窗格；柱高经分位钳制 + 右轴固定域，避免极端 Z 撑爆比例尺 */
  if (eulerEnergyClean.length) {
    const eulerEnergyHist = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: 'right',
        priceLineVisible: false,
        lastValueVisible: true,
        title: '欧拉·A(共振)',
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      },
      eulerEnergyPane
    )
    eulerEnergyHist.setData(eulerEnergyClean)
    eulerEnergyHist.createPriceLine({
      price: 0,
      color: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.65)',
      lineWidth: 1,
      lineStyle: 2,
    })
    seriesList.push(eulerEnergyHist)
  }

  if (hasSpiralPane && spiralPane >= 0 && sigmaDataClean.length) {
    const sigmaHist = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: 'right',
        priceLineVisible: false,
        lastValueVisible: true,
        title: `σ 衰扩率 (${spiralModeLabel}${spiralSmooth})`,
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      },
      spiralPane
    )
    sigmaHist.setData(sigmaDataClean)
    sigmaHist.createPriceLine({
      price: 0,
      color: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.65)',
      lineWidth: 1,
      lineStyle: 2,
    })
    sigmaHist.createPriceLine({
      price: spiralTh,
      color: isDark ? 'rgba(74,222,128,0.65)' : 'rgba(22,163,74,0.65)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '+δ',
    })
    sigmaHist.createPriceLine({
      price: -spiralTh,
      color: isDark ? 'rgba(248,113,113,0.65)' : 'rgba(220,38,38,0.65)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '−δ',
    })
    seriesList.push(sigmaHist)

    if (omegaDataClean.length) {
      const omegaLine = chart.addSeries(
        LineSeries,
        {
          priceScaleId: 'left',
          color: isDark ? '#c084fc' : '#9333ea',
          lineWidth: 1.5,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'ω (°/砖)',
          priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        },
        spiralPane
      )
      omegaLine.setData(omegaDataClean)
      seriesList.push(omegaLine)
    }
  }

  forceChartLayoutRefresh(w, H)
  applyPaneHeights(H)

  chart.timeScale().fitContent()

  function applyEulerEnergyPriceScale() {
    if (!chart || !eulerEnergyClean.length) return
    if (eulerEnergyDisplayAbsCap == null || !Number.isFinite(eulerEnergyDisplayAbsCap)) return
    try {
      const ps = chart.priceScale('right', eulerEnergyPane)
      const m = eulerEnergyDisplayAbsCap * 1.15
      ps.applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 } })
      ps.setAutoScale(false)
      ps.setVisibleRange({ from: -m, to: m })
    } catch {
      /* 子窗格尚未就绪时忽略 */
    }
  }
  applyEulerEnergyPriceScale()
  requestAnimationFrame(() => applyEulerEnergyPriceScale())

  function applySpiralPaneScales() {
    if (!chart || !hasSpiralPane || spiralPane < 0) return
    try {
      const ls = chart.priceScale('left', spiralPane)
      ls.applyOptions({
        visible: true,
        borderVisible: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      })
    } catch { /* not ready */ }
  }
  if (hasSpiralPane) {
    applySpiralPaneScales()
    requestAnimationFrame(() => applySpiralPaneScales())
  }

  /** CVD 窗仅柱序列：默认右轴，固定可见域与 ±3 柱数据一致 */
  const hasCvdMomentumHistogram = cvdMomClean.length > 0
  function applyCvdMomentumPriceScale() {
    if (!chart || !hasCvdMomentumHistogram) return
    try {
      const ps = chart.priceScale('right', cvdPane)
      ps.applyOptions({
        scaleMargins: { top: 0.12, bottom: 0.12 },
      })
      ps.setAutoScale(false)
      ps.setVisibleRange({ from: -3.5, to: 3.5 })
    } catch {
      /* 子窗格尚未就绪时忽略 */
    }
  }
  applyCvdMomentumPriceScale()
  requestAnimationFrame(() => applyCvdMomentumPriceScale())

  const hasCvdKalmanDualLines = useCvdKalman && cvdKfLinePts.length > 0
  function applyCvdKalmanLinesLeftScale() {
    if (!chart || !hasCvdKalmanDualLines) return
    try {
      const ls = chart.priceScale('left', cvdPane)
      ls.applyOptions({
        visible: true,
        borderVisible: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      })
    } catch {
      /* ignore */
    }
  }
  applyCvdKalmanLinesLeftScale()
  requestAnimationFrame(() => applyCvdKalmanLinesLeftScale())

  function applyHilbertPdoLeftScale() {
    if (!chart || !pdoDataClean.length) return
    try {
      const ls = chart.priceScale('left', hilPane)
      ls.applyOptions({ visible: true, borderVisible: true, scaleMargins: { top: 0.1, bottom: 0.1 } })
    } catch {
      /* ignore */
    }
  }
  applyHilbertPdoLeftScale()
  requestAnimationFrame(() => applyHilbertPdoLeftScale())

  const ro = new ResizeObserver(() => {
    if (!chart || !chartHostRef.value) return
    const rw = Math.max(chartHostRef.value.clientWidth || 320, 320)
    const rh = totalHeight.value
    chart.applyOptions({ autoSize: false, width: rw, height: rh })
    chart.resize(rw, rh)
    applyPaneHeights(rh)
    applyCvdMomentumPriceScale()
    applyCvdKalmanLinesLeftScale()
    applyHilbertPdoLeftScale()
  })
  if (chartHostRef.value) {
    ro.observe(chartHostRef.value)
  }
  chart._ro = ro
}

onMounted(() => {
  nextTick(() => mountChart())
})

onBeforeUnmount(() => {
  if (chart?._ro) {
    chart._ro.disconnect()
    delete chart._ro
  }
  teardown()
})

watch(
  () => [
    props.rows,
    props.benchmarkBars,
    props.profile,
    props.height,
    props.atrPeriod,
    props.atrStopMult,
    props.aviPeriod,
    props.priceDecimals,
    props.releaseLookback,
    props.releaseCvdMomentumMin,
    props.releaseEfficiencyMin,
    props.cvdMomentumEmaPeriod,
    props.cvdMomentumUseKalman,
    props.cvdMomentumKalmanQ,
    props.cvdMomentumKalmanR,
    props.cvdKalmanFastQ,
    props.cvdKalmanFastR,
    props.cvdKalmanSlowQ,
    props.cvdKalmanSlowR,
    props.eulerConsensusA,
    props.eulerNoiseRadius,
    props.customEulerPoints,
    props.customEulerChameleonPaintQuadrants,
  ],
  () => nextTick(() => mountChart()),
  { deep: true }
)
</script>
