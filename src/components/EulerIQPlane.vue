<template>
  <div
    class="rounded-lg bg-white dark:bg-gray-900 space-y-1"
    :class="[
      isDark ? 'text-gray-100' : 'text-gray-900',
      embedded ? 'border-0 px-2 py-1.5' : 'border border-gray-200 px-3 py-2 dark:border-gray-600',
    ]"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h4 class="text-xs font-semibold tracking-tight">(I, Q) 复平面</h4>
      <p v-if="!embedded" class="text-[10px] text-gray-500 dark:text-gray-400 max-w-xl leading-snug">
        <span class="text-emerald-700 dark:text-emerald-300/90">在绘图区内移动鼠标</span>：吸附最近砖并显示 I/Q/A/θ/时间；<span class="text-sky-700 dark:text-sky-300/90">点击</span>锁定橙圈，并尝试把<strong>K 线时间轴</strong>滚到该砖附近。粉点 = <strong>最后一根砖</strong>。
      </p>
      <p v-else class="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
        悬停拾点 · 点击联动时间轴 · 粉点=最新砖
      </p>
    </div>
    <div class="relative">
      <svg
        ref="svgRef"
        :viewBox="`0 0 ${vbW} ${vbH}`"
        class="w-full block cursor-crosshair touch-none"
        :style="{ height: `${effSvgHeight}px`, minHeight: `${effSvgHeight}px` }"
        shape-rendering="geometricPrecision"
        @mousemove="onSvgMove"
        @mouseleave="onSvgLeave"
        @click="onSvgClick"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend.passive="onTouchEnd"
      >
        <defs>
          <clipPath :id="clipId">
            <rect :x="pad" :y="pad" :width="plotW" :height="plotH" />
          </clipPath>
        </defs>
        <!-- 绘图区底：I+右、Q+上 -->
        <rect :x="pad" :y="pad" :width="plotW" :height="plotH" :fill="plotBg" opacity="0.35" />
        <g opacity="0.14">
          <rect :x="pad + plotW / 2" :y="pad" :width="plotW / 2" :height="plotH / 2" :fill="q1" />
          <rect :x="pad" :y="pad" :width="plotW / 2" :height="plotH / 2" :fill="q2" />
          <rect :x="pad" :y="pad + plotH / 2" :width="plotW / 2" :height="plotH / 2" :fill="q3" />
          <rect :x="pad + plotW / 2" :y="pad + plotH / 2" :width="plotW / 2" :height="plotH / 2" :fill="q4" />
        </g>
        <circle
          v-if="circleR > 0"
          :cx="cx(0)"
          :cy="cy(0)"
          :r="circleR"
          fill="none"
          :stroke="noiseStroke"
          stroke-width="1.25"
          stroke-dasharray="6 5"
          opacity="0.85"
        />
        <line :x1="cx(bounds.xMin)" :y1="cy(0)" :x2="cx(bounds.xMax)" :y2="cy(0)" :stroke="axisStroke" stroke-width="1" />
        <line :x1="cx(0)" :y1="cy(bounds.yMax)" :x2="cx(0)" :y2="cy(bounds.yMin)" :stroke="axisStroke" stroke-width="1" />
        <text :x="cx(bounds.xMax) - 4" :y="cy(0) - 6" text-anchor="end" class="fill-gray-500 text-[11px] font-mono">I</text>
        <text :x="cx(0) + 6" :y="cy(bounds.yMax) + 14" text-anchor="start" class="fill-gray-500 text-[11px] font-mono">Q</text>

        <g :clip-path="`url(#${clipId})`">
          <path v-if="pathD" :d="pathD" fill="none" :stroke="trailStroke" stroke-width="1.35" stroke-linejoin="round" opacity="0.9" />
          <!-- 宽透明描边，便于手指/鼠标沿轨迹拾取 -->
          <path
            v-if="pathD"
            :d="pathD"
            fill="none"
            stroke="transparent"
            stroke-width="22"
            stroke-linejoin="round"
            pointer-events="stroke"
          />
        </g>

        <g v-if="crosshair.show" pointer-events="none" opacity="0.45">
          <line :x1="crosshair.sx" :y1="pad" :x2="crosshair.sx" :y2="pad + plotH" :stroke="axisStroke" stroke-dasharray="4 3" />
          <line :x1="pad" :y1="crosshair.sy" :x2="pad + plotW" :y2="crosshair.sy" :stroke="axisStroke" stroke-dasharray="4 3" />
        </g>

        <circle
          v-if="hoverPt"
          :cx="hoverPt.sx"
          :cy="hoverPt.sy"
          r="7"
          fill="none"
          :stroke="hoverRing"
          stroke-width="2"
          pointer-events="none"
        />
        <circle
          v-if="selectedPt"
          :cx="selectedPt.sx"
          :cy="selectedPt.sy"
          r="9"
          fill="none"
          stroke="#f97316"
          stroke-width="2.5"
          pointer-events="none"
        />
        <circle v-if="last" :cx="cx(last.I)" :cy="cy(last.Q)" r="5" :fill="headFill" stroke="#fff" stroke-width="1.5" pointer-events="none" />
      </svg>

      <div
        v-show="tooltip.show && tooltip.lines?.length"
        class="pointer-events-none fixed z-[60] max-w-[min(92vw,280px)] rounded-md border px-2.5 py-1.5 text-[11px] leading-snug shadow-lg font-mono"
        :class="isDark ? 'border-gray-600 bg-gray-900/95 text-gray-100' : 'border-gray-300 bg-white/95 text-gray-800'"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div v-for="(ln, i) in tooltip.lines" :key="i">{{ ln }}</div>
      </div>
    </div>

    <div class="text-[10px] font-mono text-gray-600 dark:text-gray-300 flex flex-wrap gap-x-4 gap-y-0.5">
      <span>A={{ fmt(last?.A) }}</span>
      <span>θ={{ deg(last?.theta) }}°</span>
      <span>Δθ={{ deg(last?.dTheta) }}°/砖</span>
      <span v-if="hasSpiralData" :style="{ color: spiralColor }">σ={{ fmt4(last?.sigmaSmoothed) }} {{ spiralLabel }}</span>
      <span v-if="hasSpiralData">ω={{ deg(last?.omega) }}°/砖</span>
      <span class="text-gray-500">R={{ fmtR(noiseRadius) }} 杂讯界</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const clipId = `euler-clip-${Math.random().toString(36).slice(2, 11)}`

