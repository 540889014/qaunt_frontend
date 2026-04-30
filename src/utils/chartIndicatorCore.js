/**
 * 与 JbarKlineChart 共用的指标内核（ABO / K 线转 candle），避免多组件复制漂移。
 */

export function toCandles(rows) {
  if (!rows?.length) return []
  return rows.map((b) => ({
    time: Math.floor(Number(b.t) / 1000),
    open: Number(b.o),
    high: Number(b.h),
    low: Number(b.l),
    close: Number(b.c),
    volume: Number(b.v),
  }))
}

/**
 * 自 1m jbar 按<strong>累计 USDT 成交额</strong>划窗生成合成「砖」行（字段与点砖 jbar 兼容：`t,o,h,l,c,v`，以及可选 taker 累计）。
 * 每当桶内累计 `v` ≥ `quoteUsdtThreshold` 时收一根；**不拆分钟**，故单根成交额可略大于阈值。
 *
 * @param {Array<{t:number,o?:number,h?:number,l?:number,c?:number,v?:number,takerBuyQuoteVolume?:number,takerBuyBaseVolume?:number}>} oneMinRows 时间升序；`v` 为 USDT 计价额（与 V3 1m 一致）
 * @param {number} quoteUsdtThreshold 例如 5_000_000 表示每约 500 万 U 一根砖
 * @returns {Array<{t:number,o:number,h:number,l:number,c:number,v:number,takerBuyQuoteVolume?:number,takerBuyBaseVolume?:number}>}
 */
export function buildQuoteVolumeBrickBarsFromOneMinute(oneMinRows, quoteUsdtThreshold) {
  const T = Number(quoteUsdtThreshold)
  if (!Array.isArray(oneMinRows) || oneMinRows.length < 1 || !Number.isFinite(T) || T <= 0) return []
  const sorted = [...oneMinRows]
    .filter((b) => Number.isFinite(Number(b?.t)) && Number.isFinite(Number(b?.c)))
    .map((b) => ({ ...b, t: Number(b.t) }))
    .sort((a, b) => a.t - b.t)
  const out = []
  let accVol = 0
  let o = NaN
  let h = NaN
  let l = NaN
  let c = NaN
  let tEnd = 0
  let sumTakerQ = 0
  let sumTakerB = 0
  let hasTakerQ = false
  let hasTakerB = false
  const emitAndReset = () => {
    const row = {
      t: tEnd,
      o,
      h,
      l,
      c,
      v: accVol,
    }
    if (hasTakerQ) row.takerBuyQuoteVolume = sumTakerQ
    if (hasTakerB) row.takerBuyBaseVolume = sumTakerB
    out.push(row)
    accVol = 0
    o = h = l = c = NaN
    sumTakerQ = sumTakerB = 0
    hasTakerQ = hasTakerB = false
  }
  for (const b of sorted) {
    const vt = Number(b.v)
    const vol = Number.isFinite(vt) && vt >= 0 ? vt : 0
    const co = Number(b.c)
    if (!Number.isFinite(co) || co <= 0) continue
    const ho = Number.isFinite(Number(b.h)) ? Number(b.h) : co
    const lo = Number.isFinite(Number(b.l)) ? Number(b.l) : co
    const oo = Number.isFinite(Number(b.o)) ? Number(b.o) : co
    const bt = Number(b.t)
    const tq = b.takerBuyQuoteVolume ?? b.taker_buy_quote_volume
    const tb = b.takerBuyBaseVolume ?? b.taker_buy_base_volume
    if (accVol <= 0) {
      o = oo
      h = ho
      l = lo
      c = co
      tEnd = bt
      accVol = vol
    } else {
      h = Math.max(h, ho)
      l = Math.min(l, lo)
      c = co
      tEnd = bt
      accVol += vol
    }
    if (Number.isFinite(Number(tq)) && Number(tq) >= 0) {
      sumTakerQ += Number(tq)
      hasTakerQ = true
    }
    if (Number.isFinite(Number(tb)) && Number(tb) >= 0) {
      sumTakerB += Number(tb)
      hasTakerB = true
    }
    if (accVol >= T) {
      emitAndReset()
    }
  }
  return out
}

/**
 * ATR（海龟式）：先算每根 TR = max(H-L, |H-昨收|, |L-昨收|)，再对 TR 做 N 周期 **EMA** 平滑，α = 2/(N+1)。
 *
 * 注：Wilder 原版 ATR 对 TR 使用 RMA（Wilder smoothing，α = 1/N），与 TradingView 默认 ATR 更一致。
 * 本系统采用 EMA，对近期波动权重更大，曲线更敏捷；动态支撑会略更贴近期价格。对账时若与 TV 有细微差异属预期。
 */
export function atrEmaSeries(candles, period) {
  const n = Math.max(2, Math.min(200, Math.floor(Number(period)) || 20))
  if (!candles?.length || candles.length < n + 1) return []
  const tr = []
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high
    const l = candles[i].low
    const pc = candles[i - 1].close
    const t = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
    tr.push({ time: candles[i].time, tr: t })
  }
  if (tr.length < n) return []
  const alpha = 2 / (n + 1)
  const out = []
  let sum = 0
  for (let i = 0; i < n; i++) sum += tr[i].tr
  let atr = sum / n
  out.push({ time: tr[n - 1].time, value: atr })
  for (let i = n; i < tr.length; i++) {
    atr = alpha * tr[i].tr + (1 - alpha) * atr
    out.push({ time: tr[i].time, value: atr })
  }
  return out
}

/**
 * 砖级 CVD（USDT 口径）一致性：主动买入额不应大于该砖总成交额。
 *
 * @param {number} vol 砖上成交额 V（须与 taker 字段同口径，一般为 USDT）
 * @param {number} takerBuyQuote 主动买入成交额（quote）
 * @returns {string|null} 若违反物理约束则返回说明（疑似 Base/Quote 混用）；否则 null
 */
export function cvdUsdtQuoteMismatchReason(vol, takerBuyQuote) {
  if (!Number.isFinite(vol) || vol <= 1e-12) return null
  if (!Number.isFinite(takerBuyQuote) || takerBuyQuote < 0) return null
  if (takerBuyQuote > vol + 1e-9) {
    return '检测到 takerBuyQuote > V（同砖），疑似 Base/USDT 口径混用；该砖 CVD 增量已降级为 sign(涨跌)×V。'
  }
  return null
}

/**
 * CVD 动能（砖级）：对累积 CVD 序列做 EMA，再取偏离 \( \mathrm{CVD} - \mathrm{EMA}(\mathrm{CVD}, P) \)。
 * 与「雷达 Y 轴」口径一致：P 常用 5 根砖。
 *
 * @param {{ time: import('lightweight-charts').Time, value: number }[]} cvdCumulativePts 时间升序，value 为累积 CVD
 * @param {number} emaPeriod 默认 5
 * @returns {{ time: import('lightweight-charts').Time, value: number }[]}
 */
export function cvdMomentumSeriesFromCumulative(cvdCumulativePts, emaPeriod) {
  if (!cvdCumulativePts?.length) return []
  const P = Math.max(1, Math.min(500, Math.floor(Number(emaPeriod)) || 5))
  const k = 2 / (P + 1)
  const out = []
  let ema = null
  for (const pt of cvdCumulativePts) {
    const cvd = pt.value
    if (!Number.isFinite(cvd) || pt.time == null) continue
    ema = ema == null ? cvd : cvd * k + ema * (1 - k)
    out.push({ time: pt.time, value: cvd - ema })
  }
  return out
}

// --- 1m 异常波动阻尼 W_vol ∈ (0,1]：A_final *= W_vol（与马氏/贝叶斯独立相乘）---

/**
 * \(\kappa=V_{curr}/ATR_{1m}\)，\(W_{vol}=1\) 若 \(\kappa\le\tau\)，否则 \(\tau/\kappa\)。
 *
 * @param {number} kappa
 * @param {number} tau 容忍阈，建议 2～3
 * @returns {number} \((0,1]\)
 */
export function volatilityDampenerWvolFromKappa(kappa, tau) {
  if (!Number.isFinite(kappa) || kappa <= 0) return 1
  const t = Math.max(0.5, Math.min(20, Number(tau) || 2))
  if (kappa <= t) return 1
  return Math.min(1, t / kappa)
}

/**
 * Vision / 币安 jbar 1m 行 → 按 **收盘秒** 升序的 H-L 序列（closeSec = floor(openMs/1000)+60）。
 *
 * @param {any[]} rawBars `{ t: ms, h, l }[]`
 * @returns {{ closeSec: number, hl: number }[]}
 */
export function oneMinCloseHlSortedFromRawBars(rawBars) {
  const tmp = []
  for (const b of rawBars || []) {
    const openMs = Number(b?.t)
    const h = Number(b?.h)
    const l = Number(b?.l)
    if (!Number.isFinite(openMs) || !Number.isFinite(h) || !Number.isFinite(l)) continue
    const closeSec = Math.floor(openMs / 1000) + 60
    tmp.push({ closeSec, hl: Math.max(0, h - l) })
  }
  tmp.sort((a, b) => a.closeSec - b.closeSec)
  const out = []
  for (const x of tmp) {
    if (out.length && out[out.length - 1].closeSec === x.closeSec) out[out.length - 1] = x
    else out.push(x)
  }
  return out
}

function bisectLastLeqOneMinClose(sorted, tSec) {
  let lo = 0
  let hi = sorted.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].closeSec <= tSec) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/**
 * 对每个砖收时刻 \(t\)：取最后一根已收盘 1m（closeSec≤t）为 \(V_{curr}\)；\(ATR_{1m}\) 为此前 P 根 1m 的 H-L 均值（不含当前根）。
 *
 * @param {number[]} brickTimesSec 与砖对齐
 * @param {{ closeSec: number, hl: number }[]} oneMinSorted {@link oneMinCloseHlSortedFromRawBars}
 * @param {number} atrPeriod 默认 20
 * @param {number} tau 默认 2
 * @returns {{ Wvol: number[], kappa: number[] }}
 */
export function eulerVolatilityDampenerWvolKappaSeries(brickTimesSec, oneMinSorted, atrPeriod, tau) {
  const n = brickTimesSec?.length ?? 0
  const Wvol = new Array(n).fill(1)
  const kappa = new Array(n).fill(1)
  if (!n || !oneMinSorted?.length) return { Wvol, kappa }
  const P = Math.max(2, Math.min(500, Math.floor(Number(atrPeriod)) || 20))
  const tauU = Math.max(0.5, Math.min(20, Number(tau) || 2))

  for (let i = 0; i < n; i++) {
    const tSec = Number(brickTimesSec[i])
    if (!Number.isFinite(tSec)) continue
    const idx = bisectLastLeqOneMinClose(oneMinSorted, tSec)
    if (idx < 0) continue
    const Vcurr = oneMinSorted[idx].hl
    let sum = 0
    let cnt = 0
    const from = Math.max(0, idx - P)
    for (let j = from; j < idx; j++) {
      sum += oneMinSorted[j].hl
      cnt++
    }
    let atrM = cnt > 0 ? sum / cnt : Vcurr
    if (!(atrM > 1e-18)) atrM = Math.max(Vcurr, 1e-18)
    const k = Vcurr / atrM
    kappa[i] = k
    Wvol[i] = volatilityDampenerWvolFromKappa(k, tauU)
  }
  return { Wvol, kappa }
}

/**
 * @param {{ time: number }[]} mainCandles 砖 candle，`time` 为秒
 * @param {{ volDampenTau?: number, volDampenAtrPeriod?: number, volDampen1mRawBars?: any[] }} opts
 * @returns {{ Wvol: number[], kappa: number[] } | null}
 */
function eulerVolDampenerSeriesFromOpts(mainCandles, opts) {
  const tau = Number(opts?.volDampenTau)
  if (!Number.isFinite(tau) || tau <= 0) return null
  const raw = opts?.volDampen1mRawBars
  if (!Array.isArray(raw) || raw.length < 2) return null
  const sorted = oneMinCloseHlSortedFromRawBars(raw)
  if (!sorted.length) return null
  const n = mainCandles?.length ?? 0
  if (n < 1) return null
  const brickSec = new Array(n)
  for (let i = 0; i < n; i++) brickSec[i] = Number(mainCandles[i]?.time)
  const atrP = Math.max(2, Math.min(500, Math.floor(Number(opts.volDampenAtrPeriod)) || 20))
  return eulerVolatilityDampenerWvolKappaSeries(brickSec, sorted, atrP, tau)
}

// =============================================================================
// Beta 时钟 · 欧拉共振（Effort vs Result 相空间，四维盘最下窗）
// =============================================================================
//
// 约定（与 RenkoFourPaneDashboard / aboSeriesDual 同源）：
// - 主轴为「基准砖时钟」：`mainCandles` 与 `cvdCumulativePts` 已按该轴对齐；Forward-fill 砖
//   上主价可平移、V 与 ΔCVD 可为 0，但仍占一根索引，后续 Z/EMA 步进与策略/落盘一致。
//
// 定义（逐砖 i，与下式同一索引）：
// - I（Effort，资金推力）： I_i = Z_win( EMA_P( CVD^{cum}_i ) )，Z 为窗内样本标准差归一化（n−1）。
// - Q（Result，超额）：     r^{alt}_i = (C^{alt}_i - C^{alt}_{i-1}) / C^{alt}_{i-1}，
//                           r^{btc}_i 为基准收盘在「与主同时间轴」上的同上收益率；
//                           Q_i = Z_win(r^{alt})_i − Z_win(r^{btc})_i。
// - 共识模长 / 相位：默认 A_i = sqrt(I_i^2 + Q_i^2)（各向同性）；可选 **马氏距离**（`eulerMahaWindow`≥2）：窗内 \(\Sigma\) 的逆度量 \((\mathbf x-\boldsymbol\mu)^\top\Sigma^{-1}(\mathbf x-\boldsymbol\mu)\)，刻画相关结构下的异常能量；θ 仍用 \(\mathrm{atan2}(Q,I)\)（物理象限不变）。
// - 可选 **1m 波动阻尼**（`volDampenTau`>0 且传入 `volDampen1mRawBars`）：\(\kappa=V_{curr}/ATR_{1m}\)，\(W_{vol}\in(0,1]\)，最终能量再乘 \(W_{vol}\)（惩罚单根 1m 透支型巨震）。
// - 下窗绘图：             cosθ_i = I_i/A_i，sinθ_i = Q_i/A_i（A≈0 时为 0）；
//                           PDO_i = sin(θ_i + π/4) − sin(θ_i)（摩擦型振荡，θ 为真欧拉角）。
// - 主图「欧拉」标（调用方）：PDO_{i-1} < 0 ≤ PDO_i 且 A_i ≥ 共识阈（默认 2）。
// - 角速度：Δθ_i = wrap(θ_i − θ_{i-1}) ∈ (−π,π]，见 {@link wrappedThetaDelta}、{@link eulerEnrichWithDeltaTheta}（复平面窗用）。
// - **静风区**：`buildEulerChameleonCandles` 可选 `minAForColor`（如 1.2）：A&lt;阈时整砖中性灰，不解读象限。
// - **Z 方差地板**：`rollingSampleZScoreSeries` 可选 `sigmaVolatilityFloorRatio`（如 0.2）：在 i 处仅用 **stds[0..i]** 中 σ&gt;0 的均值 σ̄_i（因果），
//   σ_eff=max(σ, σ̄_i·ratio)；可选 `sigmaFloorAbs`。抑制横盘 σ→0 时 Z 发癫，与逐砖策略一致。
//
// 参数：`zWindow` → Z 与 Q 两侧共用；`cvdEmaPeriod` → 仅用于 I 轨上 EMA(CVD^cum)，与 CVD 动能柱 P 一致。
//
// **合成价差「虚拟币」欧拉**（统计套利，见 {@link eulerSpreadResonanceFromBricks}）：
// - \(R^{spread}_i = R^{alt}_i - \beta\,R^{bench}_i\)（同砖收盘收益），\(Q_i = Z_{win}(R^{spread})_i\)。
// - \(\Delta CVD^{spread}_i = \Delta CVD^{alt}_i - \beta\,\Delta CVD^{bench}_i\)，累积后
//   \(S_i=\sum_{k\le i}\Delta CVD^{spread}_k\)，\(I_i = Z_{win}(\mathrm{EMA}_P(S))_i\)（与单腿 I 同形）。
// - \(\beta\) 为标量对冲比（可由滚动回归或人工填入）；不持久化「SpreadAsset」对象亦可仅在内存/join 中算序列。
// - 可选 **I/Q 波动对齐**（`iqVolBalanceWindow`≥2）：在展示层令 \(I'_i = I_i \cdot \sigma_Q^{(i)}/\sigma_I^{(i)}\)（窗内样本标准差），缓解 CVD 与价差收益 Z 尺度不一导致的椭圆轨迹与能量偏斜（仅改输出的 I、A、θ、PDO，不改策略脚本）。
// - 可选 **I 时间滞后**（`iqLagBricks`=k≥1）：展示层用 \((I_{i-k}, Q_i)\) 代替 \((I_i,Q_i)\) 算 \(A,\theta,\mathrm{PDO}\)（先发资金、后现价差结果时压扁椭圆；首 k 根用 \(I_0\) 占位）。先于波动对齐应用。
// =============================================================================

const EULER_A_EPS = 1e-15

/**
 * 滚动窗内配对样本标准差（分母 n−1）；点数&lt;2 返回 0。
 * @param {number[]} xs
 */
function sampleStd1d(xs) {
  const finite = Array.isArray(xs) ? xs.filter((x) => Number.isFinite(x)) : []
  const n = finite.length
  if (n < 2) return 0
  let mean = 0
  for (const x of finite) mean += x
  mean /= n
  let s = 0
  for (const x of finite) {
    const d = x - mean
    s += d * d
  }
  return Math.sqrt(s / (n - 1))
}

/**
 * 方案二（展示层）：用 \(\sigma_Q/\sigma_I\) 在滚动窗内拉伸 I，使 I' 与 Q 在局部尺度上可比，再算 \(A=\sqrt{I'^2+Q^2}\)。
 * @param {number[]} Iarr
 * @param {number[]} Qarr
 * @param {number} win 砖数，≥2
 * @returns {number[]}
 */
export function balanceIqVolatilityForEulerDisplay(Iarr, Qarr, win) {
  const n = Math.min(Iarr?.length ?? 0, Qarr?.length ?? 0)
  const W = Math.max(2, Math.floor(Number(win)) || 2)
  const out = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - W + 1)
    const pairedI = []
    const pairedQ = []
    for (let k = start; k <= i; k++) {
      const a = Iarr[k]
      const b = Qarr[k]
      if (Number.isFinite(a) && Number.isFinite(b)) {
        pairedI.push(a)
        pairedQ.push(b)
      }
    }
    const ii = Number(Iarr[i])
    if (!Number.isFinite(ii)) {
      out[i] = 0
      continue
    }
    if (pairedI.length < 2) {
      out[i] = ii
      continue
    }
    const stdI = sampleStd1d(pairedI)
    const stdQ = sampleStd1d(pairedQ)
    if (stdI > 1e-12) {
      out[i] = ii * (stdQ / stdI)
    } else {
      out[i] = ii
    }
  }
  return out
}

