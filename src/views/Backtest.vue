<template>
  <div>
    <nav-bar />
    <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">{{ $t('backtest.title') }}</h1>

      <div class="bg-white p-8 rounded-lg shadow-md mb-8">
        <h2 class="text-xl font-semibold mb-6 text-gray-700">{{ $t('backtest.parameters') }}</h2>
        <form @submit.prevent="runBacktest" class="space-y-6">

          <!-- 全局参数 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6">
            <div class="col-span-full">
              <label for="strategyTemplate" class="block text-sm font-medium text-gray-700">{{ $t('backtest.select_template') }}</label>
              <n-select
                id="strategyTemplate"
                v-model:value="selectedTemplateId"
                :options="templateOptions"
                :loading="templatesLoading"
                :placeholder="$t('backtest.select_template_placeholder')"
                @update:value="handleTemplateChange"
                class="mt-1"
                clearable
              />
            </div>
            <div>
              <label for="exchange" class="block text-sm font-medium text-gray-700">{{ $t('backtest.exchange') }}</label>
              <n-select v-model:value="coreParams.exchange" @update:value="handleExchangeChange" id="exchange" :options="exchangeOptions" class="mt-1" />
            </div>
            <div>
              <label for="startDate" class="block text-sm font-medium text-gray-700">{{ $t('backtest.start_date') }}</label>
              <input type="date" v-model="coreParams.startDate" id="startDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            </div>
            <div>
              <label for="endDate" class="block text-sm font-medium text-gray-700">{{ $t('backtest.end_date') }}</label>
              <input type="date" v-model="coreParams.endDate" id="endDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            </div>
          </div>

          <!-- 全局行情类型配置 -->
          <div class="space-y-4 border-b pb-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.data_type_config') }}</h3>
            <div class="flex items-center space-x-6">
              <n-checkbox v-model:checked="coreParams.dataTypes.useDepth">{{ $t('backtest.depth') }}</n-checkbox>
              <n-checkbox v-model:checked="coreParams.dataTypes.useTrade">{{ $t('backtest.trade') }}</n-checkbox>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.ohlc_period') }}</label>
              <n-select v-model:value="coreParams.dataTypes.ohlc" multiple :options="timeframeOptions" :placeholder="$t('backtest.select_period')" class="max-w-sm"/>
            </div>
          </div>

          <!-- 回测撮合模式配置 -->
          <div class="space-y-4 border-b pb-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.pattern_config') }}</h3>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.pattern_name') }}</label>
              <n-select v-model:value="coreParams.backtestPattern.name" :options="patternOptions" class="max-w-sm"/>
            </div>
            <div v-if="coreParams.backtestPattern.name === 'ORDERBOOK'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="missRatio" class="block text-sm font-medium text-gray-700">{{ $t('backtest.miss_ratio') }}</label>
                <input type="number" v-model.number="coreParams.backtestPattern.params.miss_ratio" id="missRatio" step="0.001" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              </div>
              <div>
                <label for="slippage" class="block text-sm font-medium text-gray-700">{{ $t('backtest.slippage') }}</label>
                <input type="number" v-model.number="coreParams.backtestPattern.params.slippage" id="slippage" step="0.001" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              </div>
            </div>
          </div>

          <!-- 交易腿配置 -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.leg_config') }}</h3>
            <div v-for="(leg, legIndex) in coreParams.legs" :key="legIndex" class="p-4 border rounded-lg bg-gray-50 space-y-4">
              <div class="flex justify-between items-center">
                <h4 class="font-semibold text-gray-700">{{ $t('backtest.leg_n', { n: legIndex + 1 }) }}</h4>
                <button v-if="coreParams.legs.length > 1" @click.prevent="removeLeg(legIndex)" type="button" class="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">{{ $t('backtest.select_instrument') }}</label>
                <n-select v-model:value="leg.symbols" multiple filterable :placeholder="$t('backtest.search_instrument')" :options="symbolOptions" class="mt-1" />
              </div>
            </div>
            <button @click.prevent="addLeg" type="button" class="w-full py-2 px-4 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">{{ $t('backtest.add_leg') }}</button>
          </div>

          <!-- 策略参数 -->
          <div v-if="Object.keys(strategyParams).length > 0" class="border-t pt-6">
              <h3 class="col-span-full text-lg font-medium text-gray-800">{{ $t('backtest.strategy_params') }}</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                <div v-for="(value, key) in strategyParams" :key="key">
                    <label :for="key" class="block text-sm font-medium text-gray-700">{{ key }}</label>
                    <input type="number" v-model.number="strategyParams[key]" :id="key" step="any" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
              </div>
          </div>
          
          <div class="flex justify-end pt-4">
            <button type="submit" :disabled="loading || !strategyCode" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
              {{ loading ? $t('backtest.running') : $t('backtest.run') }}
            </button>
          </div>
        </form>
      </div>

      <!-- 日志与结果显示区域 -->
      <div v-if="logs.length > 0" class="bg-white p-8 rounded-lg shadow-md mb-8">
        <h2 class="text-xl font-semibold mb-4 text-gray-700">{{ $t('backtest.logs') }}</h2>
        <div class="bg-gray-900 text-white font-mono text-sm rounded-md p-4 h-64 overflow-y-auto" ref="logContainer">
          <p v-for="(log, index) in logs" :key="index" :class="{'text-red-400': log.type === 'error'}">{{ log.message }}</p>
        </div>
      </div>
      <div v-if="results" class="bg-white p-8 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-6 text-gray-700">{{ $t('backtest.results') }}</h2>
        <div class="mb-8">
          <backtest-result-chart :chart-data="chartData"></backtest-result-chart>
        </div>
         <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
            <div class="bg-gray-100 p-4 rounded-lg">
                <p class="text-sm text-gray-500">{{ $t('backtest.net_pnl') }}</p>
                <p class="text-2xl font-semibold text-gray-800">{{ results && results.net_pnl ? results.net_pnl.toFixed(2) : 'N/A' }}</p>
            </div>
            <div class="bg-gray-100 p-4 rounded-lg">
                <p class="text-sm text-gray-500">{{ $t('backtest.sharpe_ratio') }}</p>
                <p class="text-2xl font-semibold text-gray-800">{{ results && results.sharpe_ratio ? results.sharpe_ratio.toFixed(2) : 'N/A' }}</p>
            </div>
            <div class="bg-gray-100 p-4 rounded-lg">
                <p class="text-sm text-gray-500">{{ $t('backtest.total_trades') }}</p>
                <p class="text-2xl font-semibold text-gray-800">{{ tradeLog ? tradeLog.length : '0' }}</p>
            </div>
         </div>
         <div>
           <h3 class="text-lg font-medium mb-4 text-gray-700">{{ $t('backtest.trade_history') }}</h3>
           <div class="overflow-x-auto">
               <table class="min-w-full divide-y divide-gray-200">
                   <thead class="bg-gray-50">
                       <tr><th v-for="header in tradeLogHeaders" :key="header" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ tradeLogHeaderMap[header] || header }}</th></tr>
                   </thead>
                   <tbody class="bg-white divide-y divide-gray-200">
                       <tr v-for="(trade, index) in tradeLog" :key="index">
                           <td v-for="header in tradeLogHeaders" :key="header" class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ formatTradeCell(trade, header) }}</td>
                       </tr>
                   </tbody>
               </table>
           </div>
           <p v-if="tradeLog.length === 0" class="text-sm text-gray-600 mt-4">{{ $t('backtest.no_trades') }}</p>
         </div>
      </div>
      <div v-if="error" class="mt-4 text-red-500 bg-red-100 p-4 rounded-md">
        <strong>{{ $t('backtest.error') }}</strong> {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import Stomp from 'stompjs';
import { NSelect, NCheckbox, useMessage } from 'naive-ui';
import { useSubscriptionStore } from '@/stores/subscription';
import { useStrategyTemplateStore } from '@/stores/strategyTemplate';
import { storeToRefs } from 'pinia';
import NavBar from '@/components/NavBar.vue';
import BacktestResultChart from '@/components/BacktestResultChart.vue';

const defaultLeg = () => ({
  symbols: []
});

export default defineComponent({
  name: 'Backtest',
  components: {
    NavBar,
    BacktestResultChart,
    NSelect,
    NCheckbox,
  },
  setup() {
    const { t } = useI18n();
    const message = useMessage();
    const logContainer = ref(null);

    // Stores
    const subscriptionStore = useSubscriptionStore();
    const templateStore = useStrategyTemplateStore();
    const { subscribedSymbols } = storeToRefs(subscriptionStore);
    const { templates: strategyTemplates, loading: templatesLoading, currentTemplate } = storeToRefs(templateStore);

    // Reactive State
    const strategyCode = ref('');
    const selectedTemplateId = ref(null);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10);
    
    const coreParams = ref({
      legs: [defaultLeg()],
      dataTypes: {
        useDepth: false,
        useTrade: false,
        ohlc: ['15m'],
      },
      startDate: startDate,
      endDate: endDate,
      exchange: 'okx',
      backtestPattern: {
        name: 'OHLC',
        params: {
          miss_ratio: 0.01,
          slippage: 0.005,
        },
      },
    });

    const strategyParams = ref({});
    const loading = ref(false);
    const results = ref(null);
    const chartData = ref(null);
    const error = ref(null);
    const logs = ref([]);
    const stompClient = ref(null);
    const backtestId = ref(null);
    const tradeLog = ref([]);

    // Static Options
    const exchangeOptions = [{ label: 'OKX', value: 'okx' }, { label: 'Binance', value: 'binance' }];
    const patternOptions = [{ label: 'OHLC', value: 'OHLC' }, { label: 'ORDERBOOK', value: 'ORDERBOOK' }];
    const timeframeMap = { '1m': 'ONE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE', '1h': 'ONE_HOUR', '4h': 'FOUR_HOUR', '12h': 'TWELVE_HOUR', '1d': 'ONE_DAY' };
    const timeframeOptions = [
        { label: '1m', value: '1m' }, { label: '3m', value: '3m' }, { label: '5m', value: '5m' },
        { label: '15m', value: '15m' }, { label: '30m', value: '30m' }, { label: '1H', value: '1H' },
        { label: '2H', value: '2H' }, { label: '4H', value: '4H' }, { label: '6H', value: '6H' },
        { label: '12H', value: '12H' }, { label: '1D', value: '1D' }, { label: '2D', value: '2D' },
        { label: '3D', value: '3D' }, { label: '1W', value: '1W' }, { label: '1M', value: '1M' },
        { label: '3M', value: '3M' }
    ];

    // Computed Properties
    const templateOptions = computed(() =>
      strategyTemplates.value.map(t => ({ label: t.name, value: t.id }))
    );

    const symbolOptions = computed(() => 
      Array.isArray(subscribedSymbols.value) ? subscribedSymbols.value.map(s => ({ label: s, value: s })) : []
    );

    const tradeLogHeaders = computed(() => 
      tradeLog.value.length > 0 ? Object.keys(tradeLog.value[0]) : []
    );

    const tradeLogHeaderMap = computed(() => ({
      datetime: t('backtest.trade_header_datetime'),
      symbol: t('backtest.trade_header_symbol'),
      action: t('backtest.trade_header_action'),
      side: t('backtest.trade_header_side'),
      size: t('backtest.trade_header_size'),
      avg_cost: t('backtest.trade_header_avg_cost'),
      price: t('backtest.trade_header_price'),
      pnl_settle_ccy: t('backtest.trade_header_pnl_ccy'),
      pnl: t('backtest.trade_header_pnl_usd'),
      fee: t('backtest.trade_header_fee'),
    }));

    // Methods
    const addLeg = () => coreParams.value.legs.push(defaultLeg());
    const removeLeg = (index) => coreParams.value.legs.splice(index, 1);
    
    const handleExchangeChange = async (value) => {
      coreParams.value.exchange = value;
      coreParams.value.legs = [defaultLeg()];
      await subscriptionStore.fetchSubscriptions(value);
    };

    const handleTemplateChange = async (templateId) => {
      if (!templateId) {
        strategyCode.value = '';
        strategyParams.value = {};
        coreParams.value.legs = [defaultLeg()];
        return;
      }
      
      await templateStore.fetchTemplateById(templateId);
      const template = currentTemplate.value; // Use the ref from storeToRefs

      if (template && template.script) {
        strategyCode.value = template.script;
        
        const params = {};
        if (template.parameters) {
            template.parameters.forEach(p => {
                const value = !isNaN(parseFloat(p.defaultValue)) && p.dataType !== 'STRING'
                    ? parseFloat(p.defaultValue)
                    : p.defaultValue;
                params[p.name] = value;
            });
        }
        strategyParams.value = params;
        
        let legCount = 0;
        const legRegex = /def\s+(on_receive_ohlc|on_receive_depth)\s*\(([^)]*)\)/g;
        let match;
        while ((match = legRegex.exec(template.script)) !== null) {
            const args = match[2].split(',').map(arg => arg.trim());
            const handlerLegs = args.filter(arg => arg !== 'self').length;
            legCount += handlerLegs;
        }
        if (legCount === 0 && template.script.length > 0) legCount = 1;

        const currentCount = coreParams.value.legs.length;
        const diff = legCount - currentCount;
        if (diff > 0) {
            for (let i = 0; i < diff; i++) addLeg();
        } else if (diff < 0) {
            coreParams.value.legs.splice(legCount);
        }
      }
    };

    const processChartData = (report) => {
      if (!report || !report.equity_curve) return { labels: [], datasets: [] };
      const equityCurve = report.equity_curve;
      return {
        labels: equityCurve.map(item => new Date(item.timestamp).toLocaleString()),
        datasets: [{
          label: 'Equity Curve',
          data: equityCurve.map(item => item.equity),
          borderColor: '#4F46E5',
          tension: 0.1,
          fill: false
        }]
      };
    };

    const connectWebSocket = () => {
        const socket = new SockJS(`${import.meta.env.VITE_API_BASE_URL}/ws`);
        stompClient.value = Stomp.over(socket);
        stompClient.value.connect({}, () => {
            logs.value.push({type: 'info', message: 'WebSocket connected successfully. Waiting for backtest data...'});
            stompClient.value.subscribe(`/topic/backtest/${backtestId.value}`, (message) => {
                try {
                    const body = JSON.parse(message.body);
                    if (body.type === 'log' || body.type === 'error') {
                        if (body.data) logs.value.push({ type: body.type, message: body.data });
                    } else if (body.report) {
                        results.value = body.report;
                        chartData.value = processChartData(body.report);
                        tradeLog.value = body.report.trade_log || [];
                        loading.value = false;
                        stompClient.value.disconnect();
                    } else if (body.type === 'finished') {
                        logs.value.push({ type: 'info', message: body.data });
                        loading.value = false;
                        stompClient.value.disconnect();
                    }
                } catch (e) {
                    logs.value.push({type: 'error', message: 'Error processing message: ' + e.message});
                }
            });
        }, () => {
            logs.value.push({type: 'error', message: 'WebSocket connection error.'});
            loading.value = false;
        });
    };
    
    const runBacktest = async () => {
        if (!strategyCode.value) {
            message.error(t('backtest.errors.no_template_selected'));
            return;
        }

        loading.value = true;
        results.value = null;
        chartData.value = null;
        error.value = null;
        logs.value = [];
        tradeLog.value = [];
        
        const payload = {
            strategyCode: strategyCode.value,
            SYMBOLS: coreParams.value.legs.map(leg => ({
                WITHOUT_TIME: leg.symbols.map(s => s.includes('.') ? s : `${s}.${coreParams.value.exchange}`)
            })),
            BACKTEST: {
                OUTPUT_REPORT: true,
                START_TIME: new Date(coreParams.value.startDate).getTime(),
                END_TIME: new Date(coreParams.value.endDate).getTime(),
                BACKTEST_PATTERN: {
                    PATTERN_NAME: coreParams.value.backtestPattern.name,
                    PATTERN_PARAMS: coreParams.value.backtestPattern.name === 'ORDERBOOK' ? coreParams.value.backtestPattern.params : {}
                }
            },
            DATA_TYPE: {
                USE_ORDER_BOOK: coreParams.value.dataTypes.useDepth,
                USE_TRADE: coreParams.value.dataTypes.useTrade,
                OHLC: coreParams.value.dataTypes.ohlc.filter(t => t).map(t => ({
                    TYPE: 'MID',
                    TIME_TYPE: timeframeMap[t] || 'FIFTEEN_MINUTE',
                    USE: true
                }))
            },
            PARAMS: strategyParams.value,
            LOG_LEVEL: 'INFO'
        };

        try {
            backtestId.value = null;
            const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/v1/backtest/run`;
            const response = await axios.post(apiUrl, payload, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.data && response.data.backtestId) {
                backtestId.value = response.data.backtestId;
                connectWebSocket();
            } else {
                throw new Error(t('backtest.errors.failed_to_start'));
            }
        } catch (err) {
            error.value = err.response?.data?.detail || err.message || t('backtest.errors.general_error');
            loading.value = false;
        }
    };
    
    const formatTradeCell = (trade, header) => {
      const value = trade[header];
      if (typeof value === 'number') return value.toFixed(4);
      return value;
    };

    // Lifecycle Hook
    onMounted(() => {
      subscriptionStore.fetchSubscriptions(coreParams.value.exchange);
      templateStore.fetchTemplates(0, 1000); // Fetch all for dropdown
    });

    watch(logs, async () => {
      await nextTick();
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    }, { deep: true });

    return {
      t,
      logContainer,
      coreParams,
      exchangeOptions,
      patternOptions,
      timeframeOptions,
      strategyParams,
      loading,
      results,
      chartData,
      error,
      logs,
      tradeLog,
      selectedTemplateId,
      templatesLoading,
      templateOptions,
      symbolOptions,
      tradeLogHeaders,
      tradeLogHeaderMap,
      strategyCode,
      addLeg,
      removeLeg,
      handleExchangeChange,
      handleTemplateChange,
      runBacktest,
      formatTradeCell,
    };
  }
});
</script>

<style scoped>
/* 可以根据需要添加一些样式 */
</style>