const props = defineProps({
  /** {@link eulerEnrichWithDeltaTheta} 输出 */
  points: { type: Array, default: () => [] },
  noiseRadius: { type: Number, default: 1.5 },
  isDark: { type: Boolean, default: false },
  svgHeight: { type: Number, default: 228 },
  /** 叠在 K 线主图上的紧凑卡片（外边距/说明更短） */
  embedded: { type: Boolean, default: false },
})

const effSvgHeight = computed(() => {
  const h = Number(props.svgHeight)
  if (Number.isFinite(h) && h >= 80) return Math.floor(h)
  return props.embedded ? 168 : 228
})

const emit = defineEmits(['brickPick'])

const svgRef = ref(null)
/** trail 数组下标；−1 无 */
const hoverTrailIdx = ref(-1)
const selectedTrailIdx = ref(-1)
const tooltip = ref({ show: false, x: 0, y: 0, lines: [] })
const crosshair = ref({ show: false, sx: 0, sy: 0 })

const vbW = 420
const vbH = 260
const pad = 36
const plotW = vbW - 2 * pad
const plotH = vbH - 2 * pad
/** 吸附半径（viewBox 单位，约等于屏上十几像素） */
const PICK_R2 = 22 * 22

const plotBg = computed(() => (props.isDark ? '#313244' : '#e2e8f0'))
const q1 = computed(() => (props.isDark ? '#22c55e' : '#86efac'))
const q2 = computed(() => (props.isDark ? '#f87171' : '#fca5a5'))
const q3 = computed(() => (props.isDark ? '#a78bfa' : '#c4b5fd'))
const q4 = computed(() => (props.isDark ? '#38bdf8' : '#7dd3fc'))
const axisStroke = computed(() => (props.isDark ? '#64748b' : '#94a3b8'))
const noiseStroke = computed(() => (props.isDark ? '#fbbf24' : '#d97706'))
const trailStroke = computed(() => (props.isDark ? '#818cf8' : '#4f46e5'))
const headFill = computed(() => (props.isDark ? '#f472b6' : '#db2777'))
const hoverRing = computed(() => (props.isDark ? '#e2e8f0' : '#0f172a'))