/**
 * 方案三（展示层）：用「过去 k 砖」的 I 与「当前砖」的 Q 配对，\(I^{lag}_i = I_{i-k}\)（i&lt;k 时用 \(I_0\) 占位）。
 * @param {number[]} Iarr
 * @param {number} kBricks 整数砖数，0 表示不偏移
 * @returns {number[]}
 */
export function applyEulerILagBricks(Iarr, kBricks) {
  const n = Iarr?.length ?? 0
  if (n === 0) return []
  const k = Math.max(0, Math.min(500, Math.floor(Number(kBricks)) || 0))
  if (k <= 0) return Iarr
  const out = new Array(n)
  const i0 = Number(Iarr[0])
  const pad = Number.isFinite(i0) ? i0 : 0
  for (let i = 0; i < n; i++) {
    const src = i >= k ? i - k : 0
    const v = Number(Iarr[src])
    out[i] = Number.isFinite(v) ? v : pad
  }
  return out
}

/**
 * 对数值序列做 EMA，α = 2/(P+1)（与 {@link cvdMomentumSeriesFromCumulative} 对 CVD 的 EMA 同形）。
 *
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]}
 */
export function emaNumericSeries(values, period) {
  const P = Math.max(1, Math.min(500, Math.floor(Number(period)) || 5))
  const k = 2 / (P + 1)
  const out = []
  let ema = null
  for (const x of values) {
    if (!Number.isFinite(x)) {
      out.push(out.length ? out[out.length - 1] : 0)
      continue
    }
    ema = ema == null ? x : x * k + ema * (1 - k)
    out.push(ema)
  }
  return out
}

/**
 * 经典 MACD（收盘价 EMA）：DIF = EMA(fast)−EMA(slow)，DEA = EMA(DIF, signal)，柱 = DIF−DEA。
 *
 * @param {{ time: number, close?: number }[]} candles 砖 K 线，`time` 秒
 * @param {number} [fast=12]
 * @param {number} [slow=26]
 * @param {number} [signal=9]
 * @param {boolean} [isDark=false] 柱配色
 * @returns {{ macd: { time: number, value: number }[], signal: { time: number, value: number }[], hist: { time: number, value: number, color: string }[] }}
 */
export function classicMacdSeriesFromCandles(candles, fast = 12, slow = 26, signal = 9, isDark = false) {
  const n = candles?.length ?? 0
  if (n < 3) return { macd: [], signal: [], hist: [] }
  const fp = Math.max(2, Math.min(200, Math.floor(Number(fast)) || 12))
  const sp = Math.max(fp + 1, Math.min(300, Math.floor(Number(slow)) || 26))
  const sigp = Math.max(2, Math.min(100, Math.floor(Number(signal)) || 9))
  const closes = candles.map((c) => Number(c?.close))
  const times = candles.map((c) => c.time)
  const emaF = emaNumericSeries(closes, fp)
  const emaS = emaNumericSeries(closes, sp)
  const dif = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = emaF[i]
    const b = emaS[i]
    dif[i] = Number.isFinite(a) && Number.isFinite(b) ? a - b : 0
  }
  const deaArr = emaNumericSeries(dif, sigp)
  const macd = []
  const sigOut = []
  const hist = []
  const up = isDark ? '#22c55e' : '#16a34a'
  const down = isDark ? '#f87171' : '#dc2626'
  for (let i = 0; i < n; i++) {
    const d = dif[i]
    const dea = deaArr[i]
    if (!Number.isFinite(d) || !Number.isFinite(dea)) continue
    const h = d - dea
    const t = times[i]
    macd.push({ time: t, value: d })
    sigOut.push({ time: t, value: dea })
    hist.push({ time: t, value: h, color: h >= 0 ? up : down })
  }
  return { macd, signal: sigOut, hist }
}

/**
 * 布林带：中轨为滚动窗口收盘价 **总体** 标准差（与 JbarKlineChart 一致，分母 N）；上轨 = 中轨 + kσ，下轨 = 中轨 − kσ。
 *
 * @param {{ time: number, close?: number }[]} candles 砖 K 线
 * @param {number} [period=20]
 * @param {number} [mult=2]
 * @returns {{ upper: { time: number, value: number }[], middle: { time: number, value: number }[], lower: { time: number, value: number }[] }}
 */
export function bollingerBandsFromCandles(candles, period = 20, mult = 2) {
  const P = Math.max(2, Math.min(200, Math.floor(Number(period)) || 20))
  const M = Math.max(0.5, Math.min(6, Number(mult) || 2))
  const n = candles?.length ?? 0
  if (n < P) return { upper: [], middle: [], lower: [] }
  const closes = candles.map((c) => Number(c?.close))
  const times = candles.map((c) => c.time)
  const upper = []
  const middle = []
  const lower = []
  for (let i = P - 1; i < n; i++) {
    const slice = closes.slice(i - P + 1, i + 1)
    if (slice.some((x) => !Number.isFinite(x))) continue
    const mean = slice.reduce((a, b) => a + b, 0) / P
    const variance = slice.reduce((a, x) => a + (x - mean) ** 2, 0) / P
    const sd = Math.sqrt(Math.max(0, variance))
    const t = times[i]
    middle.push({ time: t, value: mean })
    upper.push({ time: t, value: mean + M * sd })
    lower.push({ time: t, value: mean - M * sd })
  }
  return { upper, middle, lower }
}

/**
 * 逐点滚动样本 Z-score：窗 [i−W+1, i] 内均值 μ、样本标准差 σ（分母 n−1）；|σ|<1e−12 或 n<2 时返回 0。
 *
 * 可选 **方差地板**（因果）：`sigmaVolatilityFloorRatio`&gt;0 时，先算每个 i 的窗内 σ_i 得 `stds[i]`；在 i 处仅用 **前缀**
 * `stds[0],…,stds[i]` 中 σ&gt;0 的算术均值 σ̄_i，令 `σ_floor_i = σ̄_i * ratio`，最终 `σ_eff = max(σ, σ_floor_i, sigmaFloorAbs)`（不偷看 i 之后）。
 *
 * @param {number[]} values 与主序列等长
 * @param {number} window 窗口长度 ≥2
 * @param {{ sigmaVolatilityFloorRatio?: number, sigmaFloorAbs?: number }} [opts]
 * @returns {number[]}
 */
export function rollingSampleZScoreSeries(values, window, opts = {}) {
  const n = values?.length ?? 0
  const W = Math.max(2, Math.min(2000, Math.floor(Number(window)) || 100))
  const out = new Array(n).fill(0)
  if (!n) return out

  const stds = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const x = values[i]
    if (!Number.isFinite(x)) continue
    const start = Math.max(0, i - W + 1)
    const slice = []
    for (let k = start; k <= i; k++) {
      if (Number.isFinite(values[k])) slice.push(values[k])
    }
    if (slice.length < 2) continue
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    let vsum = 0
    for (const s of slice) {
      const d = s - mean
      vsum += d * d
    }
    const std = Math.sqrt(vsum / (slice.length - 1))
    stds[i] = std > 1e-12 ? std : 0
  }

  const ratio = Number(opts?.sigmaVolatilityFloorRatio)
  const useRatioFloor = Number.isFinite(ratio) && ratio > 0
  const absFloorRaw = Number(opts?.sigmaFloorAbs)
  const useAbsFloor = Number.isFinite(absFloorRaw) && absFloorRaw > 0

  let prefixPosStdSum = 0
  let prefixPosStdCount = 0
  for (let i = 0; i < n; i++) {
    const x = values[i]
    if (!Number.isFinite(x)) continue
    const start = Math.max(0, i - W + 1)
    const slice = []
    for (let k = start; k <= i; k++) {
      if (Number.isFinite(values[k])) slice.push(values[k])
    }
    if (slice.length < 2) continue
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    let vsum = 0
    for (const s of slice) {
      const d = s - mean
      vsum += d * d
    }
    let std = Math.sqrt(vsum / (slice.length - 1))
    if (std <= 1e-12) std = 0

    if (stds[i] > 1e-12) {
      prefixPosStdSum += stds[i]
      prefixPosStdCount++
    }
    let ratioFloorSigma = 0
    if (useRatioFloor && prefixPosStdCount > 0) {
      ratioFloorSigma = (prefixPosStdSum / prefixPosStdCount) * ratio
    }

    let stdEff = std
    if (useRatioFloor) stdEff = Math.max(stdEff, ratioFloorSigma)
    if (useAbsFloor) stdEff = Math.max(stdEff, absFloorRaw)
    out[i] = stdEff > 1e-12 ? (x - mean) / stdEff : 0
  }
  return out
}

/**
 * 基准收盘按主砖时间 `time` 前向对齐（与 abo 采样「last bench ≤ t」一致）。
 *
 * @param {{ time: number, close: number }[]} mainCandles
 * @param {{ time: number, close: number }[]} benchCandles
 * @returns {number[]} 与 mainCandles 等长
 */
export function alignBenchCloseToMainCandles(mainCandles, benchCandles) {
  if (!mainCandles?.length || !benchCandles?.length) return []
  const benchSorted = [...benchCandles].sort((a, b) => a.time - b.time)
  let j = 0
  let lastClose = Number(benchSorted[0]?.close)
  const out = []
  for (const c of mainCandles) {
    while (j < benchSorted.length && benchSorted[j].time <= c.time) {
      lastClose = Number(benchSorted[j].close)
      j++
    }
    out.push(Number.isFinite(lastClose) ? lastClose : NaN)
  }
  return out
}

/**
 * 相邻砖收盘到收盘简单收益率；`closes[0]` 对应索引 0 无上一砖，返回 0。
 *
 * @param {number[]} closes 长度 n
 * @returns {number[]} 长度 n
 */
function brickCloseToCloseReturns(closes) {
  const n = closes.length
  const r = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const c = closes[i]
    const p = closes[i - 1]
    if (Number.isFinite(c) && Number.isFinite(p) && Math.abs(p) > 1e-18) {
      r[i] = (c - p) / p
    }
  }
  return r
}

/**
 * 由 (I, Q) 得到 A、θ、单位圆分量与 PDO（弧度）。
 *
 * @param {number} Ii
 * @param {number} Qi
 * @returns {{ A: number, theta: number, sinTheta: number, cosTheta: number, pdo: number }}
 */
function eulerPolarPdoFromIQ(Ii, Qi) {
  const A = Math.hypot(Ii, Qi)
  const theta = Math.atan2(Qi, Ii)
  let sinTheta = 0
  let cosTheta = 0
  if (A > EULER_A_EPS) {
    sinTheta = Qi / A
    cosTheta = Ii / A
  }
  const pdo = Math.sin(theta + Math.PI / 4) - Math.sin(theta)
  return { A, theta, sinTheta, cosTheta, pdo }
}

/**
 * **Morlet 式局部复振幅**（工程近似）：在砖序列上对 \((I,Q)\) 施加 **以当前砖为中心、向过去衰减** 的高斯权重
 * \(w_k\propto e^{-k^2/(2\sigma^2)}\)（\(k=0\) 为当前砖，\(k>0\) 为更早年砖），归一化后
 * \(\tilde Z_t=\sum_k w_k\bigl(I_{t-k}+iQ_{t-k}\bigr)\)。与连续 Morlet \(\psi\propto e^{-t^2/2}e^{i\omega t}\) 同构之处在 **高斯包络下的局部震荡**，用于压低长横盘、突出短时 \((I,Q)\) 脉冲。
 *
 * @param {number[]} Iarr 已与 \(Q\) 配对的 I（如 \(I^{pair}\)）
 * @param {number[]} Qarr
 * @param {number} windowW 回溯砖数上限 ≥3（实际 \(k\in[0,\min(W-1,t)]\)）
 * @param {number} sigmaBricks 高斯 σ（砖）；过小会数值不稳定，内部有下界
 * @returns {{ Re: number[], Im: number[] }} 与 `Iarr` 等长
 */
function eulerMorletWeightedComplexSeries(Iarr, Qarr, windowW, sigmaBricks) {
  const n = Math.min(Iarr?.length ?? 0, Qarr?.length ?? 0)
  const Re = new Array(n).fill(0)
  const Im = new Array(n).fill(0)
  if (n < 1 || windowW < 3) return { Re, Im }
  const sig = Math.max(1e-6, Number(sigmaBricks))
  const inv2s2 = 1 / (2 * sig * sig)
  const maxK = Math.min(windowW - 1, 500)
  for (let i = 0; i < n; i++) {
    let sumW = 0
    let accR = 0
    let accI = 0
    const kMax = Math.min(maxK, i)
    for (let k = 0; k <= kMax; k++) {
      const w = Math.exp(-(k * k) * inv2s2)
      const j = i - k
      const Ii = Number(Iarr[j])
      const Qi = Number(Qarr[j])
      if (!Number.isFinite(Ii) || !Number.isFinite(Qi)) continue
      accR += w * Ii
      accI += w * Qi
      sumW += w
    }
    if (sumW > 1e-30) {
      Re[i] = accR / sumW
      Im[i] = accI / sumW
    }
  }
  return { Re, Im }
}

/** 行列式过小判定（双变量协方差阵） */
const MAHA_DET_EPS = 1e-14

/**
 * 窗内配对样本 → 方差/协方差与均值（样本分母 n−1）。点数 &lt;2 时返回退化结构，由 {@link eulerPolarPdoFromMahalanobisIQ} 退回欧氏。
 *
 * @param {number[]} pairedI
 * @param {number[]} pairedQ
 * @returns {{ vI: number, vQ: number, c: number, meanI: number, meanQ: number, n: number }}
 */
function covarianceParamsFromPairedSamples(pairedI, pairedQ) {
  const n = Math.min(pairedI?.length ?? 0, pairedQ?.length ?? 0)
  if (n < 2) {
    const i0 = Number(pairedI?.[0])
    const q0 = Number(pairedQ?.[0])
    return {
      vI: 1,
      vQ: 1,
      c: 0,
      meanI: Number.isFinite(i0) ? i0 : 0,
      meanQ: Number.isFinite(q0) ? q0 : 0,
      n,
    }
  }
  let sumI = 0
  let sumQ = 0
  for (let i = 0; i < n; i++) {
    sumI += pairedI[i]
    sumQ += pairedQ[i]
  }
  const meanI = sumI / n
  const meanQ = sumQ / n
  let ssI = 0
  let ssQ = 0
  let sp = 0
  for (let i = 0; i < n; i++) {
    const a = pairedI[i] - meanI
    const b = pairedQ[i] - meanQ
    ssI += a * a
    ssQ += b * b
    sp += a * b
  }
  const df = n - 1
  return {
    vI: Math.max(ssI / df, 1e-12),
    vQ: Math.max(ssQ / df, 1e-12),
    c: sp / df,
    meanI,
    meanQ,
    n,
  }
}

/**
 * 逐砖滚动：因果窗 \([i-W+1,i]\) 内有限 (I,Q) 子样本的协方差与均值，用于马氏能量。
 *
 * @param {number[]} Iarr
 * @param {number[]} Qarr
 * @param {number} win 砖数，≥2
 * @returns {Array<{ vI: number, vQ: number, c: number, meanI: number, meanQ: number, n: number }>}
 */
export function rollingCovarianceParamsForEulerIQ(Iarr, Qarr, win) {
  const n = Math.min(Iarr?.length ?? 0, Qarr?.length ?? 0)
  const W = Math.max(2, Math.min(500, Math.floor(Number(win)) || 2))
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - W + 1)
    const pairedI = []
    const pairedQ = []
    for (let k = start; k <= i; k++) {
      const a = Iarr[k]
      const b = Qarr[k]
      if (Number.isFinite(a) && Number.isFinite(b)) {
        pairedI.push(a)
        pairedQ.push(b)
      }
    }
    out[i] = covarianceParamsFromPairedSamples(pairedI, pairedQ)
  }
  return out
}

/**
 * 马氏距离能量 + 与 {@link eulerPolarPdoFromIQ} 相同的 θ（原始 I,Q 平面）、sin/cos（欧氏单位方向）、PDO。
 * 使用 \((I-\mu_I,\,Q-\mu_Q)^\top \Sigma^{-1} (\cdot)\) 的闭式平方根；\(\det\to0\) 时退化为对中心化分量的轴对齐加权欧氏。
 *
 * @param {number} Ii
 * @param {number} Qi
 * @param {{ vI: number, vQ: number, c: number, meanI: number, meanQ: number, n: number }} cov
 */
export function eulerPolarPdoFromMahalanobisIQ(Ii, Qi, cov) {
  if (!cov || cov.n < 2) return eulerPolarPdoFromIQ(Ii, Qi)

  const dI = Ii - cov.meanI
  const dQ = Qi - cov.meanQ
  const { vI, vQ, c } = cov
  const det = vI * vQ - c * c

  let A
  if (det <= MAHA_DET_EPS) {
    A = Math.sqrt((dI * dI) / vI + (dQ * dQ) / vQ)
  } else {
    const numer = dI * dI * vQ - 2 * dI * dQ * c + dQ * dQ * vI
    A = Math.sqrt(Math.max(0, numer / det))
  }

  const theta = Math.atan2(Qi, Ii)
  const r = Math.hypot(Ii, Qi)
  let sinTheta = 0
  let cosTheta = 0
  if (r > EULER_A_EPS) {
    sinTheta = Qi / r
    cosTheta = Ii / r
  }
  const pdo = Math.sin(theta + Math.PI / 4) - Math.sin(theta)
  return { A, theta, sinTheta, cosTheta, pdo }
}

/**
 * 欧拉共振逐砖序列：见文件头 **Beta 时钟 · 欧拉共振** 区块说明。
 *
 * @param {{ time: number, close: number }[]} mainCandles 主合约砖（与 CVD、ABO 同源时间轴）
 * @param {{ time: number, close: number }[]} benchCandles 基准砖 OHLC（用于对齐收盘）
 * @param {{ time: number, value: number }[]} cvdCumulativePts 累积 CVD，与 mainCandles 逐根对齐
 * @param {{
 *   zWindow?: number,
 *   cvdEmaPeriod?: number,
 *   zVolatilityFloorRatio?: number,
 *   zSigmaFloorAbs?: number,
 *   eulerMahaWindow?: number,
 *   mahaWindowBricks?: number,
 *   volDampenTau?: number,
 *   volDampenAtrPeriod?: number,
 *   volDampen1mRawBars?: any[],
 * }} opts `eulerMahaWindow`（或 `mahaWindowBricks`）≥2：用滚动窗内 \(\Sigma^{-1}\) 马氏模长代替 \(\sqrt{I^2+Q^2}\)。`volDampenTau`>0 且提供 1m 原始行时乘 \(W_{vol}\)
 * @returns {{ time: number, I: number, Q: number, A: number, theta: number, sinTheta: number, cosTheta: number, pdo: number, Wvol?: number, kappaVol?: number }[]}
 */
