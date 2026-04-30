<template>
  <div>
    <nav-bar />
    <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">
        {{ isEditMode ? $t('backtest_instances.form.edit_title') : $t('backtest_instances.form.create_title') }}
      </h1>

      <div class="bg-white p-8 rounded-lg shadow-md">
        <n-form ref="formRef" :model="formValue" :rules="rules" class="space-y-8">
          <n-form-item :label="$t('backtest_instances.name')" path="name">
            <n-input v-model:value="formValue.name" :placeholder="$t('backtest_instances.form.name_placeholder')" />
          </n-form-item>

          <n-form-item :label="$t('backtest_instances.form.strategy_template')" path="strategyTemplateId">
            <n-select
              v-model:value="formValue.strategyTemplateId"
              :options="strategyTemplateOptions"
              :loading="strategyTemplateStore.loading"
              :placeholder="$t('backtest_instances.form.strategy_template_placeholder')"
              @update:value="handleTemplateChange"
            />
          </n-form-item>

          <n-form-item :label="$t('backtest.exchange')">
            <n-select
              v-model:value="formValue.exchange"
              @update:value="handleExchangeChange"
              :options="exchangeOptions"
              :disabled="isBtcSyntheticOhlcSelected"
            />
          </n-form-item>

          <n-grid :cols="2" :x-gap="24">
            <n-form-item-gi :label="$t('backtest_instances.form.start_time')" path="startTime">
              <n-date-picker v-model:value="formValue.startTime" type="datetime" class="w-full" />
            </n-form-item-gi>
            <n-form-item-gi :label="$t('backtest_instances.form.end_time')" path="endTime">
              <n-date-picker v-model:value="formValue.endTime" type="datetime" class="w-full" />
            </n-form-item-gi>
          </n-grid>

          <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.data_type_config') }}</h3>
            <div class="flex items-center space-x-6">
              <n-checkbox v-model:checked="formValue.dataTypes.useDepth">{{ $t('backtest.depth') }}</n-checkbox>
              <n-checkbox v-model:checked="formValue.dataTypes.useTrade">{{ $t('backtest.trade') }}</n-checkbox>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.ohlc_period') }}</label>
              <n-select v-model:value="formValue.dataTypes.ohlc" multiple :options="timeframeOptions" :placeholder="$t('backtest.select_period')"/>
              <p v-if="isBtcSyntheticOhlcSelected" class="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {{ $t('backtest_instances.form.synthetic_binance_ohlc_hint') }}
              </p>
            </div>
          </div>

          <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.pattern_config') }}</h3>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.pattern_name') }}</label>
              <n-select v-model:value="formValue.backtestPattern.name" :options="patternOptions" />
            </div>
            <div v-if="formValue.backtestPattern.name === 'ORDERBOOK'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="missRatio" class="block text-sm font-medium text-gray-700">{{ $t('backtest.miss_ratio') }}</label>
                <n-input type="number" v-model:value="formValue.backtestPattern.params.miss_ratio" id="missRatio" step="0.001" />
              </div>
              <div>
                <label for="slippage" class="block text-sm font-medium text-gray-700">{{ $t('backtest.slippage') }}</label>
                <n-input type="number" v-model:value="formValue.backtestPattern.params.slippage" id="slippage" step="0.001" />
              </div>
            </div>
          </div>

          <!-- 撮合算法配置 (Java; other languages will ignore) -->
          <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.matching_algorithm_config') }}</h3>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.matching_algorithm_type') }}</label>
              <n-select v-model:value="formValue.matchingAlgorithm" :options="matchingAlgorithmOptions" class="max-w-sm"/>
              <p class="mt-1 text-sm text-gray-500">
                <span>（仅 Java 策略模板生效）</span>
                <span v-if="formValue.matchingAlgorithm === 'BEST_PRICE'">{{ $t('backtest.matching_algorithm_hint.best_price') }}</span>
                <span v-else-if="formValue.matchingAlgorithm === 'MARKET_BEST'">{{ $t('backtest.matching_algorithm_hint.market_best') }}</span>
                <span v-else-if="formValue.matchingAlgorithm === 'MID_PRICE'">{{ $t('backtest.matching_algorithm_hint.mid_price') }}</span>
                <span v-else-if="formValue.matchingAlgorithm === 'SLIPPAGE'">{{ $t('backtest.matching_algorithm_hint.slippage') }}</span>
              </p>
            </div>
          </div>

          <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.leg_config') }}</h3>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                <template v-if="isScannerStrategy">{{ $t('backtest_instances.form.scanner_leg_hint') }}</template>
                <template v-else>{{ $t('backtest_instances.form.leg_config_hint', { n: formValue.symbols.length }) }}</template>
              </p>
              <div class="flex flex-wrap items-center gap-3">
                <n-checkbox
                  v-if="isScannerStrategy"
                  v-model:checked="formValue.scannerUseWhitelistUniverse"
                  class="shrink-0"
                >
                  {{ $t('backtest_instances.form.scanner_whitelist_universe') }}
                </n-checkbox>
                <n-button v-if="isScannerStrategy && !formValue.scannerUseWhitelistUniverse" size="small" tertiary @click="addSymbol">
                  {{ $t('backtest_instances.form.add_scan_symbol') }}
                </n-button>
                <n-button v-if="!isScannerStrategy" size="small" tertiary @click="applyWhitelistSymbols">
                  {{ $t('backtest_instances.form.fill_whitelist_symbols') }}
                </n-button>
                <n-button
                  v-if="!isScannerStrategy"
                  size="small"
                  tertiary
                  :loading="historyTop150Loading"
                  :disabled="!canFillStartDayTop150"
                  @click="applyStartDayTop150Symbols"
                >
                  {{ $t('backtest_instances.form.fill_start_day_top150') }}
                </n-button>
                <n-button v-if="!isScannerStrategy" size="small" tertiary @click="clearLegSymbols">
                  {{ $t('backtest_instances.form.clear_leg_symbols') }}
                </n-button>
                <n-button v-if="!isScannerStrategy" size="small" tertiary @click="addSymbol">
                  <template #icon><n-icon :component="AddIcon" /></template>
                  {{ $t('backtest_instances.form.add_trading_leg') }}
                </n-button>
              </div>
            </div>
            <div v-if="!isScannerStrategy" class="mt-2 rounded border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
              <div class="text-sm font-medium text-indigo-800">{{ $t('backtest_instances.form.abo_dynamic_whitelist_title') }}</div>
              <div class="text-xs text-indigo-700">
                {{ $t('backtest_instances.form.abo_dynamic_whitelist_hint') }}
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-indigo-800">{{ $t('backtest_instances.form.abo_exclude_top_cap') }}</span>
                  <n-select v-model:value="aboExcludeTopCapN" size="small" :options="aboExcludeTopCapOptions" class="w-28" />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-indigo-800">{{ $t('backtest_instances.form.abo_turnover_top_n') }}</span>
                  <n-select v-model:value="aboTurnoverTopN" size="small" :options="aboTurnoverTopNOptions" class="w-28" />
                </div>
                <n-button size="small" type="primary" tertiary :loading="aboDynamicLoading" @click="buildAboDynamicWhitelist">
                  {{ $t('backtest_instances.form.abo_generate_whitelist') }}
                </n-button>
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">{{ $t('backtest_instances.form.leg_symbol_pick_hint') }}</p>
            <div v-for="(symbol, index) in formValue.symbols" :key="index" class="flex items-center space-x-2 mb-2">
              <label class="text-sm font-medium text-gray-700 w-40 shrink-0">{{ strategyDescriptor?.legs?.[index]?.label || $t('backtest.leg_n', { n: index + 1 }) }}</label>
              <n-select
                v-model:value="symbol.name"
                filterable
                :placeholder="$t('backtest_instances.form.leg_symbol_placeholder')"
                :options="symbolOptions"
                class="flex-grow"
              />
              <n-button v-if="formValue.symbols.length > 1" @click="removeSymbol(index)" type="error" text>
                <template #icon><n-icon :component="TrashIcon" /></template>
              </n-button>
            </div>
          </div>
          
          <div class="border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.strategy_params') }}</h3>
            <parameter-editor v-model="formValue.parameters" />
            <div class="mt-4 rounded border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
              <div class="text-sm font-medium text-emerald-800">配对交易辅助（pairsConfig）</div>
              <div class="text-xs text-emerald-700">
                支持手填格式：<code>PIXELUSDT:NEIROUSDT,FETUSDT:1000BONKUSDT</code>（可用逗号/换行分隔）
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-emerald-800">配对数</span>
                  <n-select
                    v-model:value="pairsScanTopN"
                    size="small"
                    :options="pairsTopNOptions"
                    class="w-28"
                  />
                </div>
                <n-button
                  size="small"
                  type="primary"
                  tertiary
                  :loading="pairsScanLoading"
                  :disabled="!hasPairsConfigParam"
                  @click="fillPairsConfigFromScanner"
                >
                  从配对扫描器生成并填充
                </n-button>
                <n-button v-if="!hasPairsConfigParam" size="small" secondary @click="ensurePairsConfigParam">
                  添加 pairsConfig 参数
                </n-button>
                <span class="text-xs text-emerald-700">
                  数据源：{{ pairsScannerSourceLabel }}；候选池：白名单 {{ BACKTEST_INSTANCE_WHITELIST.length }} 合约
                </span>
              </div>
              <div v-if="!hasPairsConfigParam" class="text-xs text-amber-700">
                当前模板参数里没有名为 <code>pairsConfig</code> 的项，先点击“添加 pairsConfig 参数”。
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-4">
            <n-button @click="handleCancel">{{ $t('common.cancel') }}</n-button>
            <n-button type="primary" @click="handleSubmit" :loading="loading">{{ $t('common.save') }}</n-button>
          </div>
        </n-form>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBacktestInstanceStore } from '@/stores/backtestInstance';