const trail = computed(() => {
  const arr = Array.isArray(props.points) ? props.points : []
  const maxN = 4000
  return arr.length > maxN ? arr.slice(-maxN) : arr
})

const trailBaseIndex = computed(() => {
  const full = Array.isArray(props.points) ? props.points.length : 0
  return Math.max(0, full - trail.value.length)
})

const bounds = computed(() => {
  const R = Math.max(0.5, Math.min(12, Number(props.noiseRadius) || 1.5))
  let m = R * 1.25
  for (const p of trail.value) {
    const ai = Math.abs(Number(p?.I))
    const aq = Math.abs(Number(p?.Q))
    if (Number.isFinite(ai)) m = Math.max(m, ai)
    if (Number.isFinite(aq)) m = Math.max(m, aq)
  }
  m = Math.min(16, Math.max(m, 1.2))
  return { xMin: -m, xMax: m, yMin: -m, yMax: m }
})

function cx(I) {
  const { xMin: a, xMax: b } = bounds.value
  return pad + ((I - a) / (b - a)) * plotW
}

function cy(Q) {
  const { yMin: lo, yMax: hi } = bounds.value
  return pad + ((hi - Q) / (hi - lo)) * plotH
}

const circleR = computed(() => {
  const R = Math.max(0.5, Math.min(12, Number(props.noiseRadius) || 1.5))
  const { xMin: a, xMax: b } = bounds.value
  const span = b - a
  if (!(span > 1e-12)) return 0
  return (R / span) * plotW
})