export function eulerResonanceFromBricks(mainCandles, benchCandles, cvdCumulativePts, opts = {}) {
  const n = Math.min(mainCandles?.length ?? 0, cvdCumulativePts?.length ?? 0)
  if (n < 2) return []

  const zWin = Math.max(2, Math.min(2000, Math.floor(Number(opts.zWindow)) || 100))
  const cvdEmaP = Math.max(1, Math.min(500, Math.floor(Number(opts.cvdEmaPeriod)) || 5))

  const zScoreOpts = {}
  const zfr = Number(opts.zVolatilityFloorRatio)
  if (Number.isFinite(zfr) && zfr > 0) zScoreOpts.sigmaVolatilityFloorRatio = zfr
  const zfa = Number(opts.zSigmaFloorAbs)
  if (Number.isFinite(zfa) && zfa > 0) zScoreOpts.sigmaFloorAbs = zfa

  // --- I：Z( EMA( 累积 CVD ) ) ---
  const cvdVals = new Array(n)
  for (let i = 0; i < n; i++) {
    cvdVals[i] = Number(cvdCumulativePts[i]?.value)
  }
  const emaCvd = emaNumericSeries(cvdVals, cvdEmaP)
  const I = rollingSampleZScoreSeries(emaCvd, zWin, zScoreOpts)

  // --- Q：Z( r_alt ) − Z( r_btc )，基准收盘已与主时间轴对齐 ---
  const altCloses = new Array(n)
  for (let i = 0; i < n; i++) {
    altCloses[i] = Number(mainCandles[i]?.close)
  }
  const benchAligned = alignBenchCloseToMainCandles(mainCandles, benchCandles)
  const altR = brickCloseToCloseReturns(altCloses)
  const btcR = brickCloseToCloseReturns(benchAligned)
  const zAlt = rollingSampleZScoreSeries(altR, zWin, zScoreOpts)
  const zBtc = rollingSampleZScoreSeries(btcR, zWin, zScoreOpts)
  const Q = zAlt.map((za, i) => za - zBtc[i])

  const mahaOpt = Number(opts.eulerMahaWindow ?? opts.mahaWindowBricks)
  const useMaha = Number.isFinite(mahaOpt) && mahaOpt >= 2
  const mahaWin = useMaha ? Math.max(2, Math.min(500, Math.floor(mahaOpt))) : 0
  const covSeries = useMaha ? rollingCovarianceParamsForEulerIQ(I, Q, mahaWin) : null

  const volD = eulerVolDampenerSeriesFromOpts(mainCandles, opts)
  const WvolArr = volD?.Wvol
  const kappaVolArr = volD?.kappa

  // --- A、θ、cosθ、sinθ、PDO ---
  const out = []
  for (let i = 0; i < n; i++) {
    const { A: A0, theta, sinTheta, cosTheta, pdo } = covSeries
      ? eulerPolarPdoFromMahalanobisIQ(I[i], Q[i], covSeries[i])
      : eulerPolarPdoFromIQ(I[i], Q[i])
    const Wv = WvolArr ? WvolArr[i] : 1
    const wEff = Number.isFinite(Wv) && Wv > 0 && Wv <= 1 ? Wv : 1
    const A = A0 * wEff
    const row = {
      time: mainCandles[i].time,
      I: I[i],
      Q: Q[i],
      A,
      theta,
      sinTheta,
      cosTheta,
      pdo,
    }
    if (WvolArr) {
      row.Wvol = wEff
      row.kappaVol = kappaVolArr[i]
    }
    out.push(row)
  }
  return out
}

function takerBuyQuoteBrickRow(b) {
  const v = b?.takerBuyQuoteVolume ?? b?.taker_buy_quote_volume
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function takerBuyBaseBrickRow(b) {
  const v = b?.takerBuyBaseVolume ?? b?.taker_buy_base_volume
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function brickRowMapByCandleSec(rows) {
  const m = new Map()
  if (!Array.isArray(rows)) return m
  for (const b of rows) {
    const sec = Math.floor(Number(b.t) / 1000)
    if (Number.isFinite(sec)) m.set(sec, b)
  }
  return m
}

/**
 * 与 RenkoFourPaneDashboard 同源：逐砖 ΔCVD 后累积（USDT 额 + takerQuote 优先）。
 *
 * @param {{ time: number, open: number, high: number, low: number, close: number, volume?: number }[]} candles
 * @param {Map<number, any>} rowByCandleSec `candle.time`(秒) → 原始 jbar 行
 * @returns {{ time: number, value: number }[]}
 */
export function cumulativeCvdPointsFromCandles(candles, rowByCandleSec) {
  const cvdLine = []
  let cum = 0
  if (!candles?.length) return cvdLine
  const map = rowByCandleSec instanceof Map ? rowByCandleSec : new Map()
  for (const c of candles) {
    const row = map.get(c.time)
    const vol = Number.isFinite(c.volume) ? c.volume : Number(row?.v) || 0
    const tbq = row ? takerBuyQuoteBrickRow(row) : null
    const tbb = row ? takerBuyBaseBrickRow(row) : null
    let delta
    if (tbq != null && vol > 1e-12) {
      const mismatchMsg = cvdUsdtQuoteMismatchReason(vol, tbq)
      if (mismatchMsg) {
        delta = (c.close >= c.open ? 1 : -1) * vol
      } else {
        delta = 2 * tbq - vol
      }
    } else if (tbb != null && vol > 1e-12) {
      delta = 2 * tbb - vol
    } else {
      delta = (c.close >= c.open ? 1 : -1) * vol
    }
    cum += delta
    cvdLine.push({ time: c.time, value: cum })
  }
  return cvdLine
}

/**
 * 将基准腿累积 CVD 按主砖时间前向对齐（last bench ≤ t），与 {@link alignBenchCloseToMainCandles} 同步。
 *
 * @param {{ time: number }[]} mainCandles
 * @param {{ time: number, value: number }[]} benchCumulativePts 时间升序
 * @returns {{ time: number, value: number }[]}
 */
export function alignCumulativeCvdToMainCandles(mainCandles, benchCumulativePts) {
  if (!mainCandles?.length) return []
  const sorted = [...(benchCumulativePts || [])]
    .filter((p) => p && p.time != null && Number.isFinite(Number(p.value)))
    .sort((a, b) => Number(a.time) - Number(b.time))
  let j = 0
  let lastVal = 0
  const out = []
  for (const c of mainCandles) {
    const ct = Number(c.time)
    while (j < sorted.length && Number(sorted[j].time) <= ct) {
      lastVal = Number(sorted[j].value)
      j++
    }
    out.push({ time: c.time, value: Number.isFinite(lastVal) ? lastVal : 0 })
  }
  return out
}

/**
 * 合成价差欧拉：\(Q=Z(R_{alt}-\beta R_{bench})\)，\(I=Z(\mathrm{EMA}(\sum(\Delta CVD_{alt}-\beta\Delta CVD_{bench})))\)。
 *
 * @param {{ time: number, close: number }[]} mainCandles 主腿（与基准砖钟对齐）
 * @param {{ time: number, close: number }[]} benchCandles 基准腿 OHLC
 * @param {{ time: number, value: number }[]} mainCvdPts 主腿累积 CVD，与 mainCandles 等长
 * @param {{ time: number, value: number }[]} benchCvdPts 基准累积 CVD 已按主时间对齐，与 main 等长
 * @param {{
 *   beta?: number,
 *   zWindow?: number,
 *   cvdEmaPeriod?: number,
 *   zVolatilityFloorRatio?: number,
 *   zSigmaFloorAbs?: number,
 *   iqVolBalanceWindow?: number,
 *   iqLagBricks?: number,
 *   eulerMahaWindow?: number,
 *   mahaWindowBricks?: number,
 *   volDampenTau?: number,
 *   volDampenAtrPeriod?: number,
 *   volDampen1mRawBars?: any[],
 * }} opts `beta` 默认 1；`iqLagBricks`≥1 时先用 \(I_{i-k}\) 与 \(Q_i\) 配对；`iqVolBalanceWindow`≥2 时再对 I 做 σ_Q/σ_I 缩放；马氏模长在最终 `Iplot` 与 `Q` 上算
 */
export function eulerSpreadResonanceFromBricks(mainCandles, benchCandles, mainCvdPts, benchCvdPts, opts = {}) {
  const n = Math.min(
    mainCandles?.length ?? 0,
    mainCvdPts?.length ?? 0,
    benchCvdPts?.length ?? 0
  )
  if (n < 2 || !benchCandles?.length) return []

  const beta = Number.isFinite(Number(opts.beta)) ? Number(opts.beta) : 1
  const zWin = Math.max(2, Math.min(2000, Math.floor(Number(opts.zWindow)) || 100))
  const cvdEmaP = Math.max(1, Math.min(500, Math.floor(Number(opts.cvdEmaPeriod)) || 5))

  const zScoreOpts = {}
  const zfr = Number(opts.zVolatilityFloorRatio)
  if (Number.isFinite(zfr) && zfr > 0) zScoreOpts.sigmaVolatilityFloorRatio = zfr
  const zfa = Number(opts.zSigmaFloorAbs)
  if (Number.isFinite(zfa) && zfa > 0) zScoreOpts.sigmaFloorAbs = zfa

  const altCloses = new Array(n)
  for (let i = 0; i < n; i++) altCloses[i] = Number(mainCandles[i]?.close)
  const benchAlignedFull = alignBenchCloseToMainCandles(mainCandles, benchCandles)
  const benchAligned = benchAlignedFull.slice(0, n)

  const altR = brickCloseToCloseReturns(altCloses)
  const btcR = brickCloseToCloseReturns(benchAligned)
  const rSpread = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = Number(altR[i])
    const b = Number(btcR[i])
    rSpread[i] = Number.isFinite(a) && Number.isFinite(b) ? a - beta * b : 0
  }
  const Q = rollingSampleZScoreSeries(rSpread, zWin, zScoreOpts)

  const spreadCum = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const dM = Number(mainCvdPts[i]?.value) - Number(mainCvdPts[i - 1]?.value)
    const dB = Number(benchCvdPts[i]?.value) - Number(benchCvdPts[i - 1]?.value)
    const dS = (Number.isFinite(dM) ? dM : 0) - beta * (Number.isFinite(dB) ? dB : 0)
    spreadCum[i] = spreadCum[i - 1] + dS
  }
  const emaSpread = emaNumericSeries(spreadCum, cvdEmaP)
  const I = rollingSampleZScoreSeries(emaSpread, zWin, zScoreOpts)

  const iqLagK = Number(opts?.iqLagBricks)
  const IafterLag =
    Number.isFinite(iqLagK) && iqLagK >= 1 ? applyEulerILagBricks(I, iqLagK) : I

  const iqBalW = Number(opts?.iqVolBalanceWindow)
  const Iplot =
    Number.isFinite(iqBalW) && iqBalW >= 2
      ? balanceIqVolatilityForEulerDisplay(IafterLag, Q, iqBalW)
      : IafterLag

  const mahaOpt = Number(opts.eulerMahaWindow ?? opts.mahaWindowBricks)
  const useMaha = Number.isFinite(mahaOpt) && mahaOpt >= 2
  const mahaWin = useMaha ? Math.max(2, Math.min(500, Math.floor(mahaOpt))) : 0
  const covSeries = useMaha ? rollingCovarianceParamsForEulerIQ(Iplot, Q, mahaWin) : null

  const volD = eulerVolDampenerSeriesFromOpts(mainCandles, opts)
  const WvolArr = volD?.Wvol
  const kappaVolArr = volD?.kappa

  const out = []
  for (let i = 0; i < n; i++) {
    const { A: A0, theta, sinTheta, cosTheta, pdo } = covSeries
      ? eulerPolarPdoFromMahalanobisIQ(Iplot[i], Q[i], covSeries[i])
      : eulerPolarPdoFromIQ(Iplot[i], Q[i])
    const Wv = WvolArr ? WvolArr[i] : 1
    const wEff = Number.isFinite(Wv) && Wv > 0 && Wv <= 1 ? Wv : 1
    const A = A0 * wEff
    const row = {
      time: mainCandles[i].time,
      I: Iplot[i],
      Q: Q[i],
      A,
      theta,
      sinTheta,
      cosTheta,
      pdo,
    }
    if (WvolArr) {
      row.Wvol = wEff
      row.kappaVol = kappaVolArr[i]
    }
    out.push(row)
  }
  return out
}

/**
 * 由主/基准 jbar 行（与四维盘同源对齐）直接得到合成价差欧拉序列。
 *
 * @param {any[]} mainRowsOnBenchClock 主腿已按基准砖钟对齐
 * @param {any[]} benchRows 基准腿 jbar
 * @param {{
 *   beta?: number,
 *   zWindow?: number,
 *   cvdEmaPeriod?: number,
 *   zVolatilityFloorRatio?: number,
 *   zSigmaFloorAbs?: number,
 *   iqVolBalanceWindow?: number,
 *   iqLagBricks?: number,
 *   eulerMahaWindow?: number,
 *   mahaWindowBricks?: number,
 *   volDampenTau?: number,
 *   volDampenAtrPeriod?: number,
 *   volDampen1mRawBars?: any[],
 * }} opts
 */
export function eulerSpreadResonanceFromAlignedBrickRows(mainRows, benchRows, opts = {}) {
  const candles = toCandles(Array.isArray(mainRows) ? mainRows : [])
  const benchCandles = toCandles(Array.isArray(benchRows) ? benchRows : [])
  if (candles.length < 2 || benchCandles.length < 1) return []
  const mainMap = brickRowMapByCandleSec(mainRows)
  const benchMap = brickRowMapByCandleSec(benchRows)
  const mainCvd = cumulativeCvdPointsFromCandles(candles, mainMap)
  const benchCvdFull = cumulativeCvdPointsFromCandles(benchCandles, benchMap)
  const benchCvdAligned = alignCumulativeCvdToMainCandles(candles, benchCvdFull)
  return eulerSpreadResonanceFromBricks(candles, benchCandles, mainCvd, benchCvdAligned, opts)
}

/**
 * Vision `*_5m_metrics.jbar` 行 → 按秒排序；`o`=sum_open_interest，`l`=count_toptrader_long_short_ratio。
 * @param {any[]} metricsRows
 * @returns {{ sec: number, oi: number, topLsRatio: number }[]}
 */
function metricsOiSortedFromRows(metricsRows) {
  const arr = []
  for (const b of metricsRows || []) {
    const sec = Math.floor(Number(b.t) / 1000)
    if (!Number.isFinite(sec)) continue
    const oi = Number(b.o)
    const topLsRatio = Number(b.l)
    arr.push({
      sec,
      oi: Number.isFinite(oi) ? oi : NaN,
      topLsRatio: Number.isFinite(topLsRatio) ? topLsRatio : NaN,
    })
  }
  arr.sort((a, b) => a.sec - b.sec)
  return arr
}

function lastMetricsIndexLeq(sorted, tSec) {
  let lo = 0
  let hi = sorted.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].sec <= tSec) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/**
 * 砖序列上的经典 TR（首根退化为 H−L），供三维相空间 Z 轴「环境波动」选项。
 *
 * @param {{ high?: number, low?: number, close?: number }[]} candles
 * @param {number} n
 * @returns {number[]}
 */
function brickTrueRangeArray(candles, n) {
  const tr = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    const h = Number(candles[i]?.high)
    const l = Number(candles[i]?.low)
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue
    if (i === 0) {
      tr[i] = h - l
      continue
    }
    const pc = Number(candles[i - 1]?.close)
    if (Number.isFinite(pc)) {
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
    } else {
      tr[i] = h - l
    }
  }
  return tr
}

/** 单路置信乘子下界（非 [0,1] 概率；工程上的奖励/惩罚权重） */
const CONF_MULT_LO = 0.5
/** 单路置信乘子上界（tanh 映射用 0.5 系数才能触达该上下界） */
const CONF_MULT_HI = 1.5
/** 大户 × 趋势 乘性融合后的上界（共振时可 >1.5） */
const CONF_MULT_FUSED_HI = 2

function pBayesFromTopLsRatio(ratio) {
  if (!Number.isFinite(ratio)) return 1
  return Math.max(CONF_MULT_LO, Math.min(CONF_MULT_HI, 1 + 0.5 * Math.tanh(ratio - 1)))
}

/**
 * 大级别趋势：**启发式**置信乘子（非严格贝叶斯后验）。\(H\) 根砖 event-time 上的 \(\ln(c_t/c_{t-H})\) 经 \(\tanh\) 平滑后映射到 \([0.5,1.5]\)；系数取 **0.5** 才能使 \(\tanh\to\pm1\) 时触达 clip 边界（0.25 时实际只能到 \([0.75,1.25]\)）。
 *
 * @param {number[]} closes 与砖对齐的收盘价序列（常用基准腿或主腿收盘）
 * @param {number} i 当前下标
 * @param {number} H 滞后砖数 ≥1
 * @returns {number} 无效时为 `NaN`
 */
function pBayesFromHtfBrickLogReturn(closes, i, H) {
  if (!Array.isArray(closes) || H < 1 || i < H) return NaN
  const c0 = Number(closes[i - H])
  const c1 = Number(closes[i])
  if (!(c0 > 0 && c1 > 0)) return NaN
  const lr = Math.log(c1 / c0)
  return Math.max(CONF_MULT_LO, Math.min(CONF_MULT_HI, 1 + 0.5 * Math.tanh(lr * 6)))
}