import { useStrategyTemplateStore } from '@/stores/strategyTemplate';
import { storeToRefs } from 'pinia';
import { NForm, NFormItem, NInput, NButton, NSelect, useMessage, NDatePicker, NGrid, NFormItemGi, NIcon, NCheckbox } from 'naive-ui';
import { Trash as TrashIcon, Add as AddIcon } from '@vicons/ionicons5';
import NavBar from '@/components/NavBar.vue';
import ParameterEditor from '@/components/ParameterEditor.vue';
import { useAuthStore } from '@/stores/auth';
import { useSubscriptionStore } from '@/stores/subscription';
import { parseNumLegsFromScript } from '@/utils/parameter-parser';
import { getStrategyDescriptor, fetchBinanceHistorySymbols, scanPairs, getBinanceHistoryDayTopVolume } from '@/api';
import { BACKTEST_INSTANCE_WHITELIST } from '@/constants/backtestInstanceWhitelist';
import { resolveBinanceUsdtContract } from '@/constants/binanceSymbolAlias';

// A simple UUID generator for browser compatibility.
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isScannerStrategyTemplate(template) {
  if (!template) return false;
  const p = String(template.scriptPath || '');
  return p.includes('MultiInstrumentBollingerStrategy');
}

export default defineComponent({
  name: 'BacktestInstanceForm',
  components: {
    NavBar,
    ParameterEditor,
    NForm,
    NFormItem,
    NInput,
    NButton,
    NSelect,
    NDatePicker,
    NGrid,
    NFormItemGi,
    NIcon,
    NCheckbox,
  },
  setup() {
    const router = useRouter();
    const route = useRoute();
    const { t } = useI18n();
    const message = useMessage();

    const backtestInstanceStore = useBacktestInstanceStore();
    const { loading, error } = storeToRefs(backtestInstanceStore);

    const strategyTemplateStore = useStrategyTemplateStore();
    const { templates: strategyTemplates, currentTemplate } = storeToRefs(strategyTemplateStore);
    
    const subscriptionStore = useSubscriptionStore();
    const { subscribedSymbols } = storeToRefs(subscriptionStore);
    
    const authStore = useAuthStore();

    const stripOkxSuffix = (v) => {
      if (typeof v !== 'string') return v;
      return v.trim().replace(/\.okx$/i, '');
    };

    const formRef = ref(null);
    const formValue = ref({
      name: '',
      strategyTemplateId: null,
      startTime: Date.now() - 365 * 24 * 60 * 60 * 1000, // Default to one year ago
      endTime: Date.now(),
      symbols: [{ name: '' }],
      exchange: 'okx',
      dataTypes: {
        useDepth: false,
        useTrade: false,
        ohlc: ['15m'],
      },
      backtestPattern: {
        name: 'OHLC',
        params: {
          miss_ratio: 0.01,
          slippage: 0.005,
        },
      },
      matchingAlgorithm: 'BEST_PRICE', // BEST_PRICE, MARKET_BEST, MID_PRICE, SLIPPAGE (JAVA only)
      parameters: [],
      /** MultiInstrumentBollingerStrategy：保存时展开白名单写入 SYMBOLS */
      scannerUseWhitelistUniverse: true,
    });
    
    const instanceId = computed(() => route.params.id);
    const isEditMode = computed(() => !!instanceId.value);
    /** Strategy descriptor from GET /strategy-templates/:id/descriptor (JAVA only). Drives leg labels and CONFIG on submit. */
    const strategyDescriptor = ref(null);

    /** 币安 U 本位 USDT 永续（TRADING）全量，来自 /api/v1/binance/history/symbols */
    const binanceUmSymbols = ref([]);

    const strategyTemplateOptions = computed(() => 
      strategyTemplates.value.map(template => ({
        label: template.name,
        value: template.id,
      }))
    );

    const isJavaTemplate = computed(() => {
      const byId = strategyTemplates.value?.find(t => t?.id === formValue.value.strategyTemplateId);
      const lang = (currentTemplate.value?.language ?? byId?.language ?? '').toString().trim().toUpperCase();
      return lang === 'JAVA';
    });
    
    /** 每条腿单选：流动性白名单优先列出，其次币安 UM 全量，再合并已订阅（OKX 等）合约（去重） */
    const symbolOptions = computed(() => {
      const map = new Map();
      BACKTEST_INSTANCE_WHITELIST.forEach((s) => {
        map.set(s, { label: s, value: s });
      });
      if (Array.isArray(binanceUmSymbols.value)) {
        binanceUmSymbols.value.forEach((raw) => {
          const normalized = String(raw ?? '').trim().toUpperCase();
          if (normalized) {
            map.set(normalized, { label: normalized, value: normalized });
          }
        });
      }
      if (Array.isArray(subscribedSymbols.value)) {
        subscribedSymbols.value.forEach((raw) => {
          const normalized = stripOkxSuffix(String(raw));
          if (normalized) {
            map.set(normalized, { label: normalized, value: normalized });
          }
        });
      }
      const wlSet = new Set(BACKTEST_INSTANCE_WHITELIST);
      const whitelistOrdered = BACKTEST_INSTANCE_WHITELIST.filter((s) => map.has(s)).map((s) => map.get(s));
      const extras = [...map.keys()]
        .filter((k) => !wlSet.has(k))
        .sort((a, b) => a.localeCompare(b))
        .map((k) => map.get(k));
      return [...whitelistOrdered, ...extras];
    });

    const isBtcSyntheticOhlcSelected = computed(() => {
      const o = formValue.value.dataTypes?.ohlc;
      return Array.isArray(o) && (o.includes('BTCVOLSYNC') || o.includes('BTCPOINTBRICK'));
    });

    const ohlcSelectionPrev = ref([]);

    const isScannerStrategy = computed(() => {
      const id = formValue.value.strategyTemplateId;
      const tpl = strategyTemplates.value?.find((t) => t?.id === id);
      return isScannerStrategyTemplate(tpl);
    });

    /** 本地 jbar 成交额排名仅覆盖币安 U 本位数据；砖石/成交量同步 K 线同样走币安 jbar */
    const canFillStartDayTop150 = computed(
      () => formValue.value.exchange === 'binance' || isBtcSyntheticOhlcSelected.value
    );

    const pairsScanLoading = ref(false);
    const historyTop150Loading = ref(false);
    const pairsScanTopN = ref(50);
    const pairsTopNOptions = [
      { label: '前 50 对', value: 50 },
      { label: '前 100 对', value: 100 },
    ];
    const hasPairsConfigParam = computed(() =>
      Array.isArray(formValue.value.parameters) &&
      formValue.value.parameters.some((p) => String(p?.name || '').trim().toLowerCase() === 'pairsconfig')
    );
    const pairsScannerSourceLabel = computed(() => {
      const ohlc = formValue.value.dataTypes?.ohlc || [];
      if (Array.isArray(ohlc) && ohlc.includes('BTCPOINTBRICK')) return 'BTC_POINT_BRICK';
      if (Array.isArray(ohlc) && ohlc.includes('BTCVOLSYNC')) return 'BTC_VOL_SYNC';
      return '1H';
    });

    const aboDynamicLoading = ref(false);
    const aboExcludeTopCapN = ref(20);
    const aboTurnoverTopN = ref(30);
    const aboExcludeTopCapOptions = [
      { label: 'Top 10', value: 10 },
      { label: 'Top 20', value: 20 },
      { label: 'Top 30', value: 30 },
      { label: 'Top 50', value: 50 },
    ];
    const aboTurnoverTopNOptions = [
      { label: 'Top 20', value: 20 },
      { label: 'Top 30', value: 30 },
      { label: 'Top 50', value: 50 },
      { label: 'Top 100', value: 100 },
    ];

    const buildAboDynamicWhitelist = async () => {
      if (!Array.isArray(binanceUmSymbols.value) || !binanceUmSymbols.value.length) {
        message.warning(t('backtest_instances.form.abo_dynamic_no_binance_symbols'));
        return;
      }
      aboDynamicLoading.value = true;
      try {
        const capN = Number(aboExcludeTopCapN.value) || 20;
        const topN = Number(aboTurnoverTopN.value) || 30;
        const perPage = 250;
        const pages = [1, 2];
        const all = [];
        for (const page of pages) {
          // CoinGecko: 24h 成交额与市值都在同一接口，便于计算换手率(total_volume / market_cap)
          const url =
            `https://api.coingecko.com/api/v3/coins/markets` +
            `?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`CoinGecko HTTP ${resp.status}`);
          const rows = await resp.json();
          if (Array.isArray(rows)) all.push(...rows);
        }

        const normalized = all
          .map((r) => ({
            symbol: String(r?.symbol || '').trim().toUpperCase(),
            marketCap: Number(r?.market_cap || 0),
            totalVolume: Number(r?.total_volume || 0),
          }))
          .filter((r) => r.symbol && Number.isFinite(r.marketCap) && Number.isFinite(r.totalVolume) && r.marketCap > 0 && r.totalVolume > 0);

        const contractSet = new Set(
          binanceUmSymbols.value
            .map((s) => String(s || '').trim().toUpperCase())
            .filter(Boolean)
        );

        const topMarketCap = normalized
          .filter((r) => r.symbol !== 'BTC')
          .sort((a, b) => b.marketCap - a.marketCap)
          .slice(0, capN);
        const excludedContracts = new Set(
          topMarketCap
            .map((r) => resolveBinanceUsdtContract(r.symbol, contractSet))
            .filter(Boolean)
        );
        excludedContracts.add('BTCUSDT');

        const selected = [];
        const seen = new Set();
        const turnoverRank = normalized
          .map((r) => ({ ...r, turnover: r.totalVolume / r.marketCap }))
          .sort((a, b) => b.turnover - a.turnover);
        for (const row of turnoverRank) {
          const contract = resolveBinanceUsdtContract(row.symbol, contractSet);
          if (!contract) continue;
          if (excludedContracts.has(contract)) continue;
          if (!contractSet.has(contract)) continue;
          if (seen.has(contract)) continue;
          seen.add(contract);
          selected.push(contract);
          if (selected.length >= topN) break;
        }

        if (!selected.length) {
          message.warning(t('backtest_instances.form.abo_dynamic_empty'));
          return;
        }
        formValue.value.symbols = selected.map((s) => ({ name: s }));
        message.success(
          t('backtest_instances.form.abo_dynamic_success', {
            n: selected.length,
            capN,
            topN,
          })
        );
      } catch (err) {
        message.error(err?.message || t('backtest_instances.form.abo_dynamic_failed'));
      } finally {
        aboDynamicLoading.value = false;
      }
    };

    const normalizePairToken = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const buildPairsConfigCsv = (raw) => {
      if (raw == null) return '';
      const text = String(raw)
        .replace(/[，；\n\r\t]+/g, ',')
        .replace(/[：]/g, ':')
        .replace(/\|+/g, ',');
      const segments = text.split(',').map((s) => s.trim()).filter(Boolean);
      const pairs = [];
      const seen = new Set();
      for (const seg of segments) {
        const idx = seg.indexOf(':');
        if (idx <= 0 || idx >= seg.length - 1) continue;
        const a = normalizePairToken(seg.slice(0, idx));
        const b = normalizePairToken(seg.slice(idx + 1));
        if (!a || !b || a === b) continue;
        const key = `${a}:${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push(key);
      }
      return pairs.join(',');
    };

    const setPairsConfigParamValue = (csvText) => {
      if (!Array.isArray(formValue.value.parameters)) return false;
      const idx = formValue.value.parameters.findIndex((p) => String(p?.name || '').trim().toLowerCase() === 'pairsconfig');
      if (idx < 0) return false;
      const normalized = buildPairsConfigCsv(csvText);
      formValue.value.parameters[idx].value = normalized;
      return true;
    };

    const ensurePairsConfigParam = () => {
      if (hasPairsConfigParam.value) return;
      if (!Array.isArray(formValue.value.parameters)) {
        formValue.value.parameters = [];
      }
      formValue.value.parameters.push({
        name: 'pairsConfig',
        value: '',
        defaultValue: '',
        dataType: 'STRING',
        direction: 'IN',
      });
      message.success('已添加 pairsConfig 参数');
    };

    const fillPairsConfigFromScanner = async () => {
      const timeframe = pairsScannerSourceLabel.value;
      const requestTopN = pairsScanTopN.value === 100 ? 100 : 50;
      const payload = {
        symbols: [...BACKTEST_INSTANCE_WHITELIST],
        timeframe,
        lookbackBars: 2000,
        olsWindowBars: 1000,
        adfWindowBars: 1000,
        halfLifeWindowBars: 1000,
        zWindowBars: 500,
        correlationThreshold: 0.8,
        adfTThreshold: -3.0,
        adfPThreshold: 0.05,
        minHalfLife: 10,
        maxHalfLife: 200,
        topN: requestTopN,
        maxPairsAfterCorr: 3000,
        persist: true,
        assetType: 'CRYPTO',
        exchange: 'binance',
        instType: 'SWAP',
      };
      if (timeframe === 'BTC_VOL_SYNC') payload.useVolumeSyncKline = true;
      if (timeframe === 'BTC_POINT_BRICK') payload.useBtcPointBrickKline = true;

      pairsScanLoading.value = true;
      try {
        const res = await scanPairs(payload);
        const rows = (Array.isArray(res?.results) ? res.results : []).slice(0, requestTopN);
        const merged = rows
          .map((r) => `${normalizePairToken(r?.legA)}:${normalizePairToken(r?.legB)}`)
          .filter((s) => s && !s.startsWith(':') && !s.endsWith(':'));
        const csv = buildPairsConfigCsv(merged.join(','));
        if (!csv) {
          message.warning('Pairs Scanner 未返回可用配对结果');
          return;
        }
        if (!setPairsConfigParamValue(csv)) {
          message.warning('当前策略参数中未找到 pairsConfig');
          return;
        }
        message.success(`已填充 pairsConfig（${csv.split(',').length} 组）`);
      } catch (err) {
        message.error(err?.message || '调用 Pairs Scanner 失败');
      } finally {
        pairsScanLoading.value = false;
      }
    };

    const getPairsConfigFromParams = () => {
      if (!Array.isArray(formValue.value.parameters)) return '';
      const p = formValue.value.parameters.find(
        (x) => String(x?.name || '').trim().toLowerCase() === 'pairsconfig'
      );
      if (!p) return '';
      return buildPairsConfigCsv(p.value ?? p.defaultValue ?? '');
    };

    const derivePairLegsFromPairsConfig = (pairsCsv) => {
      const out = [];
      const seen = new Set();
      const text = buildPairsConfigCsv(pairsCsv);
      if (!text) return out;
      text.split(',').forEach((seg) => {
        const idx = seg.indexOf(':');
        if (idx <= 0 || idx >= seg.length - 1) return;
        const a = normalizePairToken(seg.slice(0, idx));
        const b = normalizePairToken(seg.slice(idx + 1));
        if (a && !seen.has(a)) {
          seen.add(a);
          out.push(a);
        }
        if (b && !seen.has(b)) {
          seen.add(b);
          out.push(b);
        }
      });
      return out;
    };

    const buildSymbolsForSubmit = () => {
      const strip = (s) => stripOkxSuffix(String(s ?? '').trim());
      if (!isScannerStrategy.value) {
        return formValue.value.symbols.map((s) => ({ WITHOUT_TIME: [strip(s?.name)] }));
      }
      const base = strip(formValue.value.symbols[0]?.name) || 'BTCUSDT';
      if (formValue.value.scannerUseWhitelistUniverse) {
        const rest = BACKTEST_INSTANCE_WHITELIST.filter((s) => s !== base);
        return [{ WITHOUT_TIME: [base] }, ...rest.map((s) => ({ WITHOUT_TIME: [s] }))];
      }
      const extras = formValue.value.symbols
        .slice(1)
        .map((s) => strip(s?.name))
        .filter(Boolean);
      const uniq = [...new Set([base, ...extras])];
      return uniq.map((s) => ({ WITHOUT_TIME: [s] }));
    };

    const exchangeOptions = computed(() => {
      if (isBtcSyntheticOhlcSelected.value) {
        return [
          { label: 'OKX', value: 'okx', disabled: true },
          { label: 'Binance', value: 'binance' }
        ];
      }
      return [{ label: 'OKX', value: 'okx' }, { label: 'Binance', value: 'binance' }];
    });
    const patternOptions = [{ label: 'OHLC', value: 'OHLC' }, { label: 'ORDERBOOK', value: 'ORDERBOOK' }];
    const matchingAlgorithmOptions = [
      { label: '最优价撮合 (Best Price)', value: 'BEST_PRICE' },
      { label: '市价撮合(盘口) (Market @ Best Bid/Ask)', value: 'MARKET_BEST' },
      { label: '中价撮合 (Mid Price)', value: 'MID_PRICE' },
      { label: '滑点模拟 (Slippage)', value: 'SLIPPAGE' }
    ];
    const timeframeOptions = [
        { label: '1m', value: '1m' }, { label: '3m', value: '3m' }, { label: '5m', value: '5m' },
        { label: '15m', value: '15m' }, { label: '30m', value: '30m' }, { label: '1H', value: '1H' },
        { label: '2H', value: '2H' }, { label: '4H', value: '4H' }, { label: '6H', value: '6H' },
        { label: '12H', value: '12H' }, { label: '1D', value: '1D' }, { label: '2D', value: '2D' },
        { label: '3D', value: '3D' }, { label: '1W', value: '1W' }, { label: '1M', value: '1M' },
        { label: '3M', value: '3M' },
        { label: 'BTCVOLSYNC (成交量驱动)', value: 'BTCVOLSYNC' },
        { label: 'BTCPOINTBRICK (砖石图)', value: 'BTCPOINTBRICK' }
    ];

    const timeframeMap = {
      '1m': 'ONE_MINUTE', '3m': 'THREE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE', '30m': 'THIRTY_MINUTE',
      '1H': 'ONE_HOUR', '2H': 'TWO_HOUR', '4H': 'FOUR_HOUR', '6H': 'SIX_HOUR', '12H': 'TWELVE_HOUR',
      '1D': 'ONE_DAY', '2D': 'TWO_DAY', '3D': 'THREE_DAY',
      '1W': 'ONE_WEEK',
      '1M': 'ONE_MONTH', '3M': 'THREE_MONTH',
      'BTCVOLSYNC': 'BTCVOLSYNC',
      'BTCPOINTBRICK': 'BTCPOINTBRICK'
    };

    const reverseTimeframeMap = Object.fromEntries(Object.entries(timeframeMap).map(([key, value]) => [value, key]));

    const rules = {
      name: { required: true, message: () => t('backtest_instances.form.name_required'), trigger: 'blur' },
      strategyTemplateId: { required: true, type: 'number', message: () => t('backtest_instances.form.strategy_template_required'), trigger: 'change' },
      startTime: { required: true, type: 'number', message: () => t('backtest_instances.form.start_time_required'), trigger: 'blur' },
      endTime: { required: true, type: 'number', message: () => t('backtest_instances.form.end_time_required'), trigger: 'blur' },
    };

    const addSymbol = () => {
      formValue.value.symbols.push({ name: '' });
    };

    const removeSymbol = (index) => {
      formValue.value.symbols.splice(index, 1);
    };

    const applyWhitelistSymbols = () => {
      formValue.value.symbols = BACKTEST_INSTANCE_WHITELIST.map(s => ({ name: s }));
      message.success(t('backtest_instances.form.fill_whitelist_symbols_success', { n: BACKTEST_INSTANCE_WHITELIST.length }));
    };

    const applyStartDayTop150Symbols = async () => {
      const st = formValue.value.startTime;
      if (st == null) {
        message.warning(t('backtest_instances.form.fill_start_day_top150_need_start'));
        return;
      }
      if (!canFillStartDayTop150.value) {
        message.warning(t('backtest_instances.form.fill_start_day_top150_need_binance'));
        return;
      }
      const date = new Date(st).toISOString().slice(0, 10);
      historyTop150Loading.value = true;
      try {
        const rows = await getBinanceHistoryDayTopVolume({ date, interval: '1h', limit: 150 });
        const syms = (Array.isArray(rows) ? rows : []).map((r) => r.symbol).filter(Boolean);
        if (!syms.length) {
          message.warning(t('backtest_instances.form.fill_start_day_top150_empty', { date }));
          return;
        }
        formValue.value.symbols = syms.map((s) => ({ name: s }));
        message.success(t('backtest_instances.form.fill_start_day_top150_success', { date, n: syms.length }));
      } catch (err) {
        message.error(err?.message || t('backtest_instances.form.fill_start_day_top150_error'));
      } finally {
        historyTop150Loading.value = false;
      }
    };

    /** 清空各交易腿已选合约；若已加载 Java 策略 descriptor，则恢复为对应腿数（避免「全选白名单」后留下大量空行） */
    const clearLegSymbols = () => {
      const descN = strategyDescriptor.value?.legs?.length;
      if (descN && descN > 0) {
        formValue.value.symbols = Array(descN).fill(null).map(() => ({ name: '' }));
      } else {
        formValue.value.symbols = formValue.value.symbols.map(() => ({ name: '' }));
      }
      message.success(t('backtest_instances.form.clear_leg_symbols_success'));
    };

    const handleExchangeChange = (value) => {
      subscriptionStore.fetchSubscriptions(value);
    };

    const handleTemplateChange = (templateId) => {
      if (!templateId) {
        strategyDescriptor.value = null;
        formValue.value.parameters = [];
        formValue.value.symbols = [{ name: '' }];
        return;
      }
      strategyDescriptor.value = null;
      strategyTemplateStore.fetchTemplateById(templateId)
        .then(async (fetchedTemplate) => {
          if (!fetchedTemplate) return;
          const template = fetchedTemplate.data ?? fetchedTemplate;
          formValue.value.parameters = (template.parameters || []).map(p => ({
            ...p,
            value: p.defaultValue
          }));

          let numberOfLegs = 1;
          try {
            const descRes = await getStrategyDescriptor(templateId);
            const desc = descRes?.data ?? descRes;
            if (desc?.legs?.length) {
              strategyDescriptor.value = desc;
              numberOfLegs = desc.legs.length;
            } else {
              const language = template.language || 'PYTHON';
              numberOfLegs = template.script
                ? parseNumLegsFromScript(template.script, language)
                : 1;
            }
          } catch {
            const language = template.language || 'PYTHON';
            numberOfLegs = template.script
              ? parseNumLegsFromScript(template.script, language)
              : 1;
          }
          if (isScannerStrategyTemplate(template)) {
            formValue.value.symbols = [{ name: 'BTCUSDT' }];
            formValue.value.scannerUseWhitelistUniverse = true;
          } else {
            formValue.value.symbols = Array(numberOfLegs > 0 ? numberOfLegs : 1).fill(null).map(() => ({ name: '' }));
          }
        })
        .catch(err => {
          message.error(t('backtest_instances.form.fetch_template_error'));
          console.error(err);
        });
    };

    onMounted(async () => {
      // Initial data fetching
      fetchBinanceHistorySymbols()
        .then((data) => {
          if (Array.isArray(data)) {
            binanceUmSymbols.value = data;
          }
        })
        .catch((err) => {
          console.warn('BacktestInstanceForm: fetchBinanceHistorySymbols failed', err?.message || err);
        });
      await strategyTemplateStore.fetchTemplates(0, 100);
      handleExchangeChange(formValue.value.exchange);

      if (isEditMode.value) {
        await backtestInstanceStore.fetchInstance(instanceId.value);
        const instance = backtestInstanceStore.instance;

        if (instance) {
          // Set simple form values from the instance
          formValue.value.name = instance.name;
          formValue.value.strategyTemplateId = instance.strategyTemplateId;

          // Fetch the full strategy template to get parameter definitions
          if (instance.strategyTemplateId) {
            const template = await strategyTemplateStore.fetchTemplateById(instance.strategyTemplateId);
            const savedParamsData = instance.params ? JSON.parse(instance.params) : {};
            
            // Combine template parameter definitions with saved instance values
            if (template && template.parameters) {
              const savedParamsMap = new Map(
                (savedParamsData.PARAMS || []).map(p => [p.NAME, p.VALUE])
              );

              formValue.value.parameters = template.parameters.map(p => ({
                ...p,
                value: savedParamsMap.has(p.name) ? String(savedParamsMap.get(p.name)) : p.defaultValue,
              }));
            }
            
            // Set other form values from saved params
            const params = savedParamsData;
            formValue.value.startTime = params.BACKTEST?.START_TIME || null;
            formValue.value.endTime = params.BACKTEST?.END_TIME || null;
            formValue.value.symbols = params.SYMBOLS?.map(s => ({ name: stripOkxSuffix(s?.WITHOUT_TIME?.[0] || '') })) || [{ name: '' }];
            formValue.value.exchange = params.ASSET_TYPE === 'CRYPTO' ? 'okx' : 'other';
            formValue.value.dataTypes.useDepth = params.DATA_TYPE?.USE_ORDER_BOOK || false;
            formValue.value.dataTypes.useTrade = params.DATA_TYPE?.USE_TRADE || false;
            formValue.value.dataTypes.ohlc = params.DATA_TYPE?.OHLC?.filter(o => o.USE).map(o => reverseTimeframeMap[o.TIME_TYPE]) || ['15m'];
            ohlcSelectionPrev.value = [...(formValue.value.dataTypes.ohlc || [])];
            formValue.value.backtestPattern.name = params.BACKTEST?.BACKTEST_PATTERN?.PATTERN_NAME || 'OHLC';
            formValue.value.backtestPattern.params = params.BACKTEST?.BACKTEST_PATTERN?.PATTERN_PARAMS || { miss_ratio: 0.01, slippage: 0.005 };
            formValue.value.matchingAlgorithm = params.CONFIG?.MATCHING_ALGORITHM || 'BEST_PRICE';
            try {
              const descRes = await getStrategyDescriptor(instance.strategyTemplateId);
              const desc = descRes?.data ?? descRes;
              if (desc?.legs?.length) strategyDescriptor.value = desc;
            } catch (_) {}
          }
        }
      }
    });

    watch(
      () => formValue.value.dataTypes?.ohlc,
      (ohlc) => {
        if (!Array.isArray(ohlc)) return;
        const hasV = ohlc.includes('BTCVOLSYNC');
        const hasB = ohlc.includes('BTCPOINTBRICK');
        if (hasV && hasB) {
          const prev = ohlcSelectionPrev.value;
          const addedV = hasV && !prev.includes('BTCVOLSYNC');
          const addedB = hasB && !prev.includes('BTCPOINTBRICK');
          let fixed = [...ohlc];
          if (addedB && !addedV) fixed = fixed.filter((x) => x !== 'BTCVOLSYNC');
          else if (addedV && !addedB) fixed = fixed.filter((x) => x !== 'BTCPOINTBRICK');
          else fixed = fixed.filter((x) => x !== 'BTCVOLSYNC');
          formValue.value.dataTypes.ohlc = fixed;
          ohlcSelectionPrev.value = [...fixed];
          return;
        }
        ohlcSelectionPrev.value = [...ohlc];
        if ((hasV || hasB) && formValue.value.exchange !== 'binance') {
          formValue.value.exchange = 'binance';
          handleExchangeChange('binance');
        }
      },
      { deep: true }
    );

    const handleSubmit = async () => {
      try {
        await formRef.value?.validate();

        const toBoolean = (v, defaultValue) => {
          if (v === true || v === false) return v;
          const raw = (v ?? defaultValue ?? '').toString().trim().toLowerCase();
          if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'y') return true;
          if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'n') return false;
          return false;
        };

        const rangePattern = /^\s*-?\d+(?:\.\d+)?\s*-\s*-?\d+(?:\.\d+)?\s*:\s*-?\d+(?:\.\d+)?\s*$/;

        const formattedParams = formValue.value.parameters.map(p => {
          const pname = String(p?.name || '').trim();
          const isPairsConfig = pname.toLowerCase() === 'pairsconfig';
          const dataType = isPairsConfig ? 'STRING' : (p.dataType || 'STRING');
          const rawValue = isPairsConfig
            ? buildPairsConfigCsv(p.value ?? p.defaultValue ?? '')
            : (p.value ?? p.defaultValue ?? '');

          let value;
          let valueType;

          if (dataType === 'BOOLEAN') {
            value = toBoolean(rawValue, p.defaultValue);
            valueType = 'BOOLEAN';
          } else if (dataType === 'STRING') {
            value = rawValue == null ? '' : String(rawValue);
            valueType = 'STRING';
          } else {
            const rawText = rawValue == null ? '' : String(rawValue).trim();

            // Numeric range input like "20-50:10" for optimization.
            if (rangePattern.test(rawText)) {
              value = rawText;
              valueType = 'RANGE';
            } else {
              const numValue = parseFloat(rawValue);
              value = Number.isFinite(numValue) ? numValue : null;
              if (dataType === 'INT') {
                valueType = 'INT';
              } else if (dataType === 'DOUBLE' || dataType === 'FLOAT') {
                valueType = Number.isFinite(numValue) && Number.isInteger(numValue) ? 'INT' : 'DECIMAL';
              } else {
                valueType = dataType;
              }
            }
          }

          return {
            NAME: p.name,
            TYPE: p.direction,
            VALUE: value,
            VALUE_TYPE: valueType
          };
        });

        const buildConfigFromDescriptor = () => {
          if (!strategyDescriptor.value?.legs?.length) return {};
          const config = {};
          strategyDescriptor.value.legs.forEach((leg, i) => {
            const s = formValue.value.symbols[i];
            if (s?.name) config[leg.id] = stripOkxSuffix(s.name);
          });
          return config;
        };
        const descriptorConfig = buildConfigFromDescriptor();
        const pairsConfigValue = getPairsConfigFromParams();
        const pairLegs = derivePairLegsFromPairsConfig(pairsConfigValue);
        const mergedConfig = {
          ...descriptorConfig,
          MATCHING_ALGORITHM: formValue.value.matchingAlgorithm,
          ...(pairsConfigValue ? { pairsConfig: pairsConfigValue } : {}),
          ...(pairLegs.length ? {
            primaryLeg: descriptorConfig.primaryLeg || pairLegs[0],
            secondaryLeg: descriptorConfig.secondaryLeg || (pairLegs[1] || pairLegs[0]),
            barLegs: pairLegs.join(','),
          } : {}),
        };

        if (isEditMode.value) {
          const paramsObject = {
            BACKTEST: {
              OUTPUT_REPORT: true,
              START_TIME: formValue.value.startTime,
              END_TIME: formValue.value.endTime,
              PERFORMANCE: {},
              BACKTEST_PATTERN: {
                PATTERN_NAME: formValue.value.backtestPattern.name,
                PATTERN_PARAMS: formValue.value.backtestPattern.params,
              },
              SEND_HEARTBEAT: false,
              HEARTBEAT_INTERVAL: 60000
            },
            IS_OPTIMIZE: false,
            STRATEGY_FILE: currentTemplate.value?.scriptPath || "",
            STUDIO_DB: "finone_crypto.db",
            ASSET_TYPE: "CRYPTO",
            RESULT_ID: generateUUID(),
            SYMBOLS: buildSymbolsForSubmit(),
            ...(Object.keys(mergedConfig).length ? { CONFIG: mergedConfig } : {}),
            PARAMS: formattedParams,
            CSV_OUTPUT_PATH: "backtest_results/",
            RATES_URL: "http://localhost:8080",
            STRATEGY_NAME: `backtestInstance_${instanceId.value}`,
            LOG_LEVEL: "INFO",
            DATA_TYPE: {
              USE_ORDER_BOOK: formValue.value.dataTypes.useDepth,
              USE_TRADE: formValue.value.dataTypes.useTrade,
              OHLC: formValue.value.dataTypes.ohlc.map(t => ({
                TYPE: "MID",
                TIME_TYPE: timeframeMap[t] || t.toUpperCase(),
                USE: true
              }))
            }
          };

          const payload = {
            name: formValue.value.name,
            strategyTemplateId: formValue.value.strategyTemplateId,
            params: JSON.stringify(paramsObject),
          };

          await backtestInstanceStore.updateInstance(instanceId.value, payload);
          message.success(t('backtest_instances.form.update_success_message'));

        } else {
          // Step 1: Create instance with minimal data to get an ID.
          const initialPayload = {
            name: formValue.value.name,
            strategyTemplateId: formValue.value.strategyTemplateId,
            params: JSON.stringify({ status: "initializing" }),
          };
          const newInstance = await backtestInstanceStore.createInstance(initialPayload);
          if (!newInstance || !newInstance.id) {
            throw new Error("Failed to create backtest instance or get a valid ID.");
          }
          const newInstanceId = newInstance.id;

          // Step 2: Build the full parameters with the new ID and update the instance.
          const paramsObject = {
             BACKTEST: {
                OUTPUT_REPORT: true,
                START_TIME: formValue.value.startTime,
                END_TIME: formValue.value.endTime,
                PERFORMANCE: {},
                BACKTEST_PATTERN: {
                  PATTERN_NAME: formValue.value.backtestPattern.name,
                  PATTERN_PARAMS: formValue.value.backtestPattern.params,
                },
                SEND_HEARTBEAT: false,
                HEARTBEAT_INTERVAL: 60000
              },
              IS_OPTIMIZE: false,
              STRATEGY_FILE: currentTemplate.value?.scriptPath || "",
              STUDIO_DB: "finone_crypto.db",
              ASSET_TYPE: "CRYPTO",
              RESULT_ID: generateUUID(),
              SYMBOLS: buildSymbolsForSubmit(),
              ...(Object.keys(mergedConfig).length ? { CONFIG: mergedConfig } : {}),
              PARAMS: formattedParams,
              CSV_OUTPUT_PATH: "backtest_results/",
              RATES_URL: "http://localhost:8080",
              STRATEGY_NAME: `backtestInstance_${newInstanceId}`,
              LOG_LEVEL: "INFO",
              DATA_TYPE: {
                USE_ORDER_BOOK: formValue.value.dataTypes.useDepth,
                USE_TRADE: formValue.value.dataTypes.useTrade,
                OHLC: formValue.value.dataTypes.ohlc.map(t => ({
                  TYPE: "MID",
                  TIME_TYPE: timeframeMap[t] || t.toUpperCase(),
                  USE: true
                }))
              }
          };
          
          const finalPayload = {
            name: formValue.value.name,
            strategyTemplateId: formValue.value.strategyTemplateId,
            params: JSON.stringify(paramsObject),
          };
          await backtestInstanceStore.updateInstance(newInstanceId, finalPayload);
          message.success(t('backtest_instances.form.create_success_message'));
        }
        
        router.push({ name: 'BacktestInstanceList' });
      } catch (err) {
        // Naive UI validation throws an array; API/runtime errors are Error objects.
        if (Array.isArray(err)) {
          console.error('Form validation failed', err);
          return;
        }
        console.error('Save failed', err);
        message.error(err?.message || error.value?.message || t('common.error_unexpected'));
      }
    };

    const handleCancel = () => {
      router.push({ name: 'BacktestInstanceList' });
    };

    return {
      formRef,
      formValue,
      rules,
      isEditMode,
      loading,
      currentTemplate,
      strategyDescriptor,
      strategyTemplateOptions,
      symbolOptions,
      exchangeOptions,
      isBtcSyntheticOhlcSelected,
      isScannerStrategy,
      patternOptions,
      matchingAlgorithmOptions,
      isJavaTemplate,
      timeframeOptions,
      BACKTEST_INSTANCE_WHITELIST,
      hasPairsConfigParam,
      pairsScanLoading,
      pairsScanTopN,
      pairsTopNOptions,
      pairsScannerSourceLabel,
      aboDynamicLoading,
      aboExcludeTopCapN,
      aboTurnoverTopN,
      aboExcludeTopCapOptions,
      aboTurnoverTopNOptions,
      buildAboDynamicWhitelist,
      fillPairsConfigFromScanner,
      ensurePairsConfigParam,
      strategyTemplateStore,
      handleSubmit,
      handleCancel,
      handleTemplateChange,
      handleExchangeChange,
      addSymbol,
      removeSymbol,
      applyWhitelistSymbols,
      applyStartDayTop150Symbols,
      historyTop150Loading,
      canFillStartDayTop150,
      clearLegSymbols,
      TrashIcon,
      AddIcon,
    };
  },
});
</script> 