const pathD = computed(() => {
  const pts = trail.value
  if (!pts.length) return ''
  let d = ''
  for (let i = 0; i < pts.length; i++) {
    const I = Number(pts[i]?.I)
    const Q = Number(pts[i]?.Q)
    if (!Number.isFinite(I) || !Number.isFinite(Q)) continue
    const x = cx(I)
    const y = cy(Q)
    d += d === '' ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d
})

const last = computed(() => {
  const pts = trail.value
  if (!pts.length) return null
  return pts[pts.length - 1]
})

function fmt(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(3)
}

function fmt4(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(4)
}

const hasSpiralData = computed(() => {
  const l = last.value
  return l && Number.isFinite(Number(l?.sigmaSmoothed))
})

const spiralLabel = computed(() => {
  const l = last.value
  if (!l) return ''
  const phase = l.spiralPhase
  if (phase === 'expanding') return '发散↗'
  if (phase === 'contracting') return '收敛↘'
  return '极限环⟳'
})

const spiralColor = computed(() => {
  const l = last.value
  if (!l) return ''
  const phase = l.spiralPhase
  const dark = props.isDark
  if (phase === 'expanding') return dark ? '#4ade80' : '#16a34a'
  if (phase === 'contracting') return dark ? '#f87171' : '#dc2626'
  return dark ? '#facc15' : '#ca8a04'
})

function fmtR(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

function deg(rad) {
  const n = Number(rad)
  if (!Number.isFinite(n)) return '—'
  return (n * (180 / Math.PI)).toFixed(1)
}

function formatUtc(sec) {
  const t = Number(sec)
  if (!Number.isFinite(t)) return '—'
  try {
    return new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + 'Z'
  } catch {
    return '—'
  }
}

function clientToSvg(e) {
  const el = svgRef.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const rw = Math.max(1e-6, r.width)
  const rh = Math.max(1e-6, r.height)
  const x = ((e.clientX - r.left) / rw) * vbW
  const y = ((e.clientY - r.top) / rh) * vbH
  return { x, y, clientX: e.clientX, clientY: e.clientY }
}

function nearestInTrail(sx, sy) {
  const pts = trail.value
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const I = Number(pts[i]?.I)
    const Q = Number(pts[i]?.Q)
    if (!Number.isFinite(I) || !Number.isFinite(Q)) continue
    const px = cx(I)
    const py = cy(Q)
    const d2 = (sx - px) ** 2 + (sy - py) ** 2
    if (d2 < bestD) {
      bestD = d2
      best = i
    }
  }
  if (best < 0 || bestD > PICK_R2) return -1
  return best
}

function buildTooltipLines(trailIdx) {
  if (trailIdx < 0) return []
  const p = trail.value[trailIdx]
  if (!p) return []
  const g = trailBaseIndex.value + trailIdx + 1
  const n = Array.isArray(props.points) ? props.points.length : trail.value.length
  const lines = [
    `砖序 ${g} / ${n}`,
    `UTC ${formatUtc(p.time)}`,
    `I=${fmt(p.I)}  Q=${fmt(p.Q)}  A=${fmt(p.A)}`,
    `θ=${deg(p.theta)}°  Δθ=${deg(p.dTheta)}°/砖`,
  ]
  if (Number.isFinite(Number(p?.sigmaSmoothed))) {
    const ph = p.spiralPhase === 'expanding' ? '发散↗' : p.spiralPhase === 'contracting' ? '收敛↘' : '极限环⟳'
    lines.push(`σ=${fmt4(p.sigmaSmoothed)}  ω=${deg(p.omega)}°/砖  ${ph}`)
  }
  return lines
}

function updateHoverFromEvent(e) {
  const t = clientToSvg(e)
  if (!t) return
  if (t.x < pad || t.x > pad + plotW || t.y < pad || t.y > pad + plotH) {
    hoverTrailIdx.value = -1
    crosshair.value = { show: false, sx: 0, sy: 0 }
    tooltip.value = { show: false, x: 0, y: 0, lines: [] }
    return
  }
  const ni = nearestInTrail(t.x, t.y)
  hoverTrailIdx.value = ni
  if (ni >= 0) {
    const p = trail.value[ni]
    crosshair.value = { show: true, sx: cx(p.I), sy: cy(p.Q) }
    tooltip.value = {
      show: true,
      x: Math.min(window.innerWidth - 300, t.clientX + 14),
      y: Math.min(window.innerHeight - 120, t.clientY + 14),
      lines: buildTooltipLines(ni),
    }
  } else {
    crosshair.value = { show: false, sx: 0, sy: 0 }
    tooltip.value = { show: false, x: t.clientX, y: t.clientY, lines: [] }
  }
}

function onSvgMove(e) {
  updateHoverFromEvent(e)
}

function onSvgLeave() {
  hoverTrailIdx.value = -1
  crosshair.value = { show: false, sx: 0, sy: 0 }
  tooltip.value = { show: false, x: 0, y: 0, lines: [] }
}

function commitPick(ni) {
  if (ni < 0) {
    selectedTrailIdx.value = -1
    return
  }
  if (selectedTrailIdx.value === ni) {
    selectedTrailIdx.value = -1
    return
  }
  selectedTrailIdx.value = ni
  const p = trail.value[ni]
  const globalIdx = trailBaseIndex.value + ni
  emit('brickPick', {
    time: p.time,
    trailIndex: ni,
    globalIndex: globalIdx,
    I: p.I,
    Q: p.Q,
    A: p.A,
    theta: p.theta,
    dTheta: p.dTheta,
  })
}

function onSvgClick(e) {
  const t = clientToSvg(e)
  if (!t || t.x < pad || t.x > pad + plotW || t.y < pad || t.y > pad + plotH) {
    selectedTrailIdx.value = -1
    return
  }
  const ni = nearestInTrail(t.x, t.y)
  commitPick(ni)
}

function onTouchStart(e) {
  const touch = e.touches?.[0]
  if (!touch) return
  updateHoverFromEvent(touch)
}

function onTouchMove(e) {
  const touch = e.touches?.[0]
  if (!touch) return
  updateHoverFromEvent(touch)
}

function onTouchEnd() {
  commitPick(hoverTrailIdx.value)
}

const hoverPt = computed(() => {
  const i = hoverTrailIdx.value
  if (i < 0) return null
  const p = trail.value[i]
  if (!p) return null
  return { sx: cx(p.I), sy: cy(p.Q) }
})

const selectedPt = computed(() => {
  const i = selectedTrailIdx.value
  if (i < 0) return null
  const p = trail.value[i]
  if (!p) return null
  return { sx: cx(p.I), sy: cy(p.Q) }
})

watch(
  () => props.points,
  () => {
    selectedTrailIdx.value = -1
    hoverTrailIdx.value = -1
    tooltip.value = { show: false, x: 0, y: 0, lines: [] }
    crosshair.value = { show: false, sx: 0, sy: 0 }
  },
  { deep: true }
)
</script>