/**
 * **单边欧拉 + OI 加权 + 置信乘子（沿用「贝叶斯」叫法）+ CVD 相位滞后**（研究页）：砖由 1m 聚合，metrics 仅 5m，按砖收时刻取「最后一条 metrics≤砖时」的持仓与增量。
 *
 * **第四维（工程语义）**：并非严格贝叶斯后验 \(P(A\mid B)\in[0,1]\)，而是 **\(\tanh\) 启发式置信乘子**（借鉴先验更新叙事）。未启用 Morlet/马氏时 \(A_{geom}=\sqrt{(I^{pair})^2+Q^2}\)；\(P_{whale},P_{trend}\in[0.5,1.5]\) 各自由大户比与 \(H\) 砖对数收益映射（系数 **0.5** 与 \(\tanh\) 配合才能用满单路区间）。若启用趋势且 \(P_{trend}\) 有效，**乘性融合** \(P_{bayes}=\mathrm{clip}(P_{whale}\cdot P_{trend},\,0.5,\,2)\)；否则 \(P_{bayes}=P_{whale}\)。**\(A_{final}=A_{geom}\cdot P_{bayes}\cdot W_{vol}\)**（可选 1m 阻尼），输出 **`A`** = \(A_{final}\)。
 *
 * **三维螺旋相空间（可选）**：`eulerPhaseSpaceZ`∈\{1,2,3\} 时引入与环境对齐的 **\(Z\)**（与 \(I,Q\) 同窗滚动样本 Z-score），\(\vec V=(I^{pair},Q,Z)\) 的工程范数 **\(A_{geom}=\sqrt{A_{xy}^2+Z^2}\)**，其中 \(A_{xy}\) 为上述二维（Morlet/马氏/欧氏）能量；\(\theta,\mathrm{PDO}\) 仍在 **\(I\!-\!Q\)** 平面内（\(Z\) 只抬升/压低总能量，用于区分「XY 大圆但 Z 不起」与「螺旋共振」）。1=metrics **OI 水位**；2=相邻 5m 样本 **ΔOI**；3=砖 **TR**（经典真实波幅）。
 *
 * - \(Q=Z(\)主砖收盘到收盘收益\()\)
 * - \(I_{raw}=Z(\mathrm{EMA}(\mathrm{cum\,}\Delta CVD))\)（与 {@link eulerResonanceFromBricks} 的 I 同形，但不减基准）
 * - \(\Delta OI\)：相邻 5m metrics 的 `o` 差；\(W_{oi}=1\) 若 \(\Delta OI>0\) 或首条/无覆盖，否则 \(0.3\)
 * - \(I_{eff,t}=I_{raw,t}\cdot W_{oi,t}\)；可选 **CVD 时差**：\(I^{pair}_t = I_{eff,t-k}\)（{@link applyEulerILagBricks}，\(k\) 为砖数；「量在价先」时用过去推力对当前 \(Q_t\)）
 * - **\(A_{geom}\) 与相角**：`eulerMorletWindow`≥3 时二者均来自高斯窗局部复向量 \(\tilde Z_t\)（见 {@link eulerMorletWeightedComplexSeries}）；否则 `eulerMahaWindow`≥2 时 \(A_{geom}\) 为马氏距离、\(\theta=\mathrm{atan2}(Q_t,I^{pair}_t)\)；否则欧氏模与 \(\theta=\mathrm{atan2}(Q_t,I^{pair}_t)\)
 * - \(H\) 为 **event-time**（砖数），非墙钟分钟；\(\ln(c_t/c_{t-H})\) 回溯的是等量波动路径上的动量
 *
 * @param {{ time: number, close?: number }[]} mainCandles `toCandles(主砖行)`，秒
 * @param {{ time: number, value: number }[]} cvdCumulativePts 主腿累积 CVD，与 main 等长
 * @param {any[]} metricsRows Vision `{SYMBOL}_5m_metrics` jbar 行（与砖时段重叠）
 * @param {{
 *   zWindow?: number,
 *   cvdEmaPeriod?: number,
 *   zVolatilityFloorRatio?: number,
 *   zSigmaFloorAbs?: number,
 *   cvdPhaseLagBricks?: number,
 *   iqLagBricks?: number,
 *   bayesHtfLagBricks?: number,
 *   bayesHtfCloseSeries?: number[],
 *   eulerMahaWindow?: number,
 *   mahaWindowBricks?: number,
 *   volDampenTau?: number,
 *   volDampenAtrPeriod?: number,
 *   volDampen1mRawBars?: any[],
 *   eulerMorletWindow?: number,
 *   eulerMorletSigma?: number,
 *   eulerPhaseSpaceZ?: number,
 * }} [opts] `cvdPhaseLagBricks` 与 `iqLagBricks` 等价，≥1 时对 \(I_{eff}\) 滞后 \(k\) 砖再与 \(Q_t\) 配对。`bayesHtfLagBricks`≥1 时启用趋势先验；`bayesHtfCloseSeries` 缺省或长度不足时用主砖收盘作趋势序列（跨品种时建议在调用侧传入基准收盘）。**`eulerMorletWindow`≥3** 时 Morlet 窗覆盖马氏与欧氏 \(A_{geom}\)。`eulerMahaWindow`≥2：仅在未启用 Morlet 时在 \((I^{pair},Q)\) 上算马氏 \(A_{geom}\)。**`eulerPhaseSpaceZ`**∈\{1,2,3\}：三维相空间 \(A_{geom}=\sqrt{A_{xy}^2+Z^2}\)。`volDampenTau`>0 且 `volDampen1mRawBars` 为 1m jbar 行时启用 \(W_{vol}\)
 * @returns {Array<{ time: number, I: number, IEff: number, IRaw: number, Q: number, A: number, Ageom: number, theta: number, sinTheta: number, cosTheta: number, pdo: number, Woi: number, PBayes: number, PBayesWhale: number, PBayesTrend: number, Wvol?: number, kappaVol?: number, cvdPhaseLagBricks: number, bayesHtfLagBricks: number, eulerMorletWindow?: number, eulerMorletSigma?: number, AgeomXY?: number, phaseZ?: number, eulerPhaseSpaceZ?: number }>}
 */
export function eulerResonanceSingleLegOiWeighted(mainCandles, cvdCumulativePts, metricsRows, opts = {}) {
  const n = Math.min(mainCandles?.length ?? 0, cvdCumulativePts?.length ?? 0)
  if (n < 2) return []

  const zWin = Math.max(2, Math.min(2000, Math.floor(Number(opts.zWindow)) || 100))
  const cvdEmaP = Math.max(1, Math.min(500, Math.floor(Number(opts.cvdEmaPeriod)) || 5))
  const zScoreOpts = {}
  const zfr = Number(opts.zVolatilityFloorRatio)
  if (Number.isFinite(zfr) && zfr > 0) zScoreOpts.sigmaVolatilityFloorRatio = zfr
  const zfa = Number(opts.zSigmaFloorAbs)
  if (Number.isFinite(zfa) && zfa > 0) zScoreOpts.sigmaFloorAbs = zfa

  const lagOpt = Number(opts.cvdPhaseLagBricks ?? opts.iqLagBricks)
  const lagK =
    Number.isFinite(lagOpt) && lagOpt >= 1 ? Math.max(1, Math.min(500, Math.floor(lagOpt))) : 0

  const htfLagOpt = Number(opts.bayesHtfLagBricks)
  const htfH =
    Number.isFinite(htfLagOpt) && htfLagOpt >= 1 ? Math.max(1, Math.min(500, Math.floor(htfLagOpt))) : 0
  const htfSeriesRaw = opts.bayesHtfCloseSeries
  const htfCloses =
    htfH >= 1 && Array.isArray(htfSeriesRaw) && htfSeriesRaw.length >= n ? htfSeriesRaw : null

  const altCloses = new Array(n)
  for (let i = 0; i < n; i++) altCloses[i] = Number(mainCandles[i]?.close)
  const altR = brickCloseToCloseReturns(altCloses)
  const Q = rollingSampleZScoreSeries(altR, zWin, zScoreOpts)

  const cvdVals = new Array(n)
  for (let i = 0; i < n; i++) cvdVals[i] = Number(cvdCumulativePts[i]?.value)
  const emaCvd = emaNumericSeries(cvdVals, cvdEmaP)
  const Iraw = rollingSampleZScoreSeries(emaCvd, zWin, zScoreOpts)

  const mSorted = metricsOiSortedFromRows(metricsRows)
  const IeffArr = new Array(n)
  const WoiArr = new Array(n)
  const PBayesWhaleArr = new Array(n)
  const oiLevelRaw = new Array(n).fill(NaN)
  const dOiRaw = new Array(n).fill(NaN)
  const trendCloses = htfH >= 1 ? (htfCloses ?? altCloses) : null
  for (let i = 0; i < n; i++) {
    const tSec = Number(mainCandles[i]?.time)
    let Woi = 1
    let Pw = 1
    if (mSorted.length) {
      const idx = lastMetricsIndexLeq(mSorted, tSec)
      if (idx >= 0) {
        const oiLv = mSorted[idx].oi
        oiLevelRaw[i] = oiLv
        if (idx === 0) {
          Woi = 1
          dOiRaw[i] = 0
        } else {
          const dOi = mSorted[idx].oi - mSorted[idx - 1].oi
          dOiRaw[i] = Number.isFinite(oiLv) && Number.isFinite(mSorted[idx - 1].oi) ? dOi : NaN
          Woi = Number.isFinite(dOi) && dOi > 0 ? 1 : 0.3
        }
        Pw = pBayesFromTopLsRatio(mSorted[idx].topLsRatio)
      }
    }
    WoiArr[i] = Woi
    PBayesWhaleArr[i] = Pw
    IeffArr[i] = Iraw[i] * Woi
  }

  const PBayesArr = new Array(n)
  const PBayesTrendArr = new Array(n)
  for (let i = 0; i < n; i++) {
    const Pw = PBayesWhaleArr[i]
    let Pt = NaN
    if (htfH >= 1 && trendCloses) {
      Pt = pBayesFromHtfBrickLogReturn(trendCloses, i, htfH)
    }
    let Pb = Pw
    if (htfH >= 1 && Number.isFinite(Pt)) {
      Pb = Math.max(CONF_MULT_LO, Math.min(CONF_MULT_FUSED_HI, Pw * Pt))
    }
    PBayesArr[i] = Pb
    PBayesTrendArr[i] = Pt
  }

  const Ipair = lagK >= 1 ? applyEulerILagBricks(IeffArr, lagK) : IeffArr

  const psOpt = Number(opts.eulerPhaseSpaceZ ?? opts.eulerPhaseSpaceMode)
  const phaseMode =
    Number.isFinite(psOpt) && psOpt >= 1 && psOpt <= 3 ? Math.floor(psOpt) : 0
  let ZphaseArr = null
  if (phaseMode === 1) {
    ZphaseArr = rollingSampleZScoreSeries(oiLevelRaw, zWin, zScoreOpts)
  } else if (phaseMode === 2) {
    ZphaseArr = rollingSampleZScoreSeries(dOiRaw, zWin, zScoreOpts)
  } else if (phaseMode === 3) {
    const trArr = brickTrueRangeArray(mainCandles, n)
    ZphaseArr = rollingSampleZScoreSeries(trArr, zWin, zScoreOpts)
  }

  const morletWopt = Number(opts.eulerMorletWindow)
  const useMorlet = Number.isFinite(morletWopt) && morletWopt >= 3
  const morletWin = useMorlet ? Math.max(3, Math.min(500, Math.floor(morletWopt))) : 0
  const morletSigOpt = Number(opts.eulerMorletSigma)
  const morletSigma = useMorlet
    ? Math.max(0.25, Math.min(50, Number.isFinite(morletSigOpt) ? morletSigOpt : 2))
    : 0
  const morletZ = useMorlet ? eulerMorletWeightedComplexSeries(Ipair, Q, morletWin, morletSigma) : null

  const mahaOpt = Number(opts.eulerMahaWindow ?? opts.mahaWindowBricks)
  const useMaha = !useMorlet && Number.isFinite(mahaOpt) && mahaOpt >= 2
  const mahaWin = useMaha ? Math.max(2, Math.min(500, Math.floor(mahaOpt))) : 0
  const covSeries = useMaha ? rollingCovarianceParamsForEulerIQ(Ipair, Q, mahaWin) : null

  const volD = eulerVolDampenerSeriesFromOpts(mainCandles, opts)
  const WvolArr = volD?.Wvol
  const kappaVolArr = volD?.kappa

  const out = []
  for (let i = 0; i < n; i++) {
    let polar
    if (morletZ) {
      polar = eulerPolarPdoFromIQ(morletZ.Re[i], morletZ.Im[i])
    } else if (covSeries) {
      polar = eulerPolarPdoFromMahalanobisIQ(Ipair[i], Q[i], covSeries[i])
    } else {
      polar = eulerPolarPdoFromIQ(Ipair[i], Q[i])
    }
    const { A: AgeomXY2d, theta, sinTheta, cosTheta, pdo } = polar
    let Ageom = AgeomXY2d
    let phaseZVal = NaN
    if (phaseMode >= 1 && ZphaseArr) {
      phaseZVal = ZphaseArr[i]
      const zu = Number.isFinite(phaseZVal) ? phaseZVal : 0
      Ageom = Math.hypot(AgeomXY2d, zu)
    }
    const PBayes = PBayesArr[i]
    const Wv = WvolArr ? WvolArr[i] : 1
    const wEff = Number.isFinite(Wv) && Wv > 0 && Wv <= 1 ? Wv : 1
    const A = Ageom * PBayes * wEff
    const row = {
      time: mainCandles[i].time,
      I: Ipair[i],
      IEff: IeffArr[i],
      IRaw: Iraw[i],
      Q: Q[i],
      A,
      Ageom,
      theta,
      sinTheta,
      cosTheta,
      pdo,
      Woi: WoiArr[i],
      PBayes,
      PBayesWhale: PBayesWhaleArr[i],
      PBayesTrend: PBayesTrendArr[i],
      cvdPhaseLagBricks: lagK,
      bayesHtfLagBricks: htfH,
    }
    if (phaseMode >= 1) {
      row.AgeomXY = AgeomXY2d
      row.phaseZ = phaseZVal
      row.eulerPhaseSpaceZ = phaseMode
    }
    if (useMorlet) {
      row.eulerMorletWindow = morletWin
      row.eulerMorletSigma = morletSigma
    }
    if (WvolArr) {
      row.Wvol = wEff
      row.kappaVol = kappaVolArr[i]
    }
    out.push(row)
  }
  return out
}

/**
 * \(\theta_t-\theta_{t-1}\) 卷绕到 \((-\pi,\pi]\)，避免跨越 \(\pm\pi\) 时 \(\Delta\theta\) 出现虚假 \(2\pi\) 跳变。
 *
 * @param {number} thetaPrev 弧度
 * @param {number} thetaCur 弧度
 * @returns {number} 弧度
 */
export function wrappedThetaDelta(thetaPrev, thetaCur) {
  let d = thetaCur - thetaPrev
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * 在 {@link eulerResonanceFromBricks} 输出上附加 `dTheta`（砖间角速度，弧度/砖；首点 0）。
 *
 * @param {{ theta: number }[]} points
 * @returns {Array<{ theta: number, dTheta: number } & Record<string, unknown>>}
 */
export function eulerEnrichWithDeltaTheta(points) {
  if (!Array.isArray(points) || !points.length) return []
  return points.map((p, i) => ({
    ...p,
    dTheta: i === 0 ? 0 : wrappedThetaDelta(points[i - 1].theta, p.theta),
  }))
}

// =============================================================================
// ◆ 螺旋 (Spiral) 升级 —— 复频域 (Complex Frequency) 指标
// z(t) = A₀ · e^{(σ + iω)t}
// σ = d ln(A) / dt — 能量模长的指数增长/衰减率（单位: /砖）
// ω = dθ / dt      — 角速度（wrap 到 (−π,π]，单位: rad/砖）
// 螺旋相态：σ>+δ → 发散螺旋 (expanding), σ<−δ → 收敛螺旋 (contracting),
//           |σ|≤δ → 极限环 (limit cycle)
// =============================================================================

/**
 * 螺旋相态分类
 * @param {number} sigma
 * @param {number} threshold 判定 σ 近似零的门槛（默认 0.05）
 * @returns {'expanding'|'contracting'|'limit_cycle'}
 */
export function classifySpiralPhase(sigma, threshold = 0.05) {
  if (!Number.isFinite(sigma)) return 'limit_cycle'
  if (sigma > threshold) return 'expanding'
  if (sigma < -threshold) return 'contracting'
  return 'limit_cycle'
}

/**
 * 螺旋相态 → 中文标签
 * @param {'expanding'|'contracting'|'limit_cycle'} phase
 * @returns {string}
 */
export function spiralPhaseLabelZh(phase) {
  if (phase === 'expanding') return '发散螺旋 ↗'
  if (phase === 'contracting') return '收敛螺旋 ↘'
  return '极限环 ⟳'
}

/**
 * 螺旋相态 → 显示颜色（dark / light 由调用方选择）
 * @param {'expanding'|'contracting'|'limit_cycle'} phase
 * @param {boolean} isDark
 * @returns {string}
 */
export function spiralPhaseColor(phase, isDark) {
  if (phase === 'expanding') return isDark ? '#4ade80' : '#16a34a'
  if (phase === 'contracting') return isDark ? '#f87171' : '#dc2626'
  return isDark ? '#facc15' : '#ca8a04'
}

/**
 * 标准 EMA（指数移动平均）。
 * @param {Float64Array|number[]} data
 * @param {number} period
 * @returns {Float64Array}
 */
function _emaF64(data, period) {
  const n = data.length
  const out = new Float64Array(n)
  const alpha = 2 / (period + 1)
  out[0] = data[0]
  for (let i = 1; i < n; i++) {
    out[i] = alpha * data[i] + (1 - alpha) * out[i - 1]
  }
  return out
}

/**
 * ZLEMA（Zero-Lag EMA）— 通过动量误差补偿消除滞后。
 * ZLEMA_i = EMA( data_i + (data_i − data_{i−lag}) )，lag = floor((P−1)/2)
 * @param {Float64Array|number[]} data
 * @param {number} period
 * @returns {Float64Array}
 */
function _zlemaF64(data, period) {
  const n = data.length
  const lag = Math.floor((period - 1) / 2)
  const compensated = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const lagged = i >= lag ? data[i - lag] : data[0]
    compensated[i] = data[i] + (data[i] - lagged)
  }
  return _emaF64(compensated, period)
}

/**
 * WMA（加权移动平均）：权重 1,2,...,P。
 * @param {Float64Array|number[]} data
 * @param {number} period
 * @returns {Float64Array}
 */
function _wmaF64(data, period) {
  const n = data.length
  const out = new Float64Array(n)
  const denom = (period * (period + 1)) / 2
  for (let i = 0; i < n; i++) {
    if (i < period - 1) {
      const usable = i + 1
      let s = 0, d = 0
      for (let j = 0; j < usable; j++) {
        const w = j + 1
        s += data[i - usable + 1 + j] * w
        d += w
      }
      out[i] = s / d
    } else {
      let s = 0
      for (let j = 0; j < period; j++) {
        s += data[i - period + 1 + j] * (j + 1)
      }
      out[i] = s / denom
    }
  }
  return out
}

/**
 * HMA（Hull Moving Average）— 用 WMA 差分 + 短窗 WMA 进一步削减滞后。
 * HMA = WMA( 2×WMA(data, P/2) − WMA(data, P), sqrt(P) )
 * @param {Float64Array|number[]} data
 * @param {number} period
 * @returns {Float64Array}
 */
function _hmaF64(data, period) {
  const half = Math.max(1, Math.floor(period / 2))
  const sqrtP = Math.max(1, Math.round(Math.sqrt(period)))
  const wmaHalf = _wmaF64(data, half)
  const wmaFull = _wmaF64(data, period)
  const n = data.length
  const diff = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    diff[i] = 2 * wmaHalf[i] - wmaFull[i]
  }
  return _wmaF64(diff, sqrtP)
}

/**
 * 对序列做平滑：支持 'ema' / 'zlema' / 'hma' 三种模式。
 * @param {Float64Array} raw
 * @param {number} period ≥2 才启用
 * @param {'ema'|'zlema'|'hma'} mode
 * @returns {Float64Array}
 */
function _smoothSigma(raw, period, mode) {
  if (period < 2) return raw
  if (mode === 'hma') return _hmaF64(raw, period)
  if (mode === 'zlema') return _zlemaF64(raw, period)
  return _emaF64(raw, period)
}

/** 平滑模式 → 图表标题简称 */
export function sigmaSmoothModeLabel(mode) {
  if (mode === 'zlema') return 'ZLEMA'
  if (mode === 'hma') return 'HMA'
  return 'EMA'
}

