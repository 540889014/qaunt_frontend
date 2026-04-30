<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <NavBar />
    <div class="p-4 sm:p-6 mx-auto max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        （策略优化）单边欧拉 · OI 加权（成交额砖 + 5m metrics）
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
        <span class="block">
          砖石线在<strong>浏览器内</strong>由本地 <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">*_1m.jbar</code> 按<strong>累计 USDT 成交额</strong>划窗（默认每约 500 万 U 收一根，可调）；与 1m 点砖页相比仅<strong>切砖时钟</strong>不同，<strong>Q / I / metrics / 四维盘 / 回测</strong>逻辑一致。<strong>Q</strong>=主腿砖收益 Z，
          <strong>I</strong>=净吃单累积 CVD 的 EMA 再 Z；<strong>metrics</strong> 仅 Vision
          <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">_5m_metrics.jbar</code>（持仓增量 ΔOI→W<sub>oi</sub>，大户比→P<sub>whale</sub>），按砖收时间前向对齐，每 5 分钟更新一次 OI 信息。
          <strong>第四维（置信乘子）</strong>：几何能量 A<sub>geom</sub> 默认 √(I<sub>eff</sub><sup>2</sup> + Q<sup>2</sup>)（与 CVD 滞后配对时 I 为 I<sub>t−k</sub>；见下可选马氏 / Morlet 替换）；P<sub>whale</sub>、P<sub>trend</sub> 各为 tanh 启发式 ∈ [0.5,1.5]；H&gt;0 时 <strong>P<sub>bayes</sub> = clip(P<sub>whale</sub>×P<sub>trend</sub>, 0.5, 2)</strong>，否则 P<sub>bayes</sub>=P<sub>whale</sub>；可选 1m 波动阻尼 <strong>W<sub>vol</sub>∈(0,1]</strong>（κ=V/ATR<sub>1m</sub>，κ&gt;τ 时 W=τ/κ）；<strong>A<sub>final</sub> = A<sub>geom</sub> × P<sub>bayes</sub> × W<sub>vol</sub></strong>。
          可选 <strong>CVD 相位滞后 k 砖</strong>：用 I<sub>eff,t−k</sub> 与当前 Q<sub>t</sub> 组对（量在价先）。
          可选 <strong>马氏窗 W 砖</strong>（≥2）：用窗内 (I,Q) 协方差逆度量替代欧氏 A<sub>geom</sub>（与 Morlet 互斥）。
          可选 <strong>Morlet 式高斯窗</strong>（窗长≥3 砖、σ 为砖上尺度）：对过去若干砖的 (I,Q) 复向量做高斯权重和，取局部复振幅的模作 A<sub>geom</sub>，θ 与 PDO 与该局部复向量一致，突出短时脉冲、弱化长横盘（连续 Morlet 中高斯包络的离散类比）。
          可选 <strong>三维螺旋相空间</strong>：在 I–Q 平面能量 A<sub>xy</sub> 之外增加环境轴 Z（OI 水位、ΔOI 或砖 TR，均经与 I/Q 相同的滚动样本 Z），总能量 <strong>A<sub>geom</sub> = √(A<sub>xy</sub><sup>2</sup> + Z<sup>2</sup>)</strong>，便于区分「XY 高能但环境轴不起」与「三轴同向共振」。
          主图下可叠<strong>经典 MACD</strong>（收盘 EMA，DIF/DEA/柱）；主图可叠<strong>布林带</strong>（收盘滚动均值 ± kσ，与 Jbar 一致）。
        </span>
        <span class="block text-amber-800 dark:text-amber-200">
          请先在同目录准备主合约 1m 与 <code class="text-xs">币安历史 K 线</code> 页下载的 metrics；时间范围与砖查询重叠，否则 OI 权重视为 1。
        </span>
        <span class="block mt-2 text-indigo-900 dark:text-indigo-200">
          <strong>本页策略优化</strong>：与「1m 点砖」策略优化页相同——默认仅对 <strong>I</strong> 作短 EMA；<strong>Q</strong> 不跨砖平滑。可选<strong>施密特 + 价格熔断</strong>。参数见「量化抖动抑制」。
          <span class="block mt-1 text-sm">
            <strong>下一砖变色龙（惯性 θ+Δθ）</strong>：加载砖后出现于四维区（与点砖优化页一致）。
          </span>
        </span>
      </p>

      <section class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-3">参数与加载</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          成交额砖在点击「加载」时由 1m 数据在<strong>浏览器内</strong>聚合，无需服务端「重构点砖」写盘。
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">每根砖目标成交额（USDT）</label>
            <input
              v-model.number="form.quoteVolumeThresholdUsdt"
              type="number"
              min="100000"
              max="500000000"
              step="100000"
              class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
            />
            <span class="text-xs text-gray-500">例如 5000000 = 约 500 万 U 一根</span>
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">主合约</label>
            <n-select v-model:value="form.symbol" filterable tag placeholder="BTCUSDT" :options="symbolOptions" class="w-full" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">基准（对齐用）</label>
            <n-select v-model:value="form.benchmarkSymbol" filterable tag placeholder="BTCUSDT" :options="symbolOptions" class="w-full" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">limit</label>
            <input v-model.number="form.limit" type="number" min="100" max="50000" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">开始</label>
            <input v-model="form.startAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label class="block text-sm text-gray-700 dark:text-gray-200 mb-1">结束</label>
            <input v-model="form.endAt" type="datetime-local" class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800" />
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            :disabled="queryLoading"
            @click="doLoadBars"
          >
            {{ queryLoading ? '加载中…' : '加载砖 + metrics + 绘图' }}
          </button>
        </div>
        <p v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <p v-else-if="meta" class="mt-2 text-xs text-gray-500 font-mono break-all">
          砖 {{ meta.count ?? bars.length }} 根 · metrics {{ metricsBars.length }} 条 · {{ meta.jbarPath || '' }}
        </p>
      </section>

      <section v-if="dashboardRows.length && benchmarkBars.length" class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-2">欧拉 / 静风阈 / Z 窗</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">欧拉 Z 窗（砖）</label>
            <input v-model.number="profile.eulerZWindow" type="number" min="2" max="2000" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">变色龙 min A（静风灰）</label>
            <input v-model.number="profile.eulerChameleonMinA" type="number" min="0" step="0.1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">Z σ 波动地板比</label>
            <input v-model.number="profile.eulerZVolatilityFloorRatio" type="number" min="0" step="0.05" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">CVD EMA 周期 P</label>
            <input v-model.number="profile.cvdMomentumEmaPeriod" type="number" min="1" max="500" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">CVD 相位滞后 k（砖，0 关闭）</label>
            <input v-model.number="profile.cvdPhaseLagBricks" type="number" min="0" max="20" step="1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">贝叶斯大级别趋势 H（砖，0 仅大户比）</label>
            <input v-model.number="profile.bayesHtfLagBricks" type="number" min="0" max="500" step="1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">欧拉马氏窗 W（砖，0～1 欧氏；与 Morlet 互斥）</label>
            <input v-model.number="profile.eulerMahaWindow" type="number" min="0" max="500" step="1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">Morlet 高斯窗（砖，≥3 启用；0 关闭；局部脉冲能量）</label>
            <input v-model.number="profile.eulerMorletWindow" type="number" min="0" max="500" step="1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">Morlet σ（砖，建议 1.5～4）</label>
            <input v-model.number="profile.eulerMorletSigma" type="number" min="0.25" max="50" step="0.25" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">三维相空间 Z 轴（0=纯 I–Q；1=OI 水位；2=ΔOI；3=砖 TR）</label>
            <select
              v-model.number="profile.eulerPhaseSpaceZ"
              class="w-full px-2 py-1 border rounded dark:bg-gray-900 bg-white dark:bg-gray-900 text-sm"
            >
              <option :value="0">关闭</option>
              <option :value="1">OI 未平仓（metrics 水位）Z</option>
              <option :value="2">ΔOI（5m 相邻样本）Z</option>
              <option :value="3">砖真实波幅 TR Z</option>
            </select>
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">1m 波动阻尼 τ（0 关闭，建议 2～3）</label>
            <input v-model.number="profile.volDampenTau" type="number" min="0" max="10" step="0.1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">1m ATR 均窗 P（根）</label>
            <input v-model.number="profile.volDampenAtrPeriod" type="number" min="2" max="500" step="1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
          </div>
          <div class="flex items-end gap-2">
            <label class="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-1 cursor-pointer">
              <input v-model="profile.showMacd" type="checkbox" class="rounded border-gray-400" />
              <span>显示 MACD</span>
            </label>
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">MACD 快 / 慢 / 信号</label>
            <div class="flex gap-1">
              <input v-model.number="profile.macdFastPeriod" type="number" min="2" max="200" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900 text-xs" :disabled="!profile.showMacd" />
              <input v-model.number="profile.macdSlowPeriod" type="number" min="3" max="300" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900 text-xs" :disabled="!profile.showMacd" />
              <input v-model.number="profile.macdSignalPeriod" type="number" min="2" max="100" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900 text-xs" :disabled="!profile.showMacd" />
            </div>
          </div>
          <div class="flex items-end gap-2">
            <label class="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-1 cursor-pointer">
              <input v-model="profile.showBollinger" type="checkbox" class="rounded border-gray-400" />
              <span>布林带</span>
            </label>
          </div>
          <div>
            <label class="block text-gray-600 dark:text-gray-300 mb-1">布林周期 / 倍数 k</label>
            <div class="flex gap-1">
              <input v-model.number="profile.bollingerPeriod" type="number" min="2" max="200" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900 text-xs" :disabled="!profile.showBollinger" />
              <input v-model.number="profile.bollingerMult" type="number" min="0.5" max="6" step="0.1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900 text-xs" :disabled="!profile.showBollinger" />
            </div>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">螺旋结构 · 复频域 (Complex Frequency)</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            z(t) = A₀ · e<sup>(σ+iω)t</sup>。<strong>σ</strong> = d ln(A)/dt 为能量增长/衰减率：<span class="text-emerald-600 dark:text-emerald-400 font-medium">σ&gt;+δ 发散螺旋（主升/主跌浪）</span>、<span class="text-red-600 dark:text-red-400 font-medium">σ&lt;−δ 收敛螺旋（动能衰竭）</span>、<span class="text-yellow-600 dark:text-yellow-400 font-medium">|σ|≤δ 极限环（箱体震荡）</span>。<strong>ω</strong> = dθ/dt 为角速度（°/砖）。
            平滑模式：<strong>ZLEMA</strong>（零延迟，默认）通过动量补偿 Data+(Data−Data<sub>lag</sub>) 消除 EMA 滞后；<strong>HMA</strong>（赫尔）用 2×WMA(P/2)−WMA(P) 再 WMA(√P) 进一步削减延迟；<strong>EMA</strong> 为经典指数平滑（滞后最大）。
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div class="flex items-end gap-2">
              <label class="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-1 cursor-pointer">
                <input v-model="profile.showSpiral" type="checkbox" class="rounded border-gray-400" />
                <span>显示螺旋窗格 σ / ω</span>
              </label>
            </div>
            <div>
              <label class="block text-gray-600 dark:text-gray-300 mb-1">σ 平滑模式</label>
              <select
                v-model="profile.spiralSigmaSmoothMode"
                class="w-full px-2 py-1 border rounded dark:bg-gray-900 bg-white text-sm"
                :disabled="!profile.showSpiral"
              >
                <option value="zlema">ZLEMA（零延迟 EMA）</option>
                <option value="hma">HMA（赫尔均线）</option>
                <option value="ema">EMA（经典，滞后大）</option>
              </select>
            </div>
            <div>
              <label class="block text-gray-600 dark:text-gray-300 mb-1">σ 平滑周期 P</label>
              <input v-model.number="profile.spiralSigmaSmooth" type="number" min="0" max="100" step="1" class="w-full px-2 py-1 border rounded dark:bg-gray-900" :disabled="!profile.showSpiral" />
            </div>
            <div>
              <label class="block text-gray-600 dark:text-gray-300 mb-1">σ 相态门槛 δ</label>
              <input v-model.number="profile.spiralSigmaThreshold" type="number" min="0.001" max="1" step="0.005" class="w-full px-2 py-1 border rounded dark:bg-gray-900" :disabled="!profile.showSpiral" />
            </div>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">量化抖动抑制（EMA + 施密特）</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <strong>方案一</strong>：仅对 <strong>I</strong> 轨做短 EMA；<strong>Q</strong> 保持当砖真实收益 Z，避免跨零轴平滑滞后导致「砖涨却判红」。<strong>方案二</strong>：施密特迟滞 + <strong>熔断</strong>——价格：锁红且 Q&gt;0、锁绿且 Q&lt;0 时强制跟进 classify；<strong>I 侧</strong>：锁绿且 A≥保持阈时若判为紫(2)、锁红且 A≥保持阈时若判为黄(4)，打断非对向锁存。主图与简易回测（施密特开时）同口径。
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <label class="block text-gray-600 dark:text-gray-300 mb-1">I 轨 EMA 周期（&lt;2 关闭；Q 不平滑）</label>
              <input
                v-model.number="profile.eulerAntiJitterEmaPeriod"
                type="number"
                min="0"
                max="21"
                step="1"
                class="w-full px-2 py-1 border rounded dark:bg-gray-900"
              />
            </div>
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2 text-gray-600 dark:text-gray-300 cursor-pointer">
                <input v-model="profile.eulerSchmittEnabled" type="checkbox" class="rounded border-gray-400" />
                <span>施密特触发器</span>
              </label>
            </div>
            <div>
              <label class="block text-gray-600 dark:text-gray-300 mb-1">进入象限 A ≥（aEnter）</label>
              <input
                v-model.number="profile.eulerSchmittAEnter"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                class="w-full px-2 py-1 border rounded dark:bg-gray-900"
                :disabled="!profile.eulerSchmittEnabled"
              />
            </div>
            <div>
              <label class="block text-gray-600 dark:text-gray-300 mb-1">维持 A ≥（aHold，低于则解锁）</label>
              <input
                v-model.number="profile.eulerSchmittAHold"
                type="number"
                min="0.05"
                max="10"
                step="0.05"
                class="w-full px-2 py-1 border rounded dark:bg-gray-900"
                :disabled="!profile.eulerSchmittEnabled"
              />
            </div>
          </div>
        </div>
        <RenkoFourPaneDashboard
          dashboard-heading="单边 OI 加权欧拉 · 四维盘（成交额砖）"
          :rows="dashboardRows"
          :benchmark-bars="benchmarkBars"
          :profile="profile"
          :height="Math.max(720, Number(profile.chartHeight) || 920)"
          :avi-period="profile.eulerZWindow"
          :cvd-momentum-ema-period="profile.cvdMomentumEmaPeriod"
          :euler-consensus-a="profile.eulerConsensusA"
          :custom-euler-points="eulerOiDisplayPoints"
          :custom-euler-chameleon-paint-quadrants="eulerChameleonPaintQuadrants"
        />
        <div
          v-if="eulerOiRawPoints.length"
          class="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40"
        >
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">简易回测（主腿收价 · 百分比盈亏）</h3>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
            象限与主图变色龙一致（1 绿 / 2 紫 / 3 红 / 4 黄）；开多/开空象限可<strong>多选</strong>（并集触发），不勾选表示该方向不做。盈亏 = 多 (平−开)/开、空 (开−平)/开；最后一根若有未平仓位则<strong>尾盘强平</strong>。不含手续费与滑点。
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end text-sm mb-3">
            <div class="sm:col-span-2 lg:col-span-1">
              <label class="block text-gray-600 dark:text-gray-300 mb-1">开多（象限，多选）</label>
              <div class="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border rounded dark:bg-gray-900 bg-white text-xs">
                <label
                  v-for="opt in eulerBacktestQuadCheckboxOptions"
                  :key="'Lq' + opt.v"
                  class="inline-flex items-center gap-1 cursor-pointer text-gray-700 dark:text-gray-200"
                >
                  <input v-model="profile.eulerBacktestOpenLongQuads" type="checkbox" :value="opt.v" class="rounded border-gray-400" />
                  <span>{{ opt.shortLabel }}</span>
                </label>
              </div>
            </div>
            <div class="sm:col-span-2 lg:col-span-1">
              <label class="block text-gray-600 dark:text-gray-300 mb-1">开空（象限，多选）</label>
              <div class="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border rounded dark:bg-gray-900 bg-white text-xs">
                <label
                  v-for="opt in eulerBacktestQuadCheckboxOptions"
                  :key="'Sq' + opt.v"
                  class="inline-flex items-center gap-1 cursor-pointer text-gray-700 dark:text-gray-200"
                >
                  <input v-model="profile.eulerBacktestOpenShortQuads" type="checkbox" :value="opt.v" class="rounded border-gray-400" />
                  <span>{{ opt.shortLabel }}</span>
                </label>
              </div>
            </div>
            <div class="sm:col-span-2 lg:col-span-2">
              <label class="block text-gray-600 dark:text-gray-300 mb-1">平仓</label>
              <select
                v-model="profile.eulerBacktestExitMode"
                class="w-full px-2 py-1 border rounded dark:bg-gray-900 bg-white text-sm min-w-0"
              >
                <option value="grey_fuse">
                  静风灰平 + 反向熔断（多：灰或红3 平；空：灰或绿1 平）
                </option>
                <option value="grey_only">仅静风灰平仓（无反向熔断 · 旧版）</option>
                <option value="leave_zone">离开所选象限范围即平（多选并集）</option>
              </select>
            </div>
          </div>
          <template v-if="eulerOiBacktestResult">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              信号与主腿收价均在当根收盘确定（不向未来取数）；合计为各笔<strong>净</strong>收益率 % 算术相加，非复利净值。选「静风+反向熔断」时：多单除静风灰外，遇<strong>红柱 Q3</strong>即平；空单除静风灰外，遇<strong>绿柱 Q1</strong>即平；紫/黄不单独触发平仓。
            </p>
            <div class="flex flex-wrap items-end gap-3 mb-2 text-sm">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">一开一平手续费（百分点，0=不扣）</label>
                <input
                  v-model.number="profile.eulerBacktestFeeRoundTripPct"
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  class="w-28 px-2 py-1 border rounded dark:bg-gray-900 text-sm"
                />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 pb-1">
                默认 0.1 = 单边 0.05%×2；每笔毛收益减该值得到净收益。
              </p>
            </div>
            <p class="text-sm text-gray-800 dark:text-gray-100 mb-1">
              毛合计（无手续费，算术相加）：
              <span class="font-medium tabular-nums">{{ eulerOiBacktestResult.sumPnlPctGross.toFixed(2) }}%</span>
              <span class="text-gray-500 dark:text-gray-400 text-xs ml-2">
                净合计（已扣每笔 {{ eulerOiBacktestResult.feeRoundTripPct }}%）：
              </span>
              <strong
                class="tabular-nums"
                :class="eulerOiBacktestResult.sumPnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ eulerOiBacktestResult.sumPnlPct.toFixed(2) }}%
              </strong>
              <span class="text-gray-500 dark:text-gray-400 text-xs ml-2">
                笔数 {{ eulerOiBacktestResult.tradeCount }} · 盈利笔（净）{{ eulerOiBacktestResult.winCount }}
              </span>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              核对：本模型为每笔毛收益 <strong>减去固定 {{ eulerOiBacktestResult.feeRoundTripPct }} 个百分点</strong>（非按名义乘费率），故合计约减少
              <strong class="tabular-nums">{{ (eulerOiBacktestResult.tradeCount * eulerOiBacktestResult.feeRoundTripPct).toFixed(2) }}</strong>
              个百分点（{{ eulerOiBacktestResult.tradeCount }}×{{ eulerOiBacktestResult.feeRoundTripPct }}）；高频小盈笔会大量变亏，属该口径下的正常结果。信号开平仓逻辑未改。
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">累计盈利点数 %（阶跃折线，横轴为砖收时间）</p>
            <div
              ref="eulerBacktestPnlChartEl"
              class="mt-1 mb-3 w-full min-h-[200px] h-[200px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-slate-950"
            />
            <div v-if="eulerOiBacktestResult.trades.length" class="overflow-x-auto max-h-56 border border-gray-200 dark:border-gray-600 rounded">
              <table class="min-w-full text-xs">
                <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th class="px-2 py-1 text-left font-medium">方向</th>
                    <th class="px-2 py-1 text-right font-medium">净 %</th>
                    <th class="px-2 py-1 text-right font-medium text-gray-500">毛 %</th>
                    <th class="px-2 py-1 text-left font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(tr, ti) in eulerOiBacktestResult.trades" :key="ti" class="border-t border-gray-100 dark:border-gray-700">
                    <td class="px-2 py-1">{{ tr.side === 'long' ? '多' : '空' }}</td>
                    <td class="px-2 py-1 text-right" :class="tr.pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
                      {{ tr.pnlPct.toFixed(2) }}
                    </td>
                    <td class="px-2 py-1 text-right text-gray-500">{{ Number(tr.pnlPctGross).toFixed(2) }}</td>
                    <td class="px-2 py-1 text-gray-500">{{ tr.eod ? '尾盘强平' : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <div class="mt-5 pt-4 border-t border-gray-200 dark:border-gray-600">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">简易回测 · 静风震荡（紫空 / 黄多）</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
              仅当 <strong>A &lt; 变色龙 min A</strong>（与左侧「欧拉 consensus / 变色龙 min A」一致）视为静风灰柱；在此区间内按 I,Q 的<strong>原始象限</strong>判
              <strong>2 紫开空</strong>、<strong>4 黄开多</strong>（主图虽为灰仍可区分）。平仓：变色（不再为 2 / 4）、走出静风、或达到最长持仓砖数；先平后开，当根收价。
            </p>
            <div class="flex flex-wrap items-end gap-3 mb-3 text-sm">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">最长持仓（开仓后再经历几根砖收盘则强平）</label>
                <input
                  v-model.number="profile.eulerSilenceOscMaxHoldBricks"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  class="w-24 px-2 py-1 border rounded dark:bg-gray-900 text-sm"
                />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 pb-1">默认 2：开仓索引为 i 时，最早在 i+2 收盘因满额强平（与「最多约 2 根后续砖」同量级，可自调）。</p>
            </div>
            <template v-if="eulerOiSilenceOscResult">
              <p v-if="!(Number(profile.eulerChameleonMinA) > 0)" class="text-xs text-amber-700 dark:text-amber-300 mb-2">
                请将「变色龙 min A」设为大于 0，否则无静风区、本策略不产生信号。
              </p>
              <div class="flex flex-wrap items-end gap-3 mb-2 text-sm">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">一开一平手续费（百分点，0=不扣）</label>
                  <input
                    v-model.number="profile.eulerSilenceOscFeeRoundTripPct"
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    class="w-28 px-2 py-1 border rounded dark:bg-gray-900 text-sm"
                  />
                </div>
              </div>
              <p class="text-sm text-gray-800 dark:text-gray-100 mb-1">
                毛合计：
                <span class="font-medium tabular-nums">{{ eulerOiSilenceOscResult.sumPnlPctGross.toFixed(2) }}%</span>
                <span class="text-gray-500 dark:text-gray-400 text-xs ml-2">净合计（已扣每笔 {{ eulerOiSilenceOscResult.feeRoundTripPct }}%）：</span>
                <strong
                  class="tabular-nums"
                  :class="eulerOiSilenceOscResult.sumPnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ eulerOiSilenceOscResult.sumPnlPct.toFixed(2) }}%
                </strong>
                <span class="text-gray-500 dark:text-gray-400 text-xs ml-2">
                  笔数 {{ eulerOiSilenceOscResult.tradeCount }} · 盈利笔（净）{{ eulerOiSilenceOscResult.winCount }}
                </span>
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">累计盈利点数 %（静风震荡）</p>
              <div
                ref="eulerSilenceOscPnlChartEl"
                class="mt-1 mb-3 w-full min-h-[200px] h-[200px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-slate-950"
              />
              <div v-if="eulerOiSilenceOscResult.trades.length" class="overflow-x-auto max-h-56 border border-gray-200 dark:border-gray-600 rounded">
                <table class="min-w-full text-xs">
                  <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th class="px-2 py-1 text-left font-medium">方向</th>
                      <th class="px-2 py-1 text-right font-medium">净 %</th>
                      <th class="px-2 py-1 text-right font-medium text-gray-500">毛 %</th>
                      <th class="px-2 py-1 text-left font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(tr, ti) in eulerOiSilenceOscResult.trades" :key="'so' + ti" class="border-t border-gray-100 dark:border-gray-700">
                      <td class="px-2 py-1">{{ tr.side === 'long' ? '多' : '空' }}</td>
                      <td class="px-2 py-1 text-right" :class="tr.pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
                        {{ tr.pnlPct.toFixed(2) }}
                      </td>
                      <td class="px-2 py-1 text-right text-gray-500">{{ Number(tr.pnlPctGross).toFixed(2) }}</td>
                      <td class="px-2 py-1 text-gray-500">{{ silenceOscExitNote(tr) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>

          <div class="mt-5 pt-4 border-t border-gray-200 dark:border-gray-600">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
              共振动力学矩阵回测（推力 × 相位 × Z(CVD) × σ/ω）
            </h3>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 space-y-1">
              <span class="block">
                与<strong>螺旋窗格</strong>同源：<code class="px-1 rounded bg-gray-200 dark:bg-gray-800">σ</code> / <code class="px-1 rounded bg-gray-200 dark:bg-gray-800">ω</code> 来自左侧参数（ZLEMA/HMA 平滑）。
                开仓：<strong>多</strong>绿 paint、θ°∈开区间、σ&gt;0、Z(CVD)&gt;阈；<strong>空</strong>红 paint、θ°∈(−150°～−120°)、σ&gt;0、Z&lt;阈。
                平仓：<strong>先风控</strong>（灰 / 多遇黄 / 空遇紫 / ±N×砖 TR）→ <strong>再止盈</strong>（相位尖峰、|ω| 相对 SMA 暴发、σ&lt;0、空单可加黄柱承接）。
              </span>
              <span class="block text-indigo-800 dark:text-indigo-200">
                Z(CVD) 默认取 <strong>IRaw</strong>（净吃单轨 Z）；可选改用 OI 加权轨 <strong>I</strong>。±N 砖止损用开仓时刻前若干砖的 TR 中位数作标尺。
              </span>
            </p>
            <div class="flex flex-wrap items-center gap-4 mb-3 text-xs">
              <label class="flex items-center gap-2 text-gray-700 dark:text-gray-200 cursor-pointer">
                <input v-model="profile.eulerResBtStopLossEnabled" type="checkbox" class="rounded border-gray-400" />
                <span>启用止损（灰 / 象限反转 / ±N×砖 TR / |ω| 递减）</span>
              </label>
              <span v-if="!profile.eulerResBtStopLossEnabled" class="text-amber-700 dark:text-amber-300">
                当前仅靠止盈（θ / ω / σ）、空单黄柱（可选）、最长持仓与尾盘平仓。
              </span>
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                @click="applyResonanceDocPreset"
              >
                载入文档默认锚点（min A≈1.35 + θ/Z 区间）
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3 text-xs">
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">一开一平扣费 %</label>
                <input v-model.number="profile.eulerResBtFeeRoundTripPct" type="number" min="0" max="10" step="0.01" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">Z 字段</label>
                <select v-model="profile.eulerResBtZField" class="w-full px-2 py-1 border rounded dark:bg-gray-900 bg-white dark:bg-gray-900">
                  <option value="IRaw">IRaw（净吃单 Z）</option>
                  <option value="I">I（OI 加权）</option>
                </select>
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">多 θ° min / max</label>
                <div class="flex gap-1">
                  <input v-model.number="profile.eulerResBtLongThetaMin" type="number" step="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                  <input v-model.number="profile.eulerResBtLongThetaMax" type="number" step="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                </div>
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">空 θ° min / max</label>
                <div class="flex gap-1">
                  <input v-model.number="profile.eulerResBtShortThetaMin" type="number" step="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                  <input v-model.number="profile.eulerResBtShortThetaMax" type="number" step="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                </div>
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">多 Z&gt; / 空 Z&lt;</label>
                <div class="flex gap-1">
                  <input v-model.number="profile.eulerResBtLongZMin" type="number" step="0.1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                  <input v-model.number="profile.eulerResBtShortZMax" type="number" step="0.1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                </div>
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">止盈 θ°：多&gt; / 空&lt;</label>
                <div class="flex gap-1">
                  <input v-model.number="profile.eulerResBtTpLongTheta" type="number" step="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                  <input v-model.number="profile.eulerResBtTpShortTheta" type="number" step="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                </div>
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">σ 开仓 &gt;（σ_open_min）</label>
                <input v-model.number="profile.eulerResBtSigmaOpenMin" type="number" step="0.01" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">止盈 σ&lt;（一般为 0）</label>
                <input v-model.number="profile.eulerResBtSigmaBelow" type="number" step="0.01" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">ω SMA(P) / 暴发倍率</label>
                <div class="flex gap-1">
                  <input v-model.number="profile.eulerResBtOmegaSmaPeriod" type="number" min="2" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                  <input v-model.number="profile.eulerResBtOmegaSpikeMult" type="number" step="0.1" min="1" class="w-full min-w-0 px-1 py-1 border rounded dark:bg-gray-900" />
                </div>
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">±N 砖（TR 中位倍数）</label>
                <input v-model.number="profile.eulerResBtBrickStopMult" type="number" step="0.25" min="0.25" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">TR 中位窗（砖）</label>
                <input v-model.number="profile.eulerResBtTrMedianWin" type="number" min="5" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">|ω| 连续递减离场（砖，0 关闭）</label>
                <input v-model.number="profile.eulerResBtOmegaDecayBricks" type="number" min="0" max="30" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div>
                <label class="block text-gray-600 dark:text-gray-300 mb-0.5">最长持仓（砖，0 不限）</label>
                <input v-model.number="profile.eulerResBtMaxHoldBricks" type="number" min="0" max="500" class="w-full px-2 py-1 border rounded dark:bg-gray-900" />
              </div>
              <div class="flex items-end pb-1">
                <label class="flex items-center gap-2 text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input v-model="profile.eulerResBtTpShortYellow" type="checkbox" class="rounded border-gray-400" />
                  <span>空单止盈含「黄柱承接」</span>
                </label>
              </div>
            </div>

            <template v-if="eulerResonanceMatrixBacktestResult">
              <p class="text-sm text-gray-800 dark:text-gray-100 mb-1">
                毛合计：
                <span class="font-medium tabular-nums">{{ eulerResonanceMatrixBacktestResult.sumPnlPctGross.toFixed(2) }}%</span>
                <span class="text-gray-500 dark:text-gray-400 text-xs ml-2">净合计：</span>
                <strong
                  class="tabular-nums"
                  :class="eulerResonanceMatrixBacktestResult.sumPnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ eulerResonanceMatrixBacktestResult.sumPnlPct.toFixed(2) }}%
                </strong>
                <span class="text-gray-500 dark:text-gray-400 text-xs ml-2">
                  笔数 {{ eulerResonanceMatrixBacktestResult.tradeCount }} · 盈利笔 {{ eulerResonanceMatrixBacktestResult.winCount }}
                </span>
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">累计盈利点数 %（共振矩阵）</p>
              <div
                ref="eulerResonanceMatrixPnlChartEl"
                class="mt-1 mb-3 w-full min-h-[200px] h-[200px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-slate-950"
              />
              <div v-if="eulerResonanceMatrixBacktestResult.trades.length" class="overflow-x-auto max-h-56 border border-gray-200 dark:border-gray-600 rounded">
                <table class="min-w-full text-xs">
                  <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th class="px-2 py-1 text-left font-medium">方向</th>
                      <th class="px-2 py-1 text-right font-medium">净 %</th>
                      <th class="px-2 py-1 text-right font-medium text-gray-500">毛 %</th>
                      <th class="px-2 py-1 text-left font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(tr, ti) in eulerResonanceMatrixBacktestResult.trades" :key="'rm' + ti" class="border-t border-gray-100 dark:border-gray-700">
                      <td class="px-2 py-1">{{ tr.side === 'long' ? '多' : '空' }}</td>
                      <td class="px-2 py-1 text-right" :class="tr.pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
                        {{ tr.pnlPct.toFixed(2) }}
                      </td>
                      <td class="px-2 py-1 text-right text-gray-500">{{ Number(tr.pnlPctGross).toFixed(2) }}</td>
                      <td class="px-2 py-1 text-gray-500">{{ resonanceMatrixExitNote(tr) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </div>
        <p v-if="eulerOiRawPoints.length === 0 && bars.length" class="mt-2 text-xs text-amber-700 dark:text-amber-300">
          欧拉序列为空：请检查主/基准砖是否对齐；无 metrics 时 OI 权重视为 1。
        </p>
      </section>
      <p v-else class="text-sm text-gray-500 py-8">加载数据后显示仪表盘（需主、基准两腿砖）。</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { createChart, LineSeries, LineType } from 'lightweight-charts'
import { NSelect } from 'naive-ui'
import NavBar from '@/components/NavBar.vue'
import RenkoFourPaneDashboard from '@/components/RenkoFourPaneDashboard.vue'
import { fetchBinanceHistoryKlineBars, getBinanceTopVolumeContracts } from '@/api'
import {
  toCandles,
  brickRowMapByCandleSec,
  cumulativeCvdPointsFromCandles,
  eulerResonanceSingleLegOiWeighted,
  applyEulerIQEmaSmoothing,
  computeEulerSchmittPaintQuadrants,
  simulateEulerOiChameleonSpotBacktest,
  simulateEulerOiSilenceOscillationSpotBacktest,
  simulateEulerResonanceMatrixSpotBacktest,
  eulerSpiralEnrich,
  buildQuoteVolumeBrickBarsFromOneMinute,
} from '@/utils/chartIndicatorCore'

/** 与 {@link classifyEulerQuadrant} / 主图配色一致（多选用 1～4） */
const eulerBacktestQuadCheckboxOptions = [
  { v: 1, shortLabel: '1 绿' },
  { v: 2, shortLabel: '2 紫' },
  { v: 3, shortLabel: '3 红' },
  { v: 4, shortLabel: '4 黄' },
]

const form = ref({
  symbol: 'BTCUSDT',
  benchmarkSymbol: 'BTCUSDT',
  /** USDT 成交额阈值：累计至此收盘一根砖（默认 500 万） */
  quoteVolumeThresholdUsdt: 5_000_000,
  limit: 8000,
  startAt: '',
  endAt: '',
})
const error = ref('')
const meta = ref(null)
const bars = ref([])
const benchmarkBars = ref([])
const metricsBars = ref([])
/** 币安历史 1m jbar 行，供 W_vol；与砖时段对齐时加载 */
const oneMinBarsRaw = ref([])
const queryLoading = ref(false)
const topVolumeSymbols = ref([])

const symbolUpper = computed(() => String(form.value.symbol || '').trim().toUpperCase())
const benchmarkUpper = computed(() => String(form.value.benchmarkSymbol || '').trim().toUpperCase())
const symbolOptions = computed(() =>
  (topVolumeSymbols.value || []).map((s) => ({ label: s, value: s }))
)

const profile = ref({
  chartHeight: 920,
  eulerZWindow: 100,
  eulerChameleonMinA: 1.2,
  eulerZVolatilityFloorRatio: 0.2,
  eulerZSigmaFloorAbs: 0,
  eulerConsensusA: 2,
  cvdMomentumEmaPeriod: 5,
  cvdMomentumUseKalman: true,
  cvdMomentumKalmanQ: 0.08,
  cvdMomentumKalmanR: 0.2,
  releaseLookback: 3,
  releaseCvdMomentumMin: 0,
  releaseEfficiencyMin: 0,
  eulerNoiseRadius: 1.5,
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
  showAbo: true,
  aboDisplayMode: 'both',
  aviPeriod: 100,
  /** I_eff 滞后 k 砖再与 Q_t 配对；0 表示同时刻 */
  cvdPhaseLagBricks: 0,
  /** ≥1：P_bayes = clip(P_whale×P_trend,0.5,2)；0 表示仅大户比 */
  bayesHtfLagBricks: 0,
  /** ≥2：A_geom 用滚动马氏距离（(I^pair,Q)）；0/1 为欧氏；与 Morlet 互斥 */
  eulerMahaWindow: 0,
  /** ≥3：Morlet 式高斯窗局部复振幅 |Z̃| 作 A_geom（0 关闭） */
  eulerMorletWindow: 0,
  /** Morlet 高斯 σ（砖） */
  eulerMorletSigma: 2,
  /** 0 关闭；1 OI 水位；2 ΔOI；3 砖 TR — 与 I,Q 同窗 Z 后合成 √(A_xy²+Z²) */
  eulerPhaseSpaceZ: 0,
  /** 简易回测开多象限 1～4，多选并集；空数组=不开多 */
  eulerBacktestOpenLongQuads: [1],
  /** 简易回测开空象限；空数组=不开空 */
  eulerBacktestOpenShortQuads: [3],
  /** 简易回测平仓：grey_fuse=静风灰+反向柱强平；grey_only=仅静风；leave_zone=离开所选象限 */
  eulerBacktestExitMode: 'grey_fuse',
  /** 一开一平从毛收益扣除的百分点（单边 0.05%×2 → 0.1）；0=不扣 */
  eulerBacktestFeeRoundTripPct: 0.1,
  /** 静风震荡简易回测：开仓后再经历几根砖收盘则时间强平 */
  eulerSilenceOscMaxHoldBricks: 2,
  /** 静风震荡回测扣费（独立于上方简易回测时可改） */
  eulerSilenceOscFeeRoundTripPct: 0.1,
  /** 共振动力学矩阵回测（推力×相位×Z×螺旋 σ/ω）；与简易模拟盘同源字段 */
  eulerResBtStopLossEnabled: true,
  eulerResBtFeeRoundTripPct: 0.1,
  eulerResBtZField: 'IRaw',
  eulerResBtLongThetaMin: 30,
  eulerResBtLongThetaMax: 60,
  eulerResBtShortThetaMin: -150,
  eulerResBtShortThetaMax: -120,
  eulerResBtLongZMin: 1.5,
  eulerResBtShortZMax: -1.5,
  eulerResBtSigmaOpenMin: 0,
  eulerResBtTpLongTheta: 75,
  eulerResBtTpShortTheta: -170,
  eulerResBtSigmaBelow: 0,
  eulerResBtOmegaSmaPeriod: 20,
  eulerResBtOmegaSpikeMult: 2,
  eulerResBtBrickStopMult: 2,
  eulerResBtTrMedianWin: 30,
  eulerResBtOmegaDecayBricks: 5,
  eulerResBtMaxHoldBricks: 0,
  eulerResBtTpShortYellow: true,
  /** >0 且已加载 1m：W_vol 阻尼；0 关闭 */
  volDampenTau: 0,
  /** 过去 P 根 1m 的 H-L 均值作 ATR<sub>1m</sub> */
  volDampenAtrPeriod: 20,
  showSpiral: true,
  spiralSigmaSmooth: 5,
  spiralSigmaSmoothMode: 'zlema',
  spiralSigmaThreshold: 0.05,
  showMacd: true,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  showBollinger: true,
  bollingerPeriod: 20,
  bollingerMult: 2,
  /** I/Q Z-Score 再 EMA 周期（≥2 启用），减轻象限量化抖动 */
  eulerAntiJitterEmaPeriod: 3,
  /** 施密特触发：进入阈 / 维持阈（A_final） */
  eulerSchmittEnabled: true,
  eulerSchmittAEnter: 1.8,
  eulerSchmittAHold: 0.8,
})

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
form.value.startAt = toLocalInputValue(new Date(now - 7 * 24 * 60 * 60 * 1000))
form.value.endAt = toLocalInputValue(new Date(now - 60 * 1000))

function normalizeBrickBars(inputBars) {
  return Array.isArray(inputBars)
    ? inputBars
        .filter((b) => Number.isFinite(Number(b?.t)) && Number.isFinite(Number(b?.c)))
        .map((b) => ({ ...b, t: Number(b.t) }))
        .sort((a, b) => a.t - b.t)
    : []
}

function normalizeOneMinuteJbarRows(rows) {
  return Array.isArray(rows)
    ? rows
        .filter((b) => Number.isFinite(Number(b?.t)) && Number.isFinite(Number(b?.c)))
        .map((b) => ({
          t: Number(b.t),
          o: Number(b.o),
          h: Number(b.h),
          l: Number(b.l),
          c: Number(b.c),
          v: Number(b.v) || 0,
          takerBuyBaseVolume: b.takerBuyBaseVolume,
          takerBuyQuoteVolume: b.takerBuyQuoteVolume,
        }))
        .sort((a, b) => a.t - b.t)
    : []
}

function rebuildMainBarsOnBenchmarkClock(mainBars, benchmarkBarsIn) {
  const main = Array.isArray(mainBars)
    ? mainBars.filter((b) => Number.isFinite(Number(b?.t))).map((b) => ({ ...b, t: Number(b.t) })).sort((a, b) => a.t - b.t)
    : []
  const bench = Array.isArray(benchmarkBarsIn)
    ? benchmarkBarsIn.filter((b) => Number.isFinite(Number(b?.t))).map((b) => ({ ...b, t: Number(b.t) })).sort((a, b) => a.t - b.t)
    : []
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

const dashboardRows = computed(() => {
  const main = Array.isArray(bars.value) ? bars.value : []
  const bench = Array.isArray(benchmarkBars.value) ? benchmarkBars.value : []
  if (!main.length || !bench.length) return []
  if (symbolUpper.value === benchmarkUpper.value) return main
  return rebuildMainBarsOnBenchmarkClock(main, bench)
})

/** 与 dashboardRows 等长：优先同刻基准收盘，缺失则回落主砖收盘（供贝叶斯趋势先验） */
const bayesHtfCloseSeries = computed(() => {
  const rows = dashboardRows.value
  const bench = Array.isArray(benchmarkBars.value) ? benchmarkBars.value : []
  if (!rows?.length) return null
  const map = new Map(
    bench.filter((b) => Number.isFinite(Number(b?.t))).map((b) => [Number(b.t), Number(b.c)])
  )
  return rows.map((r) => {
    const t = Number(r.t)
    const bc = map.get(t)
    if (Number.isFinite(bc) && bc > 0) return bc
    const mc = Number(r.c)
    return Number.isFinite(mc) && mc > 0 ? mc : NaN
  })
})

/** 引擎原始欧拉序列（未做 IQ-EMA / 施密特） */
const eulerOiRawPoints = computed(() => {
  const rows = dashboardRows.value
  if (!rows?.length) return []
  const candles = toCandles(rows)
  if (candles.length < 2) return []
  const mainRowsForCvd = Array.isArray(bars.value) ? bars.value : rows
  const rowMap = brickRowMapByCandleSec(mainRowsForCvd)
  const cvdLine = cumulativeCvdPointsFromCandles(candles, rowMap)
  const zWin = Math.max(2, Math.min(2000, Math.floor(Number(profile.value.eulerZWindow)) || 100))
  const cvdP = Math.max(1, Math.min(500, Math.floor(Number(profile.value.cvdMomentumEmaPeriod)) || 5))
  const zRat = Number(profile.value.eulerZVolatilityFloorRatio)
  const zAbs = Number(profile.value.eulerZSigmaFloorAbs)
  const opts = { zWindow: zWin, cvdEmaPeriod: cvdP }
  if (Number.isFinite(zRat) && zRat > 0) opts.zVolatilityFloorRatio = zRat
  if (Number.isFinite(zAbs) && zAbs > 0) opts.zSigmaFloorAbs = zAbs
  const lag = Number(profile.value.cvdPhaseLagBricks)
  if (Number.isFinite(lag) && lag >= 1) {
    opts.cvdPhaseLagBricks = Math.max(1, Math.min(500, Math.floor(lag)))
  }
  const htf = Number(profile.value.bayesHtfLagBricks)
  const htfSeries = bayesHtfCloseSeries.value
  if (Number.isFinite(htf) && htf >= 1 && Array.isArray(htfSeries) && htfSeries.length === candles.length) {
    opts.bayesHtfLagBricks = Math.max(1, Math.min(500, Math.floor(htf)))
    opts.bayesHtfCloseSeries = htfSeries
  }
  const morletW = Number(profile.value.eulerMorletWindow)
  if (Number.isFinite(morletW) && morletW >= 3) {
    opts.eulerMorletWindow = Math.max(3, Math.min(500, Math.floor(morletW)))
    const ms = Number(profile.value.eulerMorletSigma)
    opts.eulerMorletSigma = Number.isFinite(ms) ? Math.max(0.25, Math.min(50, ms)) : 2
  } else {
    const mahaW = Number(profile.value.eulerMahaWindow)
    if (Number.isFinite(mahaW) && mahaW >= 2) {
      opts.eulerMahaWindow = Math.max(2, Math.min(500, Math.floor(mahaW)))
    }
  }
  const vdTau = Number(profile.value.volDampenTau)
  if (Number.isFinite(vdTau) && vdTau > 0 && Array.isArray(oneMinBarsRaw.value) && oneMinBarsRaw.value.length >= 2) {
    opts.volDampenTau = Math.min(20, vdTau)
    opts.volDampenAtrPeriod = Math.max(2, Math.min(500, Math.floor(Number(profile.value.volDampenAtrPeriod)) || 20))
    opts.volDampen1mRawBars = oneMinBarsRaw.value
  }
  const pSpace = Number(profile.value.eulerPhaseSpaceZ)
  if (Number.isFinite(pSpace) && pSpace >= 1 && pSpace <= 3) {
    opts.eulerPhaseSpaceZ = Math.floor(pSpace)
  }
  const pts = eulerResonanceSingleLegOiWeighted(candles, cvdLine, metricsBars.value, opts)
  return Array.isArray(pts) && pts.length === candles.length ? pts : []
})

/** 供主图与回测：IQ EMA 平滑后的序列 */
const eulerOiDisplayPoints = computed(() => {
  const raw = eulerOiRawPoints.value
  if (!raw.length) return []
  const p = Math.floor(Number(profile.value.eulerAntiJitterEmaPeriod))
  return applyEulerIQEmaSmoothing(raw, Number.isFinite(p) && p >= 2 ? p : 0)
})

/** 施密特触发后的每砖展示象限（未启用时为 null，主图退回 classify(I,Q)） */
const eulerChameleonPaintQuadrants = computed(() => {
  const pts = eulerOiDisplayPoints.value
  if (!pts.length || !profile.value.eulerSchmittEnabled) return null
  const minA = Number(profile.value.eulerChameleonMinA)
  return computeEulerSchmittPaintQuadrants(pts, {
    minAForColor: Number.isFinite(minA) && minA > 0 ? minA : 0,
    aEnter: Number(profile.value.eulerSchmittAEnter),
    aHold: Number(profile.value.eulerSchmittAHold),
  })
})

const eulerOiBacktestResult = computed(() => {
  const pts = eulerOiDisplayPoints.value
  const rows = dashboardRows.value
  if (!pts.length || !rows.length) return null
  const candles = toCandles(rows)
  if (candles.length !== pts.length) return null
  const minA = Number(profile.value.eulerChameleonMinA)
  const exitMode = (() => {
    const v = profile.value.eulerBacktestExitMode
    if (v === 'leave_zone') return 'leave_zone'
    if (v === 'grey_only') return 'grey_only'
    return 'grey_fuse'
  })()
  const ol = Array.isArray(profile.value.eulerBacktestOpenLongQuads)
    ? profile.value.eulerBacktestOpenLongQuads.map((x) => Math.floor(Number(x))).filter((v) => v >= 1 && v <= 4)
    : []
  const os = Array.isArray(profile.value.eulerBacktestOpenShortQuads)
    ? profile.value.eulerBacktestOpenShortQuads.map((x) => Math.floor(Number(x))).filter((v) => v >= 1 && v <= 4)
    : []
  const feeRt = Number(profile.value.eulerBacktestFeeRoundTripPct)
  const schmittQs = eulerChameleonPaintQuadrants.value
  const useSchmittPaint =
    profile.value.eulerSchmittEnabled && Array.isArray(schmittQs) && schmittQs.length === pts.length
  return simulateEulerOiChameleonSpotBacktest(candles, pts, {
    minAForColor: Number.isFinite(minA) && minA > 0 ? minA : 0,
    exitMode,
    openLongQuadrant: ol.length ? ol : [],
    openShortQuadrant: os.length ? os : [],
    feeRoundTripPct: Number.isFinite(feeRt) && feeRt >= 0 ? feeRt : 0.1,
    ...(useSchmittPaint ? { paintQuadrants: schmittQs } : {}),
  })
})

const eulerOiSilenceOscResult = computed(() => {
  const pts = eulerOiDisplayPoints.value
  const rows = dashboardRows.value
  if (!pts.length || !rows.length) return null
  const candles = toCandles(rows)
  if (candles.length !== pts.length) return null
  const minA = Number(profile.value.eulerChameleonMinA)
  const mh = Math.floor(Number(profile.value.eulerSilenceOscMaxHoldBricks))
  const feeRt = Number(profile.value.eulerSilenceOscFeeRoundTripPct)
  return simulateEulerOiSilenceOscillationSpotBacktest(candles, pts, {
    minAForColor: Number.isFinite(minA) && minA > 0 ? minA : 0,
    maxHoldBricks: Number.isFinite(mh) && mh >= 1 ? mh : 2,
    feeRoundTripPct: Number.isFinite(feeRt) && feeRt >= 0 ? feeRt : 0.1,
  })
})

/** 与「螺旋 σ/ω」同源：在展示用欧拉点上叠加 σ、ω（供共振矩阵回测） */
const eulerOiSpiralPoints = computed(() => {
  const pts = eulerOiDisplayPoints.value
  if (!pts.length) return []
  return eulerSpiralEnrich(pts, {
    sigmaSmooth: profile.value.spiralSigmaSmooth,
    sigmaThreshold: profile.value.spiralSigmaThreshold,
    sigmaSmoothMode: profile.value.spiralSigmaSmoothMode,
  })
})

/** 文档矩阵：做多 Δ推力共振 / 做空 −135° 瀑布；止损含 ±N×砖 TR 与 |ω| 衰减 */
const eulerResonanceMatrixBacktestResult = computed(() => {
  const pts = eulerOiSpiralPoints.value
  const rows = dashboardRows.value
  if (!pts.length || !rows.length) return null
  const candles = toCandles(rows)
  if (candles.length !== pts.length) return null
  const minA = Number(profile.value.eulerChameleonMinA)
  const schmittQs = eulerChameleonPaintQuadrants.value
  const useSchmittPaint =
    profile.value.eulerSchmittEnabled && Array.isArray(schmittQs) && schmittQs.length === pts.length
  const feeRt = Number(profile.value.eulerResBtFeeRoundTripPct)
  const zField = profile.value.eulerResBtZField === 'I' ? 'I' : 'IRaw'
  const n = (v, d) => {
    const x = Number(v)
    return Number.isFinite(x) ? x : d
  }
  return simulateEulerResonanceMatrixSpotBacktest(candles, pts, {
    minAForColor: Number.isFinite(minA) && minA > 0 ? minA : 0,
    ...(useSchmittPaint ? { paintQuadrants: schmittQs } : {}),
    feeRoundTripPct: Number.isFinite(feeRt) && feeRt >= 0 ? feeRt : 0.1,
    zField,
    longThetaMinDeg: n(profile.value.eulerResBtLongThetaMin, 30),
    longThetaMaxDeg: n(profile.value.eulerResBtLongThetaMax, 60),
    shortThetaMinDeg: n(profile.value.eulerResBtShortThetaMin, -150),
    shortThetaMaxDeg: n(profile.value.eulerResBtShortThetaMax, -120),
    longZMin: n(profile.value.eulerResBtLongZMin, 1.5),
    shortZMax: n(profile.value.eulerResBtShortZMax, -1.5),
    sigmaOpenMin: n(profile.value.eulerResBtSigmaOpenMin, 0),
    longTpThetaDeg: n(profile.value.eulerResBtTpLongTheta, 75),
    shortTpThetaDeg: n(profile.value.eulerResBtTpShortTheta, -170),
    tpSigmaBelow: n(profile.value.eulerResBtSigmaBelow, 0),
    omegaSmaPeriod: Math.max(2, Math.floor(n(profile.value.eulerResBtOmegaSmaPeriod, 20))),
    omegaSpikeMult: n(profile.value.eulerResBtOmegaSpikeMult, 2),
    brickStopMult: Math.max(0.25, n(profile.value.eulerResBtBrickStopMult, 2)),
    trMedianWin: Math.max(5, Math.floor(n(profile.value.eulerResBtTrMedianWin, 30))),
    omegaDecayBricks: Math.max(0, Math.floor(n(profile.value.eulerResBtOmegaDecayBricks, 5))),
    maxHoldBricks: Math.max(0, Math.floor(n(profile.value.eulerResBtMaxHoldBricks, 0))),
    tpShortIncludeYellow: profile.value.eulerResBtTpShortYellow !== false,
    stopLossEnabled: profile.value.eulerResBtStopLossEnabled !== false,
  })
})

function resonanceMatrixExitNote(tr) {
  const tag = tr.exitTag
  if (tr.eod) return '尾盘强平'
  const zh = {
    tp_theta: '止盈·相位',
    tp_omega: '止盈·ω暴发',
    tp_sigma: '止盈·σ坍缩',
    tp_yellow: '止盈·黄(承接)',
    sl_grey: '止损·静风灰',
    sl_yellow: '止损·黄',
    sl_purple: '止损·紫',
    sl_price_bricks: '止损·±N砖',
    omega_decay: '离场·|ω|衰减',
    max_hold: '最长持仓',
  }
  return zh[tag] || tag || ''
}

function applyResonanceDocPreset() {
  profile.value.eulerChameleonMinA = 1.35
  profile.value.eulerResBtStopLossEnabled = true
  profile.value.eulerResBtLongThetaMin = 30
  profile.value.eulerResBtLongThetaMax = 60
  profile.value.eulerResBtShortThetaMin = -150
  profile.value.eulerResBtShortThetaMax = -120
  profile.value.eulerResBtLongZMin = 1.5
  profile.value.eulerResBtShortZMax = -1.5
  profile.value.eulerResBtTpLongTheta = 75
  profile.value.eulerResBtTpShortTheta = -170
  profile.value.eulerResBtOmegaSmaPeriod = 20
  profile.value.eulerResBtOmegaSpikeMult = 2
  profile.value.eulerResBtBrickStopMult = 2
  profile.value.eulerResBtOmegaDecayBricks = 5
  profile.value.eulerResBtSigmaBelow = 0
}

function silenceOscExitNote(tr) {
  if (tr.eod) return '尾盘强平'
  if (tr.exitKind === 'max_hold') return '最长持仓'
  if (tr.exitKind === 'leave_silence') return '出静风'
  if (tr.exitKind === 'color') return '变色'
  return ''
}

const eulerBacktestPnlChartEl = ref(null)
const eulerSilenceOscPnlChartEl = ref(null)
const eulerResonanceMatrixPnlChartEl = ref(null)
/** @type {import('lightweight-charts').IChartApi | null} */
let eulerBacktestPnlChart = null
/** @type {import('lightweight-charts').IChartApi | null} */
let eulerSilenceOscPnlChart = null
/** @type {import('lightweight-charts').IChartApi | null} */
let eulerResonanceMatrixPnlChart = null

function disposeEulerBacktestPnlChart() {
  if (eulerBacktestPnlChart) {
    eulerBacktestPnlChart.remove()
    eulerBacktestPnlChart = null
  }
}

function disposeEulerSilenceOscPnlChart() {
  if (eulerSilenceOscPnlChart) {
    eulerSilenceOscPnlChart.remove()
    eulerSilenceOscPnlChart = null
  }
}

function disposeEulerResonanceMatrixPnlChart() {
  if (eulerResonanceMatrixPnlChart) {
    eulerResonanceMatrixPnlChart.remove()
    eulerResonanceMatrixPnlChart = null
  }
}

function renderEulerBacktestPnlChart() {
  disposeEulerBacktestPnlChart()
  const el = eulerBacktestPnlChartEl.value
  const res = eulerOiBacktestResult.value
  const data = res?.cumulativePnlPctCurve
  if (!el || !data?.length) return

  const isDark = document.documentElement.classList.contains('dark')
  const w = Math.max(el.clientWidth, 280)
  const h = 200
  const lastVal = data[data.length - 1]?.value ?? 0
  const lineColor = lastVal >= 0 ? '#16a34a' : '#dc2626'

  eulerBacktestPnlChart = createChart(el, {
    width: w,
    height: h,
    layout: {
      background: { color: isDark ? '#020617' : '#ffffff' },
      textColor: isDark ? '#e2e8f0' : '#334155',
    },
    grid: {
      vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
    },
    rightPriceScale: {
      borderColor: isDark ? '#334155' : '#e2e8f0',
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
  })

  const line = eulerBacktestPnlChart.addSeries(LineSeries, {
    color: lineColor,
    lineWidth: 2,
    lineType: LineType.WithSteps,
    lastValueVisible: true,
    priceLineVisible: true,
    title: '累计 %',
  })
  line.setData(data)
  eulerBacktestPnlChart.timeScale().fitContent()
}

function renderEulerSilenceOscPnlChart() {
  disposeEulerSilenceOscPnlChart()
  const el = eulerSilenceOscPnlChartEl.value
  const res = eulerOiSilenceOscResult.value
  const data = res?.cumulativePnlPctCurve
  if (!el || !data?.length) return

  const isDark = document.documentElement.classList.contains('dark')
  const w = Math.max(el.clientWidth, 280)
  const h = 200
  const lastVal = data[data.length - 1]?.value ?? 0
  const lineColor = lastVal >= 0 ? '#16a34a' : '#dc2626'

  eulerSilenceOscPnlChart = createChart(el, {
    width: w,
    height: h,
    layout: {
      background: { color: isDark ? '#020617' : '#ffffff' },
      textColor: isDark ? '#e2e8f0' : '#334155',
    },
    grid: {
      vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
    },
    rightPriceScale: {
      borderColor: isDark ? '#334155' : '#e2e8f0',
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
  })

  const line = eulerSilenceOscPnlChart.addSeries(LineSeries, {
    color: lineColor,
    lineWidth: 2,
    lineType: LineType.WithSteps,
    lastValueVisible: true,
    priceLineVisible: true,
    title: '累计 %',
  })
  line.setData(data)
  eulerSilenceOscPnlChart.timeScale().fitContent()
}

function renderEulerResonanceMatrixPnlChart() {
  disposeEulerResonanceMatrixPnlChart()
  const el = eulerResonanceMatrixPnlChartEl.value
  const res = eulerResonanceMatrixBacktestResult.value
  const data = res?.cumulativePnlPctCurve
  if (!el || !data?.length) return

  const isDark = document.documentElement.classList.contains('dark')
  const w = Math.max(el.clientWidth, 280)
  const h = 200
  const lastVal = data[data.length - 1]?.value ?? 0
  const lineColor = lastVal >= 0 ? '#16a34a' : '#dc2626'

  eulerResonanceMatrixPnlChart = createChart(el, {
    width: w,
    height: h,
    layout: {
      background: { color: isDark ? '#020617' : '#ffffff' },
      textColor: isDark ? '#e2e8f0' : '#334155',
    },
    grid: {
      vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
    },
    rightPriceScale: {
      borderColor: isDark ? '#334155' : '#e2e8f0',
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
  })

  const line = eulerResonanceMatrixPnlChart.addSeries(LineSeries, {
    color: lineColor,
    lineWidth: 2,
    lineType: LineType.WithSteps,
    lastValueVisible: true,
    priceLineVisible: true,
    title: '累计 %',
  })
  line.setData(data)
  eulerResonanceMatrixPnlChart.timeScale().fitContent()
}

function onEulerBacktestPnlResize() {
  nextTick(() => {
    renderEulerBacktestPnlChart()
    renderEulerSilenceOscPnlChart()
    renderEulerResonanceMatrixPnlChart()
  })
}

watch(
  () => eulerOiBacktestResult.value,
  () => nextTick(() => renderEulerBacktestPnlChart()),
  { deep: true }
)

watch(
  () => eulerOiSilenceOscResult.value,
  () => nextTick(() => renderEulerSilenceOscPnlChart()),
  { deep: true }
)

watch(
  () => eulerResonanceMatrixBacktestResult.value,
  () => nextTick(() => renderEulerResonanceMatrixPnlChart()),
  { deep: true }
)

onMounted(() => {
  window.addEventListener('resize', onEulerBacktestPnlResize)
  nextTick(() => {
    renderEulerBacktestPnlChart()
    renderEulerSilenceOscPnlChart()
    renderEulerResonanceMatrixPnlChart()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onEulerBacktestPnlResize)
  disposeEulerBacktestPnlChart()
  disposeEulerSilenceOscPnlChart()
  disposeEulerResonanceMatrixPnlChart()
})

async function doLoadBars() {
  error.value = ''
  meta.value = null
  bars.value = []
  benchmarkBars.value = []
  metricsBars.value = []
  oneMinBarsRaw.value = []
  const startMs = toTimestampMs(form.value.startAt)
  const endMs = toTimestampMs(form.value.endAt)
  if (!startMs || !endMs || endMs <= startMs) {
    error.value = '请选择有效时间范围'
    return
  }
  const thr = Math.max(1000, Number(form.value.quoteVolumeThresholdUsdt) || 5_000_000)
  queryLoading.value = true
  try {
    const needSeparateBench = symbolUpper.value !== benchmarkUpper.value
    const lim = Math.max(100, Math.min(200000, Math.floor(Number(form.value.limit)) || 8000))
    const [metricsData, oneMMain, oneMBench] = await Promise.all([
      fetchBinanceHistoryKlineBars({
        symbol: symbolUpper.value,
        interval: '5m_metrics',
        startMs,
        endMs,
        limit: 50000,
      }).catch(() => ({ bars: [] })),
      fetchBinanceHistoryKlineBars({
        symbol: symbolUpper.value,
        interval: '1m',
        startMs,
        endMs,
        limit: lim,
      }).catch(() => ({ bars: [] })),
      needSeparateBench
        ? fetchBinanceHistoryKlineBars({
            symbol: benchmarkUpper.value,
            interval: '1m',
            startMs,
            endMs,
            limit: lim,
          }).catch(() => ({ bars: [] }))
        : Promise.resolve(null),
    ])
    const main1m = normalizeOneMinuteJbarRows(oneMMain?.bars)
    const bench1m = needSeparateBench ? normalizeOneMinuteJbarRows(oneMBench?.bars) : main1m
    if (!main1m.length) {
      error.value = '未加载到主合约 1m K 线'
      return
    }
    if (!bench1m.length) {
      error.value = '未加载到基准合约 1m K 线'
      return
    }
    const mainBricks = buildQuoteVolumeBrickBarsFromOneMinute(main1m, thr)
    const benchBricks = buildQuoteVolumeBrickBarsFromOneMinute(bench1m, thr)
    if (!mainBricks.length) {
      error.value =
        '成交额砖为空：请缩小每根目标成交额、或拉长时间区间、或确认 1m 的 v 为 USDT 计价成交额'
      return
    }
    meta.value = {
      count: mainBricks.length,
      jbarPath: `client:quote_vol_brick(threshold=${thr} USDT)`,
    }
    bars.value = normalizeBrickBars(mainBricks)
    benchmarkBars.value = normalizeBrickBars(
      symbolUpper.value === benchmarkUpper.value ? mainBricks : benchBricks
    )
    metricsBars.value = Array.isArray(metricsData?.bars) ? metricsData.bars : []
    oneMinBarsRaw.value = Array.isArray(oneMMain?.bars) ? oneMMain.bars : []
    if (!metricsBars.value.length) {
      error.value = '未加载到 metrics（请先在「币安历史 K 线」页下载 ' + symbolUpper.value + '_5m_metrics.jbar）；当前 OI 加权按 1 处理。'
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    queryLoading.value = false
  }
}

onMounted(async () => {
  try {
    const rows = await getBinanceTopVolumeContracts()
    const list = Array.isArray(rows)
      ? rows.map((r) => String(r?.symbol || '').trim().toUpperCase()).filter(Boolean)
      : []
    topVolumeSymbols.value = Array.from(new Set(list)).slice(0, 150)
  } catch {
    topVolumeSymbols.value = []
  }
})
</script>