/**
 * 从欧拉序列计算螺旋指标 σ、ω，并附加到每个点上。
 *
 * σ_raw = ln(A_t) − ln(A_{t-1})，对 A≤ε 截断为 0。
 * 平滑模式可选 EMA（标准）、ZLEMA（零延迟）、HMA（赫尔）。
 *
 * @param {{ A: number, theta: number, time?: number }[]} points
 * @param {{ sigmaSmooth?: number, sigmaThreshold?: number, sigmaSmoothMode?: 'ema'|'zlema'|'hma' }} [opts]
 * @returns {Array<{ sigma: number, sigmaSmoothed: number, omega: number,
 *   spiralPhase: 'expanding'|'contracting'|'limit_cycle',
 *   dTheta: number } & Record<string, unknown>>}
 */
export function eulerSpiralEnrich(points, opts = {}) {
  if (!Array.isArray(points) || !points.length) return []
  const n = points.length
  const EPS_A = 1e-9
  const sigmaSmooth = Math.max(0, Math.floor(Number(opts.sigmaSmooth) || 5))
  const sigmaTh = Number.isFinite(Number(opts.sigmaThreshold)) ? Math.abs(Number(opts.sigmaThreshold)) : 0.05
  const mode = ['ema', 'zlema', 'hma'].includes(opts.sigmaSmoothMode) ? opts.sigmaSmoothMode : 'zlema'

  const sigmaRaw = new Float64Array(n)
  const omegaRaw = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      sigmaRaw[0] = 0
      omegaRaw[0] = 0
      continue
    }
    const Aprev = Number(points[i - 1]?.A)
    const Acur = Number(points[i]?.A)
    if (Aprev > EPS_A && Acur > EPS_A) {
      sigmaRaw[i] = Math.log(Acur) - Math.log(Aprev)
    } else {
      sigmaRaw[i] = 0
    }
    omegaRaw[i] = wrappedThetaDelta(
      Number(points[i - 1]?.theta) || 0,
      Number(points[i]?.theta) || 0
    )
  }

  const sigmaSmoothed = _smoothSigma(sigmaRaw, sigmaSmooth, mode)

  return points.map((p, i) => {
    const s = sigmaSmoothed[i]
    return {
      ...p,
      sigma: sigmaRaw[i],
      sigmaSmoothed: s,
      omega: omegaRaw[i],
      dTheta: omegaRaw[i],
      spiralPhase: classifySpiralPhase(s, sigmaTh),
    }
  })
}

/** 变色龙象限短标签（中文），供 UI */
export function eulerChameleonQuadrantLabelZh(q) {
  const v = Math.floor(Number(q))
  if (v === 1) return '1 绿 (+I,+Q)'
  if (v === 2) return '2 紫 (−I,+Q)'
  if (v === 3) return '3 红 (−I,−Q)'
  if (v === 4) return '4 黄 (+I,−Q)'
  if (v === 0) return '0 轴近'
  return '—'
}

/**
 * 与 {@link buildEulerChameleonCandles} 单砖一致：静风灰→0；否则几何或 `paintQuadrants[i]`→1..4。
 *
 * @param {{ I?: number, Q?: number, A?: number }} ep
 * @param {number} index
 * @param {{ minAForColor?: number, paintQuadrants?: number[] }} [opts]
 * @returns {0|1|2|3|4}
 */
export function effectiveEulerChameleonQuadrantAt(ep, index, opts = {}) {
  if (!ep || typeof ep !== 'object') return 0
  const minATh = Number(opts.minAForColor)
  const useEnergySilence = Number.isFinite(minATh) && minATh > 0
  const A = Number.isFinite(ep.A) ? Number(ep.A) : Math.hypot(Number(ep.I) || 0, Number(ep.Q) || 0)
  if (useEnergySilence && (!Number.isFinite(A) || A < minATh)) return 0
  let q = classifyEulerQuadrant(ep.I, ep.Q)
  const paintQArr = opts.paintQuadrants
  if (Array.isArray(paintQArr) && index >= 0 && index < paintQArr.length) {
    const pq = Math.floor(Number(paintQArr[index]))
    q = pq >= 0 && pq <= 4 ? pq : 0
  }
  return q
}

/**
 * 欧拉 (I,Q) 所在象限：1=(+I,+Q)，2=(−I,+Q)，3=(−I,−Q)，4=(+I,−Q)；近轴为 0。
 *
 * @param {number} I
 * @param {number} Q
 * @param {number} [eps=1e-9]
 * @returns {0|1|2|3|4}
 */
export function classifyEulerQuadrant(I, Q, eps = 1e-9) {
  const ip = I > eps ? 1 : I < -eps ? -1 : 0
  const qp = Q > eps ? 1 : Q < -eps ? -1 : 0
  if (ip > 0 && qp > 0) return 1
  if (ip < 0 && qp < 0) return 3
  if (ip > 0 && qp < 0) return 4
  if (ip < 0 && qp > 0) return 2
  return 0
}

/**
 * 对单边欧拉序列仅 **平滑 I 轨**（资金/推力 Z），**Q 轨保持当砖真实值**（主腿收益 Z），避免 EMA 跨零轴滞后导致「砖在涨、象限却判跌」的相位撕裂；并重算 A、θ、PDO 等与 {@link eulerResonanceSingleLegOiWeighted} 一致的能量合成（保留各砖 P<sub>bayes</sub>、W<sub>vol</sub>、phaseZ 等乘子）。
 *
 * @param {object[]} eulerPts {@link eulerResonanceSingleLegOiWeighted} 输出
 * @param {number} emaPeriod ≥2 启用；&lt;2 则原样浅拷贝返回
 * @returns {object[]}
 */
export function applyEulerIQEmaSmoothing(eulerPts, emaPeriod) {
  if (!Array.isArray(eulerPts) || eulerPts.length === 0) return []
  const P = Math.floor(Number(emaPeriod))
  if (!Number.isFinite(P) || P < 2) return eulerPts.map((r) => ({ ...r }))
  const n = eulerPts.length
  const Iarr = eulerPts.map((e) => Number(e?.I))
  const emaI = emaNumericSeries(Iarr, P)
  const out = []
  for (let i = 0; i < n; i++) {
    const base = eulerPts[i]
    const smI = emaI[i]
    const rawQ = Number(base?.Q)
    const qUse = Number.isFinite(rawQ) ? rawQ : 0
    const AgeomXY2d = Math.hypot(smI, qUse)
    const theta = Math.atan2(qUse, smI)
    let sinTheta = 0
    let cosTheta = 0
    if (AgeomXY2d > EULER_A_EPS) {
      sinTheta = qUse / AgeomXY2d
      cosTheta = smI / AgeomXY2d
    }
    const pdo = Math.sin(theta + Math.PI / 4) - Math.sin(theta)
    let ageom = AgeomXY2d
    const pz = Number(base?.phaseZ)
    if (Number.isFinite(pz)) {
      ageom = Math.hypot(AgeomXY2d, pz)
    }
    const PBayes = Number.isFinite(Number(base?.PBayes)) ? Number(base.PBayes) : 1
    const Wv = Number.isFinite(Number(base?.Wvol)) ? Number(base.Wvol) : 1
    const wEff = Number.isFinite(Wv) && Wv > 0 && Wv <= 1 ? Wv : 1
    const A = ageom * PBayes * wEff
    out.push({
      ...base,
      I: smI,
      Q: qUse,
      A,
      Ageom: ageom,
      theta,
      sinTheta,
      cosTheta,
      pdo,
    })
  }
  return out
}

/**
 * **施密特触发器**：进入有色象限需 **A ≥ aEnter**，维持则需 **A ≥ aHold** 且不与对向象限（1↔3、2↔4）同现；否则退回未锁定灰（0）。非对向的瞬时 raw 跳变（如绿↔黄）**不**解锁，用于抑制「绿—黄—绿」碎抖。
 * **价格反转熔断**（与 aHold 无关）：锁红(3)时若当砖 **Q&gt;0**（收益 Z 已为正），强制采用当前 `classify(I,Q)`；锁绿(1)时 **Q&lt;0** 同理。
 * **I 轨换边熔断**（须 **A≥aHold** 视为高能）：锁绿(1)时若 raw 已为 **紫(2)**（价仍强但 I 侧巨量偏空），打断绿锁；锁红(3)时若 raw 已为 **黄(4)**（价仍弱但 I 侧翻多），打断红锁。须与静风阈（A&lt;minA）配合。
 *
 * @param {object[]} eulerPts 已平滑或与主图一致的 I,Q、A
 * @param {{ minAForColor?: number, aEnter?: number, aHold?: number }} opts
 * @returns {number[]} 每砖「展示象限」0～4（0=未锁定灰，非能量静风）
 */
export function computeEulerSchmittPaintQuadrants(eulerPts, opts = {}) {
  const n = eulerPts?.length ?? 0
  if (!n) return []
  const minA = Number(opts.minAForColor)
  const useSilence = Number.isFinite(minA) && minA > 0
  const ae = Number(opts.aEnter)
  const ah = Number(opts.aHold)
  const aEnter = Number.isFinite(ae) && ae > 0 ? ae : 1.8
  const aHold = Number.isFinite(ah) && ah > 0 ? ah : 0.8

  /** @param {number} a @param {number} b */
  function opposite(a, b) {
    return (a === 1 && b === 3) || (a === 3 && b === 1) || (a === 2 && b === 4) || (a === 4 && b === 2)
  }

  const out = new Array(n).fill(0)
  let last = 0
  for (let i = 0; i < n; i++) {
    const ep = eulerPts[i]
    const A = Number.isFinite(ep?.A) ? Number(ep.A) : Math.hypot(Number(ep?.I) || 0, Number(ep?.Q) || 0)
    const Ival = Number(ep?.I) || 0
    const Qnum = Number(ep?.Q)
    const qPrice = Number.isFinite(Qnum) ? Qnum : 0
    const qCls = classifyEulerQuadrant(Ival, qPrice)

    if (useSilence && (!Number.isFinite(A) || A < minA)) {
      out[i] = 0
      last = 0
      continue
    }

    if (last === 0) {
      if (qCls >= 1 && qCls <= 4 && A >= aEnter) {
        last = qCls
        out[i] = last
      } else {
        out[i] = 0
      }
      continue
    }

    // 价格反转熔断：与维持阈 A≥aHold 解耦——否则 A 略低于 aHold（如 0.75&lt;0.8）时永远无法从错色锁存恢复
    if (last === 3 && qPrice > 0) {
      last = qCls >= 1 && qCls <= 4 ? qCls : 0
      out[i] = last
      continue
    }
    if (last === 1 && qPrice < 0) {
      last = qCls >= 1 && qCls <= 4 ? qCls : 0
      out[i] = last
      continue
    }

    // I 轨极端换边：主升浪中突现高能紫(2)、杀跌中突现高能黄(4)，非对向(1↔3)也会错锁，需强制跟进
    if (last === 1 && qCls === 2 && A >= aHold) {
      last = 2
      out[i] = 2
      continue
    }
    if (last === 3 && qCls === 4 && A >= aHold) {
      last = 4
      out[i] = 4
      continue
    }

    if (A < aHold || opposite(last, qCls)) {
      last = 0
      out[i] = 0
    } else {
      out[i] = last
    }
  }
  return out
}

/**
 * 单边欧拉变色龙 **简易现货回测**（主腿收价）：与 {@link buildEulerChameleonCandles} 同源——象限由 (I,Q) 决定，可选 `minAForColor` 静风灰（q=0）。
 * 开仓象限可配：`openLongQuadrant` / `openShortQuadrant` 为 **单个数字**（1～4）或 **象限数组**（可多选并集）；**0** 或 **空数组** 表示该方向不开仓。默认仍为 1=绿多、3=红空。平仓见 `exitMode`。
 *
 * **因果（不偷看未来）**：仅在砖 `i` 收盘时用 `candles[i].close` 与 `eulerPoints[i]` 决策；不读取 `i+1` 及以后。
 * 上游 `eulerResonanceSingleLegOiWeighted` 在索引 `i` 处仅使用 ≤`i` 的砖与 metrics「最后一条 ≤ 砖时」对齐，与之一致则无未来函数。
 * 同一根 K 上先判平仓再判开仓（均按当根收价），属收盘同时成交假设，非前视。
 *
 * **盈亏**：多 `(exit−entry)/entry×100`，空 `(entry−exit)/entry×100`；`sumPnlPct` 为各笔 % **算术相加**，非复利净值。
 * 可选 **`feeRoundTripPct`**：完整交易（一开一平）从毛收益中扣减的百分点，默认 **0.1**（即单边 0.05%×2）；设为 **0** 不扣费。扣费后 `pnlPct` 为净收益，`pnlPctGross` 保留毛收益。
 *
 * @param {{ close: number, time?: number }[]} candles 与 eulerPoints 等长
 * @param {{ I: number, Q: number, A?: number }[]} eulerPoints
 * @param {{
 *   minAForColor?: number,
 *   exitMode?: 'grey_fuse' | 'grey_only' | 'leave_zone',
 *   openLongQuadrant?: number | number[],
 *   openShortQuadrant?: number | number[],
 *   feeRoundTripPct?: number,
 *   paintQuadrants?: number[],
 * }} [opts]
 * - **`grey_fuse`（推荐）**：静风灰（q=0）平仓，且 **多单遇红柱 q=3 立刻平、空单遇绿柱 q=1 立刻平**（反向核弹熔断）；紫/黄不因颜色单独平仓，仍靠灰或 leave。
 * - **`grey_only`**：仅静风灰平仓（无反向熔断，易扛极端单边）。
 * - **`leave_zone`**：当前象限**不在**该方向所选开仓象限集合内即平（多选并集）。
 * **`paintQuadrants`**：与砖等长时每砖展示象限（如施密特），静风 A&lt;minA 仍为 0。
 * @returns {{
 *   trades: Array<{ side: 'long' | 'short', entryIdx: number, exitIdx: number, entryPx: number, exitPx: number, pnlPct: number, pnlPctGross: number, eod?: boolean }>,
 *   sumPnlPct: number,
 *   tradeCount: number,
 *   winCount: number,
 *   openLongQuadrants: number[],
 *   openShortQuadrants: number[],
 *   openLongQuadrant: number,
 *   openShortQuadrant: number,
 *   cumulativePnlPctCurve: Array<{ time: number, value: number }>,
 *   feeRoundTripPct: number,
 *   sumPnlPctGross: number,
 * }}
 */
export function simulateEulerOiChameleonSpotBacktest(candles, eulerPoints, opts = {}) {
  const minA = Number(opts.minAForColor)
  const useSilence = Number.isFinite(minA) && minA > 0
  const em = opts.exitMode
  const exitMode =
    em === 'leave_zone'
      ? 'leave_zone'
      : em === 'grey_only'
        ? 'grey_only'
        : em === 'grey_fuse' || em === 'grey_with_fuse'
          ? 'grey_fuse'
          : 'grey_fuse'
  const rawL = opts.openLongQuadrant
  const rawS = opts.openShortQuadrant

  /** @param {unknown} raw @param {number[]} defaultSet */
  function quadrantSetFromOpt(raw, defaultSet) {
    if (raw === undefined || raw === null || raw === '') {
      return new Set(defaultSet)
    }
    if (Array.isArray(raw)) {
      const s = new Set()
      for (const x of raw) {
        const v = Math.floor(Number(x))
        if (v >= 1 && v <= 4) s.add(v)
      }
      return s
    }
    const n = Math.floor(Number(raw))
    if (!Number.isFinite(n)) return new Set(defaultSet)
    if (n === 0) return new Set()
    if (n >= 1 && n <= 4) return new Set([n])
    return new Set(defaultSet)
  }

  const longSet = quadrantSetFromOpt(rawL, [1])
  const shortSet = quadrantSetFromOpt(rawS, [3])
  const longOn = longSet.size > 0
  const shortOn = shortSet.size > 0
  const n = Math.min(candles?.length ?? 0, eulerPoints?.length ?? 0)
  const paintQOpt = opts.paintQuadrants
  const usePaintOverride = Array.isArray(paintQOpt) && paintQOpt.length === n
  const feeRaw = opts.feeRoundTripPct
  let feeRoundTrip = 0.1
  if (feeRaw !== undefined && feeRaw !== null && feeRaw !== '') {
    const f = Number(feeRaw)
    feeRoundTrip = Number.isFinite(f) && f >= 0 ? f : 0
  }
  /** @type {Array<{ side: 'long' | 'short', entryIdx: number, exitIdx: number, entryPx: number, exitPx: number, pnlPct: number, pnlPctGross: number, eod?: boolean }>} */
  const trades = []
  let pos = 0
  let entryPx = NaN
  let entryIdx = -1

  function paintQuadrant(ep, i) {
    const A = Number.isFinite(ep?.A) ? Number(ep.A) : Math.hypot(Number(ep?.I) || 0, Number(ep?.Q) || 0)
    if (useSilence && (!Number.isFinite(A) || A < minA)) return 0
    if (usePaintOverride) {
      const pq = Math.floor(Number(paintQOpt[i]))
      return pq >= 0 && pq <= 4 ? pq : 0
    }
    return classifyEulerQuadrant(Number(ep?.I) || 0, Number(ep?.Q) || 0)
  }

  for (let i = 0; i < n; i++) {
    const ep = eulerPoints[i]
    const q = paintQuadrant(ep, i)
    const px = Number(candles[i]?.close)
    // 无效收价无法定价；跳过本砖（持仓延续至下一根有效收价，避免用虚构价平仓）
    if (!Number.isFinite(px) || !(px > 0)) continue

    if (pos === 1) {
      const shouldExit =
        exitMode === 'leave_zone'
          ? longOn && !longSet.has(q)
          : exitMode === 'grey_only'
            ? q === 0
            : /* grey_fuse：静风灰 或 反向红柱强平 */
              q === 0 || q === 3
      if (shouldExit) {
        const gross = ((px - entryPx) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'long',
          entryIdx,
          exitIdx: i,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
        })
        pos = 0
      }
    } else if (pos === -1) {
      const shouldExit =
        exitMode === 'leave_zone'
          ? shortOn && !shortSet.has(q)
          : exitMode === 'grey_only'
            ? q === 0
            : /* grey_fuse：静风灰 或 反向绿柱强平 */
              q === 0 || q === 1
      if (shouldExit) {
        const gross = ((entryPx - px) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'short',
          entryIdx,
          exitIdx: i,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
        })
        pos = 0
      }
    }

    if (pos === 0) {
      if (longOn && longSet.has(q)) {
        pos = 1
        entryPx = px
        entryIdx = i
      } else if (shortOn && shortSet.has(q)) {
        pos = -1
        entryPx = px
        entryIdx = i
      }
    }
  }

  if (pos !== 0 && n > 0 && Number.isFinite(entryPx) && entryPx > 0) {
    const last = n - 1
    const px = Number(candles[last]?.close)
    if (Number.isFinite(px) && px > 0) {
      if (pos === 1) {
        const gross = ((px - entryPx) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'long',
          entryIdx,
          exitIdx: last,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          eod: true,
        })
      } else {
        const gross = ((entryPx - px) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'short',
          entryIdx,
          exitIdx: last,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          eod: true,
        })
      }
    }
  }

  const sumPnlPct = trades.reduce((s, t) => s + t.pnlPct, 0)
  const sumPnlPctGross = trades.reduce((s, t) => s + t.pnlPctGross, 0)
  const winCount = trades.filter((t) => t.pnlPct > 0).length

  /** 各笔 % 算术累加曲线：起点 0 对齐首砖时间，每笔平仓在平仓砖时间阶跃（供 lightweight-charts） */
  const cumulativePnlPctCurve = []
  if (n >= 1) {
    const t0 = Number(candles[0]?.time)
    if (Number.isFinite(t0)) cumulativePnlPctCurve.push({ time: t0, value: 0 })
    let cum = 0
    for (const t of trades) {
      cum += t.pnlPct
      const ts = Number(candles[t.exitIdx]?.time)
      if (Number.isFinite(ts)) cumulativePnlPctCurve.push({ time: ts, value: cum })
    }
    if (!trades.length && n >= 2) {
      const tLast = Number(candles[n - 1]?.time)
      if (Number.isFinite(tLast) && tLast !== t0) cumulativePnlPctCurve.push({ time: tLast, value: 0 })
    }
  }

  const openLongQuadrants = longOn ? Array.from(longSet).sort((a, b) => a - b) : []
  const openShortQuadrants = shortOn ? Array.from(shortSet).sort((a, b) => a - b) : []

  return {
    trades,
    sumPnlPct,
    tradeCount: trades.length,
    winCount,
    openLongQuadrants,
    openShortQuadrants,
    /** @deprecated 使用 openLongQuadrants；仅为兼容旧调用方保留 */
    openLongQuadrant: openLongQuadrants[0] ?? 0,
    /** @deprecated 使用 openShortQuadrants */
    openShortQuadrant: openShortQuadrants[0] ?? 0,
    cumulativePnlPctCurve,
    feeRoundTripPct: feeRoundTrip,
    sumPnlPctGross,
  }
}

/**
 * 砖 TR 中位数（用于「±N 块砖」近似止损）：窗口 `[idx−win+1, idx]`。
 * @param {{ h?: number, l?: number }[]} candles
 */
function _medianTrueRangeWindow(candles, idx, win = 30) {
  const lo = Math.max(0, idx - Math.max(1, Math.floor(win)) + 1)
  const arr = []
  for (let j = lo; j <= idx; j++) {
    const h = Number(candles[j]?.h)
    const l = Number(candles[j]?.l)
    if (Number.isFinite(h) && Number.isFinite(l) && h >= l) arr.push(h - l)
  }
  if (!arr.length) return NaN
  arr.sort((a, b) => a - b)
  return arr[Math.floor(arr.length / 2)]
}

/** @param {number[]} absOm */
function _smaAbsTrailing(absOm, period) {
  const n = absOm.length
  const out = new Float64Array(n).fill(NaN)
  const p = Math.max(1, Math.floor(period))
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += absOm[i]
    if (i >= p) sum -= absOm[i - p]
    if (i >= p - 1) out[i] = sum / p
  }
  return out
}

/**
 * `abs(omega)` 最近 `need` 根是否<strong>单调递减</strong>（角动量衰减）。
 */
function _omegaDecayExit(absOm, i, need) {
  const k = Math.floor(Number(need))
  if (!Number.isFinite(k) || k < 2 || i < k - 1) return false
  for (let t = 0; t < k - 1; t++) {
    const a = absOm[i - t]
    const b = absOm[i - t - 1]
    if (!(Number.isFinite(a) && Number.isFinite(b)) || !(a < b)) return false
  }
  return true
}

/**
 * **共振矩阵**现货回测（与实盘简易模拟盘同源字段）：推力×相位×Z(CVD)×螺旋 σ/ω。
 * 须传入已由 {@link eulerSpiralEnrich}  enriched 的欧拉点（含 `sigmaSmoothed`、`omega`、`theta`）。
 * **Z(CVD)** 默认用 **`IRaw`**（与页面「净吃单 Z」一致）；可选 `zField: 'I'` 用 OI 加权轨。
 *
 * 做多开仓（默认）：绿 paint 1、θ°∈(30,60)、σ平滑&gt;0、Z(CVD)&gt;1.5。
 * 止盈：θ&gt;75° **或** |ω|&gt;SMA(|ω|,P)×k **或** σ平滑&lt;0 **或** paint 黄 4（文档「失稳」）。
 * 止损：灰 0 **或** 跌破开仓价 − N×砖 TR 中位数 **或** paint 4 **或** |ω| 连续衰减（野路子）；`stopLossEnabled=false` 时关闭此类离场。
 * 做空对称：paint 3、θ°∈(−150,−120)、σ&gt;0、Z&lt;−1.5；止盈 θ&lt;−170° / ω 暴发 / paint 4；止损灰 / +N 砖 / paint 2。
 *
 * @param {{ close: number, h?: number, l?: number, time?: number }[]} candles
 * @param {object[]} eulerSpiralPoints {@link eulerSpiralEnrich} 输出
 * @param {{
 *   minAForColor?: number,
 *   paintQuadrants?: number[],
 *   feeRoundTripPct?: number,
 *   zField?: 'IRaw' | 'I',
 *   longOpenPaint?: number,
 *   shortOpenPaint?: number,
 *   longThetaMinDeg?: number,
 *   longThetaMaxDeg?: number,
 *   shortThetaMinDeg?: number,
 *   shortThetaMaxDeg?: number,
 *   longZMin?: number,
 *   shortZMax?: number,
 *   sigmaOpenMin?: number,
 *   longTpThetaDeg?: number,
 *   shortTpThetaDeg?: number,
 *   tpSigmaBelow?: number,
 *   omegaSpikeMult?: number,
 *   omegaSmaPeriod?: number,
 *   tpLongIncludeYellow?: boolean,
 *   tpShortIncludeYellow?: boolean,
 *   brickStopMult?: number,
 *   trMedianWin?: number,
 *   omegaDecayBricks?: number,
 *   maxHoldBricks?: number,
 *   stopLossEnabled?: boolean,
 * }} [opts]
 */
export function simulateEulerResonanceMatrixSpotBacktest(candles, eulerSpiralPoints, opts = {}) {
  const n = Math.min(candles?.length ?? 0, eulerSpiralPoints?.length ?? 0)
  const feeRaw = opts.feeRoundTripPct
  let feeRoundTrip = 0.1
  if (feeRaw !== undefined && feeRaw !== null && feeRaw !== '') {
    const f = Number(feeRaw)
    feeRoundTrip = Number.isFinite(f) && f >= 0 ? f : 0
  }

  const minA = Number(opts.minAForColor)
  const useSilence = Number.isFinite(minA) && minA > 0
  const paintQOpt = opts.paintQuadrants
  const usePaintOverride = Array.isArray(paintQOpt) && paintQOpt.length === n

  const zField = opts.zField === 'I' ? 'I' : 'IRaw'
  const longOpenPaint = Math.floor(Number(opts.longOpenPaint) ?? 1) || 1
  const shortOpenPaint = Math.floor(Number(opts.shortOpenPaint) ?? 3) || 3

  const longThetaMinDeg = Number.isFinite(Number(opts.longThetaMinDeg)) ? Number(opts.longThetaMinDeg) : 30
  const longThetaMaxDeg = Number.isFinite(Number(opts.longThetaMaxDeg)) ? Number(opts.longThetaMaxDeg) : 60
  const shortThetaMinDeg = Number.isFinite(Number(opts.shortThetaMinDeg)) ? Number(opts.shortThetaMinDeg) : -150
  const shortThetaMaxDeg = Number.isFinite(Number(opts.shortThetaMaxDeg)) ? Number(opts.shortThetaMaxDeg) : -120

  const longZMin = Number.isFinite(Number(opts.longZMin)) ? Number(opts.longZMin) : 1.5
  const shortZMax = Number.isFinite(Number(opts.shortZMax)) ? Number(opts.shortZMax) : -1.5
  const sigmaOpenMin = Number.isFinite(Number(opts.sigmaOpenMin)) ? Number(opts.sigmaOpenMin) : 0

  const longTpThetaDeg = Number.isFinite(Number(opts.longTpThetaDeg)) ? Number(opts.longTpThetaDeg) : 75
  const shortTpThetaDeg = Number.isFinite(Number(opts.shortTpThetaDeg)) ? Number(opts.shortTpThetaDeg) : -170
  const tpSigmaBelow = Number.isFinite(Number(opts.tpSigmaBelow)) ? Number(opts.tpSigmaBelow) : 0
  const omegaSpikeMult = Number.isFinite(Number(opts.omegaSpikeMult)) ? Number(opts.omegaSpikeMult) : 2
  const omegaSmaPeriod = Math.max(2, Math.floor(Number(opts.omegaSmaPeriod) || 20))

  const tpShortYellow = opts.tpShortIncludeYellow !== false

  const brickStopMult = Number.isFinite(Number(opts.brickStopMult)) ? Number(opts.brickStopMult) : 2
  const trWin = Math.max(5, Math.floor(Number(opts.trMedianWin) || 30))

  const omegaDecayBricks = Math.floor(Number(opts.omegaDecayBricks) || 0)
  const maxHoldBricks = Math.floor(Number(opts.maxHoldBricks) || 0)
  const stopLossEnabled = opts.stopLossEnabled !== false

  const thetaDegArr = new Float64Array(n)
  const absOmegaArr = new Float64Array(n)
  const zArr = new Float64Array(n)
  const sigmaSArr = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    const ep = eulerSpiralPoints[i]
    const th = Number(ep?.theta)
    thetaDegArr[i] = Number.isFinite(th) ? (th * 180) / Math.PI : NaN
    const om = Number(ep?.omega)
    absOmegaArr[i] = Number.isFinite(om) ? Math.abs(om) : NaN
    const zRaw = zField === 'I' ? Number(ep?.I) : Number(ep?.IRaw)
    zArr[i] = Number.isFinite(zRaw) ? zRaw : NaN
    const ss = Number(ep?.sigmaSmoothed)
    sigmaSArr[i] = Number.isFinite(ss) ? ss : NaN
  }

  const smaAbsOmega = _smaAbsTrailing(absOmegaArr, omegaSmaPeriod)

  /** @type {Array<{ side: 'long' | 'short', entryIdx: number, exitIdx: number, entryPx: number, exitPx: number, pnlPct: number, pnlPctGross: number, eod?: boolean, exitTag?: string }>} */
  const trades = []
  let pos = 0
  let entryPx = NaN
  let entryIdx = -1
  /** @type {number} 开仓时登记的砖 TR 中位标尺 */
  let entryTrMed = NaN

  function paintQuadrant(ep, i) {
    const A = Number.isFinite(ep?.A) ? Number(ep.A) : Math.hypot(Number(ep?.I) || 0, Number(ep?.Q) || 0)
    if (useSilence && (!Number.isFinite(A) || A < minA)) return 0
    if (usePaintOverride) {
      const pq = Math.floor(Number(paintQOpt[i]))
      return pq >= 0 && pq <= 4 ? pq : 0
    }
    return classifyEulerQuadrant(Number(ep?.I) || 0, Number(ep?.Q) || 0)
  }

  for (let i = 0; i < n; i++) {
    const ep = eulerSpiralPoints[i]
    const px = Number(candles[i]?.close)
    if (!Number.isFinite(px) || !(px > 0)) continue

    const q = paintQuadrant(ep, i)
    const thetaDeg = thetaDegArr[i]
    const z = zArr[i]
    const sigmaS = sigmaSArr[i]
    const absOm = absOmegaArr[i]
    const smaOm = smaAbsOmega[i]

    if (pos === 1) {
      let tag = null
      // 文档：多单止损优先（灰 / 黄转支撑 / N 砖），再止盈（相位力竭、ω 暴发、σ 坍缩）；stopLossEnabled=false 时跳过止损类
      if (stopLossEnabled) {
        if (q === 0) tag = 'sl_grey'
        else if (q === 4) tag = 'sl_yellow'
        else if (Number.isFinite(entryPx) && Number.isFinite(entryTrMed) && px < entryPx - brickStopMult * entryTrMed) {
          tag = 'sl_price_bricks'
        } else if (omegaDecayBricks >= 2 && _omegaDecayExit(absOmegaArr, i, omegaDecayBricks)) tag = 'omega_decay'
      }
      if (!tag) {
        if (Number.isFinite(thetaDeg) && thetaDeg > longTpThetaDeg) tag = 'tp_theta'
        else if (
          Number.isFinite(absOm) &&
          Number.isFinite(smaOm) &&
          smaOm > 1e-12 &&
          absOm > smaOm * omegaSpikeMult
        ) {
          tag = 'tp_omega'
        } else if (Number.isFinite(sigmaS) && sigmaS < tpSigmaBelow) tag = 'tp_sigma'
        else if (maxHoldBricks > 0 && i - entryIdx >= maxHoldBricks) tag = 'max_hold'
      }

      if (tag) {
        const gross = ((px - entryPx) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'long',
          entryIdx,
          exitIdx: i,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          exitTag: tag,
        })
        pos = 0
      }
    } else if (pos === -1) {
      let tag = null
      if (stopLossEnabled) {
        if (q === 0) tag = 'sl_grey'
        else if (q === 2) tag = 'sl_purple'
        else if (Number.isFinite(entryPx) && Number.isFinite(entryTrMed) && px > entryPx + brickStopMult * entryTrMed) {
          tag = 'sl_price_bricks'
        } else if (omegaDecayBricks >= 2 && _omegaDecayExit(absOmegaArr, i, omegaDecayBricks)) tag = 'omega_decay'
      }
      if (!tag) {
        if (Number.isFinite(thetaDeg) && thetaDeg < shortTpThetaDeg) tag = 'tp_theta'
        else if (
          Number.isFinite(absOm) &&
          Number.isFinite(smaOm) &&
          smaOm > 1e-12 &&
          absOm > smaOm * omegaSpikeMult
        ) {
          tag = 'tp_omega'
        } else if (tpShortYellow && q === 4) tag = 'tp_yellow'
        else if (maxHoldBricks > 0 && i - entryIdx >= maxHoldBricks) tag = 'max_hold'
      }

      if (tag) {
        const gross = ((entryPx - px) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'short',
          entryIdx,
          exitIdx: i,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          exitTag: tag,
        })
        pos = 0
      }
    }

    if (pos === 0) {
      const sigmaOk = Number.isFinite(sigmaS) && sigmaS > Math.max(sigmaOpenMin, 1e-9)
      const openLong =
        q === longOpenPaint &&
        Number.isFinite(thetaDeg) &&
        thetaDeg > longThetaMinDeg &&
        thetaDeg < longThetaMaxDeg &&
        sigmaOk &&
        Number.isFinite(z) &&
        z > longZMin
      const openShort =
        q === shortOpenPaint &&
        Number.isFinite(thetaDeg) &&
        thetaDeg > shortThetaMinDeg &&
        thetaDeg < shortThetaMaxDeg &&
        sigmaOk &&
        Number.isFinite(z) &&
        z < shortZMax

      if (openLong) {
        pos = 1
        entryPx = px
        entryIdx = i
        entryTrMed = _medianTrueRangeWindow(candles, i, trWin)
      } else if (openShort) {
        pos = -1
        entryPx = px
        entryIdx = i
        entryTrMed = _medianTrueRangeWindow(candles, i, trWin)
      }
    }
  }

  if (pos !== 0 && n > 0 && Number.isFinite(entryPx) && entryPx > 0) {
    const last = n - 1
    const px = Number(candles[last]?.close)
    if (Number.isFinite(px) && px > 0) {
      if (pos === 1) {
        const gross = ((px - entryPx) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'long',
          entryIdx,
          exitIdx: last,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          eod: true,
        })
      } else {
        const gross = ((entryPx - px) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'short',
          entryIdx,
          exitIdx: last,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          eod: true,
        })
      }
    }
  }

  const sumPnlPct = trades.reduce((s, t) => s + t.pnlPct, 0)
  const sumPnlPctGross = trades.reduce((s, t) => s + t.pnlPctGross, 0)
  const winCount = trades.filter((t) => t.pnlPct > 0).length

  const cumulativePnlPctCurve = []
  if (n >= 1) {
    const t0 = Number(candles[0]?.time)
    if (Number.isFinite(t0)) cumulativePnlPctCurve.push({ time: t0, value: 0 })
    let cum = 0
    for (const t of trades) {
      cum += t.pnlPct
      const ts = Number(candles[t.exitIdx]?.time)
      if (Number.isFinite(ts)) cumulativePnlPctCurve.push({ time: ts, value: cum })
    }
    if (!trades.length && n >= 2) {
      const tLast = Number(candles[n - 1]?.time)
      if (Number.isFinite(tLast) && tLast !== t0) cumulativePnlPctCurve.push({ time: tLast, value: 0 })
    }
  }

  return {
    trades,
    sumPnlPct,
    tradeCount: trades.length,
    winCount,
    cumulativePnlPctCurve,
    feeRoundTripPct: feeRoundTrip,
    sumPnlPctGross,
    strategy: 'euler_resonance_matrix_v1',
  }
}

/**
 * **静风震荡**简易现货回测：仅在 **A &lt; 变色龙 min A**（静风灰）时考虑开仓；用 **未静默** 的 I,Q 象限判 **紫(2) 空 / 黄(4) 多**（与主图灰柱下仍按 I,Q 区分）。
 * 平仓：**变色**（对应方向 raw 象限不再为 2/4）、**走出静风**（A≥minA）、或 **超过最长持仓砖数**；与 {@link simulateEulerOiChameleonSpotBacktest} 一样先平后开、当根收价、尾盘强平。
 *
 * @param {{ close: number, time?: number }[]} candles
 * @param {{ I: number, Q: number, A?: number }[]} eulerPoints
 * @param {{
 *   minAForColor: number,
 *   maxHoldBricks?: number,
 *   feeRoundTripPct?: number,
 * }} opts **minAForColor** 须 &gt;0，否则无静风、不产生交易
 * @returns 与 {@link simulateEulerOiChameleonSpotBacktest} 相近；另含 **`maxHoldBricks`**；单笔可带 **`exitKind`**（`eod` 无 exitKind）。
 */
export function simulateEulerOiSilenceOscillationSpotBacktest(candles, eulerPoints, opts = {}) {
  const minA = Number(opts.minAForColor)
  const useSilence = Number.isFinite(minA) && minA > 0
  const feeRaw = opts.feeRoundTripPct
  let feeRoundTrip = 0.1
  if (feeRaw !== undefined && feeRaw !== null && feeRaw !== '') {
    const f = Number(feeRaw)
    feeRoundTrip = Number.isFinite(f) && f >= 0 ? f : 0
  }
  const mhRaw = opts.maxHoldBricks
  let maxHoldBricks = 2
  if (mhRaw !== undefined && mhRaw !== null && mhRaw !== '') {
    const m = Math.floor(Number(mhRaw))
    maxHoldBricks = Number.isFinite(m) && m >= 1 ? Math.min(50, m) : 2
  }

  const n = Math.min(candles?.length ?? 0, eulerPoints?.length ?? 0)
  /** @type {Array<{ side: 'long' | 'short', entryIdx: number, exitIdx: number, entryPx: number, exitPx: number, pnlPct: number, pnlPctGross: number, eod?: boolean, exitKind?: 'color' | 'leave_silence' | 'max_hold' }>} */
  const trades = []
  let pos = 0
  let entryPx = NaN
  let entryIdx = -1

  function inSilence(ep) {
    if (!useSilence) return false
    const A = Number.isFinite(ep?.A) ? Number(ep.A) : Math.hypot(Number(ep?.I) || 0, Number(ep?.Q) || 0)
    return !Number.isFinite(A) || A < minA
  }

  for (let i = 0; i < n; i++) {
    const ep = eulerPoints[i]
    const silent = inSilence(ep)
    const rawQ = classifyEulerQuadrant(Number(ep?.I) || 0, Number(ep?.Q) || 0)
    const px = Number(candles[i]?.close)
    if (!Number.isFinite(px) || !(px > 0)) continue

    function exitReasonLong() {
      if (!silent) return 'leave_silence'
      if (i - entryIdx >= maxHoldBricks) return 'max_hold'
      if (rawQ !== 4) return 'color'
      return null
    }
    function exitReasonShort() {
      if (!silent) return 'leave_silence'
      if (i - entryIdx >= maxHoldBricks) return 'max_hold'
      if (rawQ !== 2) return 'color'
      return null
    }

    if (pos === 1) {
      const why = exitReasonLong()
      if (why) {
        const gross = ((px - entryPx) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'long',
          entryIdx,
          exitIdx: i,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          exitKind: why,
        })
        pos = 0
      }
    } else if (pos === -1) {
      const why = exitReasonShort()
      if (why) {
        const gross = ((entryPx - px) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'short',
          entryIdx,
          exitIdx: i,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          exitKind: why,
        })
        pos = 0
      }
    }

    if (pos === 0 && useSilence) {
      if (silent && rawQ === 2) {
        pos = -1
        entryPx = px
        entryIdx = i
      } else if (silent && rawQ === 4) {
        pos = 1
        entryPx = px
        entryIdx = i
      }
    }
  }

  if (pos !== 0 && n > 0 && Number.isFinite(entryPx) && entryPx > 0) {
    const last = n - 1
    const px = Number(candles[last]?.close)
    if (Number.isFinite(px) && px > 0) {
      if (pos === 1) {
        const gross = ((px - entryPx) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'long',
          entryIdx,
          exitIdx: last,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          eod: true,
        })
      } else {
        const gross = ((entryPx - px) / entryPx) * 100
        const net = gross - feeRoundTrip
        trades.push({
          side: 'short',
          entryIdx,
          exitIdx: last,
          entryPx,
          exitPx: px,
          pnlPctGross: gross,
          pnlPct: net,
          eod: true,
        })
      }
    }
  }

  const sumPnlPct = trades.reduce((s, t) => s + t.pnlPct, 0)
  const sumPnlPctGross = trades.reduce((s, t) => s + t.pnlPctGross, 0)
  const winCount = trades.filter((t) => t.pnlPct > 0).length

  const cumulativePnlPctCurve = []
  if (n >= 1) {
    const t0 = Number(candles[0]?.time)
    if (Number.isFinite(t0)) cumulativePnlPctCurve.push({ time: t0, value: 0 })
    let cum = 0
    for (const t of trades) {
      cum += t.pnlPct
      const ts = Number(candles[t.exitIdx]?.time)
      if (Number.isFinite(ts)) cumulativePnlPctCurve.push({ time: ts, value: cum })
    }
    if (!trades.length && n >= 2) {
      const tLast = Number(candles[n - 1]?.time)
      if (Number.isFinite(tLast) && tLast !== t0) cumulativePnlPctCurve.push({ time: tLast, value: 0 })
    }
  }

  return {
    trades,
    sumPnlPct,
    tradeCount: trades.length,
    winCount,
    openLongQuadrants: useSilence ? [4] : [],
    openShortQuadrants: useSilence ? [2] : [],
    openLongQuadrant: useSilence ? 4 : 0,
    openShortQuadrant: useSilence ? 2 : 0,
    cumulativePnlPctCurve,
    feeRoundTripPct: feeRoundTrip,
    sumPnlPctGross,
    maxHoldBricks,
  }
}

/**
 * **方案一**：主图 Renko 按欧拉象限染色（仍保留 OHLC；近轴保持默认涨跌色）。
 *
 * 可选 **能量静默**：`minAForColor`&gt;0 且 \(A=\sqrt{I^2+Q^2}\) 小于该阈时，整砖强制中性灰（不解读象限，抹掉假紫假红）。
 *
 * @param {{ time: number, open: number, high: number, low: number, close: number }[]} candles
 * @param {{ I: number, Q: number, A?: number }[]} eulerPts 与 candles 等长对齐
 * @param {boolean} isDark
 * @param {{ minAForColor?: number, paintQuadrants?: number[] }} [opts] `paintQuadrants` 与砖等长时每砖展示象限（如 {@link computeEulerSchmittPaintQuadrants}），仍先判 A&lt;minA 静风灰
 * @returns {Array<{ time: number, open: number, high: number, low: number, close: number, color?: string, borderColor?: string, wickColor?: string }>}
 */
export function buildEulerChameleonCandles(candles, eulerPts, isDark, opts = {}) {
  if (!candles?.length) return []
  if (!eulerPts?.length) {
    return candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  }
  const n = Math.min(candles.length, eulerPts.length)
  const paintQArr = Array.isArray(opts.paintQuadrants) && opts.paintQuadrants.length >= n ? opts.paintQuadrants : null
  const minATh = Number(opts.minAForColor)
  const useEnergySilence = Number.isFinite(minATh) && minATh > 0
  const mutedPal = isDark
    ? { color: '#52525b', borderColor: '#3f3f46', wickColor: '#71717a' }
    : { color: '#d4d4d8', borderColor: '#a1a1aa', wickColor: '#e4e4e7' }
  const pal = isDark
    ? {
        1: { color: '#4ade80', borderColor: '#22c55e', wickColor: '#86efac' },
        4: { color: '#fde047', borderColor: '#eab308', wickColor: '#facc15' },
        3: { color: '#b91c1c', borderColor: '#991b1b', wickColor: '#f87171' },
        2: { color: '#c084fc', borderColor: '#9333ea', wickColor: '#e9d5ff' },
      }
    : {
        1: { color: '#22c55e', borderColor: '#15803d', wickColor: '#4ade80' },
        4: { color: '#facc15', borderColor: '#ca8a04', wickColor: '#fde047' },
        3: { color: '#991b1b', borderColor: '#7f1d1d', wickColor: '#dc2626' },
        2: { color: '#a855f7', borderColor: '#7e22ce', wickColor: '#c4b5fd' },
      }
  return candles.map((c, i) => {
    const base = { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }
    if (i >= n) return base
    const ep = eulerPts[i]
    const A = Number.isFinite(ep?.A) ? Number(ep.A) : Math.hypot(Number(ep?.I) || 0, Number(ep?.Q) || 0)
    if (useEnergySilence && (!Number.isFinite(A) || A < minATh)) {
      return { ...base, ...mutedPal }
    }
    let q = classifyEulerQuadrant(ep.I, ep.Q)
    if (paintQArr) {
      const pq = Math.floor(Number(paintQArr[i]))
      q = pq >= 0 && pq <= 4 ? pq : 0
    }
    if (q === 0) {
      if (paintQArr) return { ...base, ...mutedPal }
      return base
    }
    const p = pal[q]
    return { ...base, color: p.color, borderColor: p.borderColor, wickColor: p.wickColor }
  })
}

/**
 * 升序数组上的线性分位数（q∈[0,1]）。
 *
 * @param {number[]} sortedAsc
 * @param {number} q
 */
function quantileLinearAscending(sortedAsc, q) {
  const n = sortedAsc.length
  if (!n) return NaN
  const qq = Math.min(1, Math.max(0, q))
  const pos = (n - 1) * qq
  const lo = Math.floor(pos)
  const hi = Math.min(n - 1, Math.ceil(pos))
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] * (hi - pos) + sortedAsc[hi] * (pos - lo)
}

/**
 * 能量副图用的显示层 |A| 上限：按样本高分位 + [displayCapMin, displayCapMax] 夹紧，避免单笔 Z 爆表撑碎 Y 轴。
 * **不修改** `eulerPts[].A`（PDO / 象限 / 标记仍用原始模长）。
 *
 * @param {{ A?: number }[]} eulerPts
 * @param {{
 *   disableDisplayCap?: boolean,
 *   displayAbsMax?: number,
 *   displayQuantile?: number,
 *   displayCapMin?: number,
 *   displayCapMax?: number,
 * }} [opts]
 * @returns {number|null} 有穷则与 {@link buildEulerEnergyHistogramPoints} 内钳制一致；`null` 表示不固定副图 Y（全 0 或显式关闭 cap）
 */
export function computeEulerEnergyDisplayAbsCap(eulerPts, opts = {}) {
  if (opts.disableDisplayCap) return null
  const manual = Number(opts.displayAbsMax)
  if (Number.isFinite(manual) && manual > 0) return manual

  const lo = Math.max(1e-9, Number(opts.displayCapMin) || 6)
  const hi = Math.max(lo, Number(opts.displayCapMax) || 22)
  const q = Math.min(0.9995, Math.max(0.85, Number(opts.displayQuantile) || 0.98))

  if (!eulerPts?.length) return null
  const as = []
  for (const e of eulerPts) {
    const a = Number.isFinite(e.A) ? Math.abs(e.A) : 0
    if (a > 0) as.push(a)
  }
  if (!as.length) return null
  as.sort((a, b) => a - b)
  const p = quantileLinearAscending(as, q)
  if (!Number.isFinite(p)) return null
  return Math.min(hi, Math.max(lo, p))
}

/**
 * **方案三**：共振能量柱 — 高度为模长 A（可选显示层钳制），方向/颜色由象限决定（Q4 用半透明黄模拟「空心」吸收柱）。
 *
 * @param {{ time: number, I: number, Q: number, A: number }[]} eulerPts
 * @param {boolean} isDark
 * @param {{
 *   disableDisplayCap?: boolean,
 *   displayAbsMax?: number,
 *   displayQuantile?: number,
 *   displayCapMin?: number,
 *   displayCapMax?: number,
 * }} [opts] 传给 {@link computeEulerEnergyDisplayAbsCap}；柱高使用 min(A_raw, cap)，cap 为 null 时不钳制
 * @returns {{ points: { time: number, value: number, color: string }[], displayAbsCap: number|null }}
 */
export function buildEulerEnergyHistogramPoints(eulerPts, isDark, opts = {}) {
  if (!eulerPts?.length) return { points: [], displayAbsCap: null }
  const cap = computeEulerEnergyDisplayAbsCap(eulerPts, opts)
  const clamp = cap == null ? (a) => a : (a) => Math.min(a, cap)
  const q4 = isDark ? 'rgba(250,204,21,0.42)' : 'rgba(234,179,8,0.5)'
  const out = []
  for (const e of eulerPts) {
    const Araw = Number.isFinite(e.A) ? Math.max(0, e.A) : 0
    const A = clamp(Araw)
    const q = classifyEulerQuadrant(e.I, e.Q)
    let value = 0
    let color = isDark ? '#64748b' : '#94a3b8'
    if (q === 1) {
      value = A
      color = isDark ? '#4ade80' : '#16a34a'
    } else if (q === 3) {
      value = -A
      color = isDark ? '#f87171' : '#dc2626'
    } else if (q === 4) {
      value = A
      color = q4
    } else if (q === 2) {
      value = -A
      color = isDark ? '#c084fc' : '#9333ea'
    } else {
      value = 0
      color = isDark ? '#475569' : '#cbd5e1'
    }
    out.push({ time: e.time, value, color })
  }
  return { points: out, displayAbsCap: cap }
}

/**
 * 简化 Ehlers：对输入序列（如 AVI）加权平滑 → 近似 I/Q → sin(φ)、sin(φ+45°)（φ 为希尔伯特相位，非欧拉 θ）。
 * 仍用于 {@code JbarKlineChart} 等 AVI 周期副图；四维盘下窗已改用 {@link eulerResonanceFromBricks} 的真 θ。
 *
 * @param {number[]} values 与主序列等长
 * @returns {{ sine: number[], lead: number[] }}
 */
export function hilbertSineLeadFromInput(values) {
  const n = values.length
  const smooth = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const x = values[i]
    if (i < 3) smooth[i] = x
    else smooth[i] = (4 * x + 3 * values[i - 1] + 2 * values[i - 2] + values[i - 3]) / 10
  }
  const sine = []
  const lead = []
  for (let i = 0; i < n; i++) {
    const I = i >= 3 ? smooth[i - 3] : smooth[i]
    let Q = 0
    if (i >= 6) {
      Q =
        0.0962 * smooth[i] +
        0.5769 * smooth[i - 2] -
        0.5769 * smooth[i - 4] -
        0.0962 * smooth[i - 6]
    }
    const ph = Math.atan2(Q, Math.abs(I) < 1e-12 ? 1e-12 : I)
    sine.push(Math.sin(ph))
    lead.push(Math.sin(ph + Math.PI / 4))
  }
  return { sine, lead }
}

/**
 * 相位差振荡器 PDO（Phase Delta Oscillator）：\( \mathrm{PDO} = \sin(\theta+\pi/4) - \sin(\theta) \)，
 * 与领先/正弦线同源；两正弦之差仍为同频正弦型，过零对应两线交叉，「高原」对应两线平行（周期锁死）。
 *
 * @param {number[]} sine 与 {@link hilbertSineLeadFromInput} 的 sine 等长
 * @param {number[]} lead 同上
 * @returns {number[]} 逐点差分，与输入等长
 */
export function pdoSeriesValues(sine, lead) {
  const n = Math.min(sine?.length ?? 0, lead?.length ?? 0)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const s = Number(sine[i])
    const l = Number(lead[i])
    out[i] = (Number.isFinite(l) ? l : 0) - (Number.isFinite(s) ? s : 0)
  }
  return out
}

/**
 * 一维卡尔曼：对 `{ time, value }[]` 测量序列做状态估计（与 JbarKlineChart 口径一致）。
 *
 * @param {{ time: import('lightweight-charts').Time, value: number }[]} points 时间升序
 * @param {number} processNoise Q
 * @param {number} measurementNoise R
 * @returns {{ time: import('lightweight-charts').Time, value: number }[]}
 */
export function kalmanFromPoints(points, processNoise, measurementNoise) {
  const q = Math.max(1e-9, Number.isFinite(Number(processNoise)) ? Number(processNoise) : 0.08)
  const r = Math.max(1e-9, Number.isFinite(Number(measurementNoise)) ? Number(measurementNoise) : 0.2)
  if (!Array.isArray(points) || !points.length) return []
  const out = []
  let x = Number.NaN
  let p = 1
  for (const pt of points) {
    const t = Number(pt?.time)
    const z = Number(pt?.value)
    if (!Number.isFinite(t) || !Number.isFinite(z)) continue
    if (!Number.isFinite(x)) {
      x = z
      p = 1
      out.push({ time: t, value: x })
      continue
    }
    p = p + q
    const k = p / (p + r)
    x = x + k * (z - x)
    p = (1 - k) * p
    out.push({ time: t, value: x })
  }
  return out
}

function quantileSortedAsc(sorted, p) {
  if (!sorted.length) return 0
  const pp = Math.max(0, Math.min(1, p))
  const idx = Math.min(sorted.length - 1, Math.floor(pp * (sorted.length - 1)))
  return sorted[idx]
}

/**
 * 「释放」标记：CVD 动能 D 与价格效率 E。
 *
 * - **D**：最近 `lookback` 根砖上累积 CVD 的净变化，\(D_i = \mathrm{CVD}_i - \mathrm{CVD}_{i-L}\)（等价于这 L 根上各砖 Δ 之和）。
 * - **E**：价格效率 \(E_i = \Delta P / D_i\)，其中 \(\Delta P = C_i - C_{i-L}\)（同窗收盘价差）；要求 \(|D|\) 足够大且 \(E>0\) 且 \(\operatorname{sign}(D)=\operatorname{sign}(\Delta P)\)。
 * - **阈值**：`momentumMin` / `efficiencyMin` 均 >0 时用固定值；否则用当前样本上满足方向一致且 \(E>0\) 的子集的 **分位数**（|D| 约 0.72，E 约 0.58）作自适应门槛，避免品种间量纲硬编码。
 *
 * @param {{ time: number, close: number }[]} candles 与 cvdLine 对齐
 * @param {{ time: number, value: number }[]} cvdLine 累积 CVD
 * @param {{ lookback?: number, momentumMin?: number|null, efficiencyMin?: number|null }} opts
 * @returns {{ markers: Array<{ time: number, position: string, color: string, shape: string, text: string }>, thD: number, thE: number, adaptive: boolean }}
 */
export function buildReleaseMarkers(candles, cvdLine, opts = {}) {
  const lb = Math.max(2, Math.min(20, Math.floor(Number(opts.lookback)) || 3))
  const epsD = 1e-12
  const n = Math.min(candles.length, cvdLine.length)
  if (n <= lb) {
    return { markers: [], thD: 0, thE: 0, adaptive: true }
  }

  const absDList = []
  const eList = []
  for (let i = lb; i < n; i++) {
    const D = cvdLine[i].value - cvdLine[i - lb].value
    const dP = candles[i].close - candles[i - lb].close
    if (Math.abs(D) < epsD) continue
    if (dP === 0 || Math.sign(D) !== Math.sign(dP)) continue
    const E = dP / D
    if (!(E > 0)) continue
    absDList.push(Math.abs(D))
    eList.push(E)
  }
  absDList.sort((a, b) => a - b)
  eList.sort((a, b) => a - b)

  if (!absDList.length || !eList.length) {
    return { markers: [], thD: 0, thE: 0, adaptive: true }
  }

  let adaptive = true
  let thD = quantileSortedAsc(absDList, 0.72)
  let thE = quantileSortedAsc(eList, 0.58)
  if (!(thD > 0)) thD = epsD
  if (!(thE > 0)) thE = 1e-15

  const momIn = Number(opts.momentumMin)
  const effIn = Number(opts.efficiencyMin)
  if (Number.isFinite(momIn) && momIn > 0) {
    thD = momIn
    adaptive = false
  }
  if (Number.isFinite(effIn) && effIn > 0) {
    thE = effIn
    adaptive = false
  }

  const markers = []
  for (let i = lb; i < n; i++) {
    const D = cvdLine[i].value - cvdLine[i - lb].value
    const dP = candles[i].close - candles[i - lb].close
    if (Math.abs(D) <= thD) continue
    if (Math.abs(D) < epsD) continue
    if (dP === 0 || Math.sign(D) !== Math.sign(dP)) continue
    const E = dP / D
    if (E <= thE) continue
    const up = dP > 0
    markers.push({
      time: candles[i].time,
      position: up ? 'aboveBar' : 'belowBar',
      color: up ? '#fb923c' : '#c084fc',
      shape: 'square',
      text: '释放',
    })
  }
  return { markers, thD, thE, adaptive }
}

/**
 * ABO（非对称贝塔振荡器）：
 * 以基准砖时间为切片，返回 fast/slow 双线及 cumAbo / price 序列（供 AVI 等衍生）。
 */
export function aboSeriesDual(
  altCandles,
  benchCandles,
  fastPeriod,
  slowPeriod,
  threshold,
  isDark,
  softClamp,
  softClampDiv,
  softClampRange,
  softClampScore,
  reversalBoost,
  reversalBoostFactor,
  volumeWeighted,
  volumePeriod,
  winsorize,
  winsorLimit,
  preSmoothPeriod,
  benchmarkNoiseFilter,
  benchmarkMinMovePct
) {
  if (!altCandles?.length || !benchCandles?.length) {
    return { fast: [], slow: [], fastHist: [], slowHist: [], cumAboSeries: [], priceSeries: [] }
  }
  const pf = Math.max(1, Math.min(200, Math.floor(Number(fastPeriod)) || 7))
  const ps = Math.max(1, Math.min(300, Math.floor(Number(slowPeriod)) || 21))
  const kf = 2 / (pf + 1)
  const ks = 2 / (ps + 1)
  const eps = 1e-12
  const thr = Math.max(0, Number.isFinite(Number(threshold)) ? Number(threshold) : 0.5)
  const clampOn = !!softClamp
  const clampScoreOn = !!softClampScore
  const boostOn = !!reversalBoost
  const boostFactor = Math.max(0, Math.min(5, Number.isFinite(Number(reversalBoostFactor)) ? Number(reversalBoostFactor) : 0.45))
  const volWeightOn = !!volumeWeighted
  const volN = Math.max(2, Math.min(500, Math.floor(Number(volumePeriod)) || 20))
  const winsorOn = !!winsorize
  const winsorAbs = Math.max(0.1, Math.min(100, Number.isFinite(Number(winsorLimit)) ? Number(winsorLimit) : 5.0))
  const preP = Math.max(1, Math.min(100, Math.floor(Number(preSmoothPeriod)) || 3))
  const preK = 2 / (preP + 1)
  const benchNoiseOn = !!benchmarkNoiseFilter
  const benchMinMoveRatio = Math.max(0, (Number.isFinite(Number(benchmarkMinMovePct)) ? Number(benchmarkMinMovePct) : 0.1) / 100)
  const clampDiv = Math.max(1e-9, Number.isFinite(Number(softClampDiv)) ? Number(softClampDiv) : 2.0)
  const clampRange = Math.max(1e-9, Number.isFinite(Number(softClampRange)) ? Number(softClampRange) : 3.0)

  const altSorted = [...altCandles]
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time)
  const benchSorted = [...benchCandles]
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time)
  if (altSorted.length < 1 || benchSorted.length < 2) {
    return { fast: [], slow: [], fastHist: [], slowHist: [], cumAboSeries: [], priceSeries: [] }
  }

  const sampled = []
  let ai = 0
  let lastAlt = Number.NaN
  for (const b of benchSorted) {
    const aiBefore = ai
    let volSumStep = 0
    while (ai < altSorted.length && altSorted[ai].time <= b.time) {
      lastAlt = altSorted[ai].close
      const vv = altSorted[ai].volume
      if (Number.isFinite(vv) && vv >= 0) {
        volSumStep += vv
      }
      ai++
    }
    if (sampled.length > 0 && ai === aiBefore) {
      continue
    }
    if (Number.isFinite(lastAlt) && lastAlt > 0) {
      sampled.push({ time: b.time, a: lastAlt, b: b.close, av: volSumStep })
    }
  }
  if (sampled.length < 2) {
    return { fast: [], slow: [], fastHist: [], slowHist: [], cumAboSeries: [], priceSeries: [] }
  }

  const smoothed = []
  let emaA = null
  let emaB = null
  for (const p of sampled) {
    emaA = emaA == null ? p.a : p.a * preK + emaA * (1 - preK)
    emaB = emaB == null ? p.b : p.b * preK + emaB * (1 - preK)
    smoothed.push({ ...p, aSm: emaA, bSm: emaB })
  }

  let sameSeries = true
  for (let i = 1; i < smoothed.length; i++) {
    const a = smoothed[i].aSm
    const b = smoothed[i].bSm
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-12 * Math.max(1, Math.abs(a), Math.abs(b))) {
      sameSeries = false
      break
    }
  }
  if (sameSeries) {
    const fast = []
    const slow = []
    const fastHist = []
    const slowHist = []
    const color = isDark ? '#9ca3af' : '#6b7280'
    const cumAboSeries = []
    const priceSeries = []
    for (let i = 1; i < smoothed.length; i++) {
      const t = smoothed[i].time
      fast.push({ time: t, value: 0 })
      slow.push({ time: t, value: 0 })
      fastHist.push({ time: t, value: 0, color })
      slowHist.push({ time: t, value: 0, color })
      cumAboSeries.push({ time: t, value: 0 })
      priceSeries.push({ time: t, value: smoothed[i].a })
    }
    return { fast, slow, fastHist, slowHist, cumAboSeries, priceSeries }
  }

  let upFast1 = null
  let upFast2 = null
  let downFast1 = null
  let downFast2 = null
  let upSlow1 = null
  let upSlow2 = null
  let downSlow1 = null
  let downSlow2 = null
  let boostedFast = null
  let boostedSlow = null
  let fastStreakUp = 0
  let fastStreakDown = 0
  let slowStreakUp = 0
  let slowStreakDown = 0
  const fast = []
  const slow = []
  const fastHist = []
  const slowHist = []
  const cumAboSeries = []
  const priceSeries = []
  let cumAbo = 0
  const volWindow = []
  let volSum = 0
  for (let i = 1; i < smoothed.length; i++) {
    const prev = smoothed[i - 1]
    const cur = smoothed[i]
    let altRet = (cur.aSm - prev.aSm) / prev.aSm
    const btcRet = (cur.bSm - prev.bSm) / prev.bSm

    let btcDirection = 0
    if (btcRet > eps) btcDirection = 1
    else if (btcRet < -eps) btcDirection = -1

    if (benchNoiseOn && Math.abs(btcRet) < benchMinMoveRatio) {
      btcDirection = 0
    }

    if (volWeightOn) {
      const v = Number.isFinite(cur.av) ? Math.max(0, cur.av) : 0
      volWindow.push(v)
      volSum += v
      if (volWindow.length > volN) {
        volSum -= volWindow.shift()
      }
      const denom = volWindow.length > 0 ? volSum / volWindow.length : 0
      if (denom > eps) {
        const volumeFactor = v / denom
        altRet *= volumeFactor
      }
    }

    const rawAlpha = (altRet - btcRet) * 100.0
    const winsorAlpha = winsorOn ? Math.max(-winsorAbs, Math.min(winsorAbs, rawAlpha)) : rawAlpha
    const cleanAlpha = clampOn ? Math.tanh(winsorAlpha / clampDiv) * clampRange : winsorAlpha

    cumAbo += cleanAlpha
    cumAboSeries.push({ time: cur.time, value: cumAbo })
    priceSeries.push({ time: cur.time, value: cur.a })

    if (btcDirection === 1) {
      upFast1 = upFast1 == null ? cleanAlpha : cleanAlpha * kf + upFast1 * (1 - kf)
      upFast2 = upFast2 == null ? upFast1 : upFast1 * kf + upFast2 * (1 - kf)
      upSlow1 = upSlow1 == null ? cleanAlpha : cleanAlpha * ks + upSlow1 * (1 - ks)
      upSlow2 = upSlow2 == null ? upSlow1 : upSlow1 * ks + upSlow2 * (1 - ks)
      if (downFast1 != null) {
        downFast1 *= 1 - kf
        downFast2 *= 1 - kf
      }
      if (downSlow1 != null) {
        downSlow1 *= 1 - ks
        downSlow2 *= 1 - ks
      }
    } else if (btcDirection === -1) {
      downFast1 = downFast1 == null ? cleanAlpha : cleanAlpha * kf + downFast1 * (1 - kf)
      downFast2 = downFast2 == null ? downFast1 : downFast1 * kf + downFast2 * (1 - kf)
      downSlow1 = downSlow1 == null ? cleanAlpha : cleanAlpha * ks + downSlow1 * (1 - ks)
      downSlow2 = downSlow2 == null ? downSlow1 : downSlow1 * ks + downSlow2 * (1 - ks)
      if (upFast1 != null) {
        upFast1 *= 1 - kf
        upFast2 *= 1 - kf
      }
      if (upSlow1 != null) {
        upSlow1 *= 1 - ks
        upSlow2 *= 1 - ks
      }
    } else {
      if (upFast1 != null) {
        upFast1 *= 1 - kf
        upFast2 *= 1 - kf
      }
      if (downFast1 != null) {
        downFast1 *= 1 - kf
        downFast2 *= 1 - kf
      }
      if (upSlow1 != null) {
        upSlow1 *= 1 - ks
        upSlow2 *= 1 - ks
      }
      if (downSlow1 != null) {
        downSlow1 *= 1 - ks
        downSlow2 *= 1 - ks
      }
    }

    const upFastDema = upFast1 == null ? 0 : 2 * upFast1 - upFast2
    const downFastDema = downFast1 == null ? 0 : 2 * downFast1 - downFast2
    const upSlowDema = upSlow1 == null ? 0 : 2 * upSlow1 - upSlow2
    const downSlowDema = downSlow1 == null ? 0 : 2 * downSlow1 - downSlow2

    let f = upFastDema + downFastDema
    let s = upSlowDema + downSlowDema
    if (clampScoreOn) {
      f = Math.tanh(f / clampDiv) * clampRange
      s = Math.tanh(s / clampDiv) * clampRange
    }

    if (boostOn) {
      if (boostedFast == null) {
        boostedFast = f
      } else {
        let df = f - boostedFast
        if (df > eps) {
          if (fastStreakDown > 0) {
            df *= 1 + fastStreakDown * boostFactor
            fastStreakDown = 0
            fastStreakUp = 1
          } else {
            fastStreakUp += 1
          }
        } else if (df < -eps) {
          if (fastStreakUp > 0) {
            df *= 1 + fastStreakUp * boostFactor
            fastStreakUp = 0
            fastStreakDown = 1
          } else {
            fastStreakDown += 1
          }
        }
        boostedFast += df
      }
      if (boostedSlow == null) {
        boostedSlow = s
      } else {
        let ds = s - boostedSlow
        if (ds > eps) {
          if (slowStreakDown > 0) {
            ds *= 1 + slowStreakDown * boostFactor
            slowStreakDown = 0
            slowStreakUp = 1
          } else {
            slowStreakUp += 1
          }
        } else if (ds < -eps) {
          if (slowStreakUp > 0) {
            ds *= 1 + slowStreakUp * boostFactor
            slowStreakUp = 0
            slowStreakDown = 1
          } else {
            slowStreakDown += 1
          }
        }
        boostedSlow += ds
      }
      f = boostedFast
      s = boostedSlow
    }

    fast.push({ time: cur.time, value: f })
    slow.push({ time: cur.time, value: s })

    let colorF = isDark ? '#9ca3af' : '#6b7280'
    if (f > thr) colorF = isDark ? '#22c55e' : '#16a34a'
    else if (f < -thr) colorF = isDark ? '#f87171' : '#dc2626'
    fastHist.push({ time: cur.time, value: f, color: colorF })

    let colorS = isDark ? '#9ca3af' : '#6b7280'
    if (s > thr) colorS = isDark ? '#22c55e' : '#16a34a'
    else if (s < -thr) colorS = isDark ? '#f87171' : '#dc2626'
    slowHist.push({ time: cur.time, value: s, color: colorS })
  }
  return { fast, slow, fastHist, slowHist, cumAboSeries, priceSeries }
}

/**
 * Wilder ATR（与常见「ATR14」一致）：TR 后做 RMA，递推 ATR_i = (ATR_{i-1}×(P−1)+TR_i)/P。
 * @param {{ t:number, h:number, l:number, c:number }[]} bars 升序 1m，t 为 bar 开盘 ms
 * @returns {(number|null)[]} 与 bars 等长；索引 &lt; P 处为 null；索引 P 起为有效 ATR（初值为 TR[1..P] 均值）
 */
export function wilderAtrArrayFrom1mBars(bars, period) {
  const P = Math.max(2, Math.min(200, Math.floor(Number(period)) || 14))
  const n = Array.isArray(bars) ? bars.length : 0
  const out = new Array(n).fill(null)
  if (n < 2) return out
  const tr = new Array(n).fill(NaN)
  for (let i = 1; i < n; i++) {
    const h = Number(bars[i].h)
    const l = Number(bars[i].l)
    const pc = Number(bars[i - 1].c)
    if (![h, l, pc].every((x) => Number.isFinite(x))) continue
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
  }
  let sum = 0
  for (let i = 1; i <= P && i < n; i++) {
    if (!Number.isFinite(tr[i])) return out
    sum += tr[i]
  }
  if (n <= P) return out
  let atr = sum / P
  out[P] = atr
  for (let i = P + 1; i < n; i++) {
    if (!Number.isFinite(tr[i])) {
      out[i] = out[i - 1]
      continue
    }
    atr = (atr * (P - 1) + tr[i]) / P
    out[i] = atr
  }
  return out
}

/**
 * BTC 主时钟点砖 + **动态 ATR 快照锁死**（Lopez de Prado 信息条思想）：每根新砖诞生时读取当前 Wilder ATR，
 * 本砖生命周期内阈值 S = ATR × mult 不变；达幅后切断，下一块再重新快照。
 * 与 {@link BtcPointBrickBarServiceImpl#buildBtcMasterClockPointBricks} 结构一致，仅将 |Δp/p|≥brickFrac 换为 |close−ref|≥S。
 *
 * @param {object} opts
 * @param {{ t:number, o?:number, h:number, l:number, c:number, v?:number, takerBuyBaseVolume?:number|null, takerBuyQuoteVolume?:number|null }[]} opts.masterOneM 基准合约 1m，升序
 * @param {Record<string, typeof opts.masterOneM>} opts.seriesBySymbol 各品种 1m；键含 masterSymbol 与主腿等
 * @param {string[]} opts.symbols 参与聚合的品种（含主腿与基准）
 * @param {string} opts.masterSymbol 时钟来源（如 BTCUSDT）
 * @param {number} [opts.atrPeriod=14]
 * @param {number} [opts.atrMult=0.5] 单砖阈值 = 快照 ATR × mult（价格绝对跳动）
 * @param {number} [opts.fallbackMovePercent=0.5] ATR 尚未就绪时暂用 ref×该百分数/100 的绝对跳动，避免死锁
 * @returns {Record<string, { t:number, o:number, h:number, l:number, c:number, v:number, takerBuyBaseVolume?:number, takerBuyQuoteVolume?:number }[]>}
 */
export function buildBtcMasterClockAtrSnapshotLockPointBricks(opts) {
  const masterOneM = opts?.masterOneM
  const seriesBySymbol = opts?.seriesBySymbol || {}
  const symbols = Array.isArray(opts?.symbols) ? opts.symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean) : []
  const masterSymbol = String(opts?.masterSymbol || '').trim().toUpperCase()
  const atrPeriod = Math.max(2, Math.min(200, Math.floor(Number(opts?.atrPeriod)) || 14))
  const atrMult = Number.isFinite(Number(opts?.atrMult)) ? Math.max(1e-8, Number(opts.atrMult)) : 0.5
  const fallbackMovePercent = Number.isFinite(Number(opts?.fallbackMovePercent))
    ? Math.max(0.01, Math.min(50, Number(opts.fallbackMovePercent)))
    : 0.5
  const out = {}
  for (const s of symbols) out[s] = []

  if (!masterOneM?.length || !masterSymbol || !symbols.includes(masterSymbol)) return out

  const master = [...masterOneM].sort((a, b) => Number(a.t) - Number(b.t))
  const atrArr = wilderAtrArrayFrom1mBars(master, atrPeriod)

  /** @type {Record<string, Map<number, any>>} */
  const indexByT = {}
  for (const sym of symbols) {
    const arr = seriesBySymbol[sym]
    const m = new Map()
    if (Array.isArray(arr)) {
      for (const row of arr) {
        const ts = Number(row.t)
        if (Number.isFinite(ts)) m.set(ts, row)
      }
    }
    indexByT[sym] = m
  }

  /** @type {Record<string, any[]>} */
  const buffers = {}
  for (const sym of symbols) buffers[sym] = []

  const mo0 = Number(master[0].o)
  const mc0 = Number(master[0].c)
  let ref = Number.isFinite(mo0) && mo0 > 0 ? mo0 : mc0
  if (!(ref > 0) || !Number.isFinite(ref)) return out

  let lockedAbs = null

  const takeFallbackAbs = (r, i) => {
    const atrv = atrArr[i]
    if (Number.isFinite(atrv) && atrv > 0) return atrv * atrMult
    return Math.max(1e-12, r * (fallbackMovePercent / 100))
  }

  const aggBucket = (bucket) => {
    if (!bucket?.length) return null
    const f = bucket[0]
    const l = bucket[bucket.length - 1]
    let h = Number.NEGATIVE_INFINITY
    let low = Number.POSITIVE_INFINITY
    let vol = 0
    let tbb = 0
    let tbq = 0
    let allTaker = true
    for (const m of bucket) {
      const hh = Number(m.h)
      const ll = Number(m.l)
      if (Number.isFinite(hh)) h = Math.max(h, hh)
      if (Number.isFinite(ll)) low = Math.min(low, ll)
      vol += Number.isFinite(Number(m.v)) ? Number(m.v) : 0
      const bvol = m.takerBuyBaseVolume
      const qvol = m.takerBuyQuoteVolume
      if (bvol != null && qvol != null && Number.isFinite(Number(bvol)) && Number.isFinite(Number(qvol))) {
        tbb += Number(bvol)
        tbq += Number(qvol)
      } else {
        allTaker = false
      }
    }
    const o = Number(f.o != null ? f.o : f.c)
    const c = Number(l.c)
    const openMs = Number(f.t)
    const endMs = Number(l.t)
    const closeMs = endMs + 60_000
    const durationMs = Math.max(0, closeMs - openMs)
    const row = {
      t: closeMs,
      o: Number.isFinite(o) ? o : c,
      h,
      l: low,
      c,
      v: vol,
      openMs,
      closeMs,
      durationMs,
    }
    if (allTaker) {
      row.takerBuyBaseVolume = tbb
      row.takerBuyQuoteVolume = tbq
    }
    return row
  }

  for (let i = 0; i < master.length; i++) {
    const mt = Number(master[i].t)
    if (!Number.isFinite(mt)) continue
    for (const sym of symbols) {
      const b = indexByT[sym].get(mt)
      if (b != null) buffers[sym].push(b)
    }
    const c = Number(master[i].c)
    if (!(c > 0) || !Number.isFinite(c)) continue

    if (lockedAbs == null) {
      lockedAbs = takeFallbackAbs(ref, i)
    }

    if (Math.abs(c - ref) < lockedAbs) continue

    for (const sym of symbols) {
      const jb = aggBucket(buffers[sym])
      if (jb != null) out[sym].push(jb)
      buffers[sym] = []
    }
    ref = c
    lockedAbs = takeFallbackAbs(ref, i)
  }

  for (const sym of symbols) {
    const jb = aggBucket(buffers[sym])
    if (jb != null) out[sym].push(jb)
    buffers[sym] = []
  }

  return out
}
