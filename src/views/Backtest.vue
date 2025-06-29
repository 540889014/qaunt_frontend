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
              <label for="strategyFile" class="block text-sm font-medium text-gray-700">{{ $t('backtest.select_strategy_file') }}</label>
              <input type="file" @change="handleFileSelect" id="strategyFile" accept=".py" class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
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
import { defineComponent } from 'vue';
import axios from 'axios';
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import Stomp from 'stompjs';
import { NSelect, NCheckbox } from 'naive-ui';
import { useSubscriptionStore } from '@/stores/subscription';
import { mapState, mapActions } from 'pinia';
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
  data() {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10);

    return {
      strategyCode: '',
      coreParams: {
        legs: [defaultLeg()],
        /* 全局唯一行情类型配置 */
        dataTypes: {
          useDepth: false,
          useTrade: false,
          /* 直接就是周期字符串数组，默认 15m */
          ohlc: ['15m']
        },
        startDate: startDate,
        endDate: endDate,
        exchange: 'okx',
        backtestPattern: {
          name: 'OHLC',
          params: {
            miss_ratio: 0.01,
            slippage: 0.005
          }
        },
      },
      exchangeOptions: [{ label: 'OKX', value: 'okx' }, { label: 'Binance', value: 'binance' }],
      patternOptions: [
        { label: 'OHLC', value: 'OHLC' },
        { label: 'ORDERBOOK', value: 'ORDERBOOK' }
      ],
      timeframeMap: { '1m': 'ONE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE', '1h': 'ONE_HOUR', '4h': 'FOUR_HOUR', '12h': 'TWELVE_HOUR', '1d': 'ONE_DAY' },
      timeframeOptions: [
        { label: '1m', value: '1m' },
        { label: '3m', value: '3m' },
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '30m', value: '30m' },
        { label: '1H', value: '1H' },
        { label: '2H', value: '2H' },
        { label: '4H', value: '4H' },
        { label: '6H', value: '6H' },
        { label: '12H', value: '12H' },
        { label: '1D', value: '1D' },
        { label: '2D', value: '2D' },
        { label: '3D', value: '3D' },
        { label: '1W', value: '1W' },
        { label: '1M', value: '1M' },
        { label: '3M', value: '3M' }
      ],
      strategyParams: {},
      loading: false,
      results: null,
      chartData: null,
      error: null,
      logs: [],
      stompClient: null,
      backtestId: null,
      tradeLog: [],
    };
  },
  watch: {
    logs() { this.$nextTick(() => { if (this.$refs.logContainer) this.$refs.logContainer.scrollTop = this.$refs.logContainer.scrollHeight; }); }
  },
  computed: {
    ...mapState(useSubscriptionStore, ['subscribedSymbols']),
    symbolOptions() { return Array.isArray(this.subscribedSymbols) ? this.subscribedSymbols.map(s => ({ label: s, value: s })) : []; },
    tradeLogHeaders() { return this.tradeLog.length > 0 ? Object.keys(this.tradeLog[0]) : []; },
    tradeLogHeaderMap() {
      return {
        datetime: '時間', symbol: '取引ペア', action: '操作', side: '方向', size: '数量', avg_cost: '参入価格',
        price: '約定/決済価格', pnl_settle_ccy: '損益(コイン)', pnl: '損益(USD)', fee: '手数料'
      };
    }
  },
  methods: {
    ...mapActions(useSubscriptionStore, ['fetchSubscriptions']),
    addLeg() { this.coreParams.legs.push(defaultLeg()); },
    removeLeg(index) { this.coreParams.legs.splice(index, 1); },
    /* 全局 OHLC 周期管理 */
    addOhlc() { this.coreParams.dataTypes.ohlc.push('1h'); },
    removeOhlc(i) { this.coreParams.dataTypes.ohlc.splice(i, 1); },
    async handleExchangeChange(value) {
      this.coreParams.exchange = value;
      this.coreParams.legs = [defaultLeg()];
      await this.fetchSubscriptions(value);
    },
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.strategyCode = e.target.result;
                const code = this.strategyCode;
                let match;

                // 1. Auto-detect strategy params from class attributes
                const params = {};
                const classBodyRegex = /class\s+Strategy[\s\S]*?:([\s\S]*?)^\s*def\s+/m;
                const bodyMatch = code.match(classBodyRegex);
                
                if (bodyMatch) {
                    const body = bodyMatch[1];
                    const paramRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+)/gm;
                    while ((match = paramRegex.exec(body)) !== null) {
                        const key = match[1];
                        const value = parseFloat(match[2]);
                        if (!['exchange', 'symbols'].includes(key) && !isNaN(value)) {
                            params[key] = value;
                        }
                    }
                }
                
                // 2. Fallback to @param annotations
                const paramAnnotationRegex = /@param\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+)/g;
                while ((match = paramAnnotationRegex.exec(code)) !== null) {
                    const key = match[1];
                    const value = parseFloat(match[2]);
                    if (!params.hasOwnProperty(key) && !isNaN(value)) {
                         params[key] = value;
                    }
                }
                this.strategyParams = params;

                // 2. Auto-detect number of legs from handler functions
                let legCount = 0;
                const legRegex = /def\s+(on_receive_ohlc|on_receive_depth)\s*\(([^)]*)\)/g;
                while ((match = legRegex.exec(code)) !== null) {
                    const args = match[2].split(',').map(arg => arg.trim());
                    // The first argument is always 'self', so we count the rest
                    const handlerLegs = args.filter(arg => arg !== 'self').length;
                    legCount += handlerLegs;
                }
                
                // Default to 1 leg if a file is loaded but no specific handlers are found
                if (legCount === 0 && code.length > 0) {
                    legCount = 1;
                }

                // 3. Adjust UI to show the correct number of legs
                const currentCount = this.coreParams.legs.length;
                const diff = legCount - currentCount;

                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        this.addLeg();
                    }
                } else if (diff < 0) {
                    this.coreParams.legs.splice(legCount);
                }
            };
            reader.readAsText(file);
        }
    },
    formatTradeCell(trade, header) {
      if (typeof trade[header] === 'number') {
        return trade[header].toFixed(4);
      }
      return trade[header];
    },
    async runBacktest() {
      this.loading = true;
      this.results = null;
      this.chartData = null;
      this.error = null;
      this.logs = [];
      this.tradeLog = [];

      const payload = {
        strategyCode: this.strategyCode,
        SYMBOLS: this.coreParams.legs.map(leg => ({
          WITHOUT_TIME: leg.symbols.map(s => s.includes('.') ? s : `${s}.${this.coreParams.exchange}`)
        })),
        BACKTEST: {
          OUTPUT_REPORT: true,
          START_TIME: new Date(this.coreParams.startDate).getTime(),
          END_TIME: new Date(this.coreParams.endDate).getTime(),
          BACKTEST_PATTERN: {
            PATTERN_NAME: this.coreParams.backtestPattern.name,
            PATTERN_PARAMS: this.coreParams.backtestPattern.name === 'ORDERBOOK'
              ? this.coreParams.backtestPattern.params
              : {}
          }
        },
        DATA_TYPE: {
          USE_ORDER_BOOK: this.coreParams.dataTypes.useDepth,
          USE_TRADE: this.coreParams.dataTypes.useTrade,
          OHLC: this.coreParams.dataTypes.ohlc
            .filter(t => t) // 过滤掉空值
            .map(t => ({
              TYPE: 'MID',
              TIME_TYPE: this.timeframeMap[t] || 'FIFTEEN_MINUTE',
              USE: true
            }))
        },
        PARAMS: this.strategyParams,
        LOG_LEVEL: 'INFO'
      };

      try {
        this.backtestId = null; // 重置
        const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/v1/backtest/run`;
        const response = await axios.post(apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Backend response:', response.data); // 添加日志，用于调试
        if (response.data && response.data.backtestId) {
          this.backtestId = response.data.backtestId;
          this.connectWebSocket();
        } else {
          throw new Error(this.$t('backtest.errors.failed_to_start'));
        }
      } catch (err) {
        this.error = err.response ? err.response.data.detail || this.$t('backtest.errors.general_error') : err.message;
        this.loading = false;
      }
    },

    connectWebSocket() {
      const socket = new SockJS(`${import.meta.env.VITE_API_BASE_URL}/ws`);
      this.stompClient = Stomp.over(socket);

      this.stompClient.connect({}, frame => {
        this.logs.push({type: 'info', message: 'WebSocket connected successfully. Waiting for backtest data...'});
        this.stompClient.subscribe(`/topic/backtest/${this.backtestId}`, (message) => {
          console.log('WebSocket message received:', message.body); // 添加日志，用于调试
          try {
            const body = JSON.parse(message.body);

            if (body.type === 'log' || body.type === 'error') {
              if (body.data) {
                this.logs.push({
                  type: body.type === 'error' ? 'error' : 'info',
                  message: body.data
                });
              }
            } else if (body.report) {
              this.results = body.report;
              this.chartData = this.processChartData(body.report);
              this.tradeLog = body.report.trade_log || [];
              this.loading = false;
              this.stompClient.disconnect();
            } else if (body.type === 'finished') {
              this.logs.push({ type: 'info', message: body.data });
              this.loading = false;
              this.stompClient.disconnect();
            }
          } catch (e) {
            this.logs.push({type: 'error', message: 'Error processing message: ' + e.message});
          }
        });
      }, error => {
        this.logs.push({type: 'error', message: 'WebSocket connection error: ' + error});
        this.loading = false;
      });
    },

    processChartData(report) {
      if (!report || !report.equity_curve) {
        return { labels: [], datasets: [] };
      }
      const equityCurve = report.equity_curve;
      return {
        labels: equityCurve.map(item => new Date(item.timestamp).toLocaleString()),
        datasets: [
          {
            label: 'Equity Curve',
            data: equityCurve.map(item => item.equity),
            borderColor: '#4F46E5',
            tension: 0.1,
            fill: false
          }
        ]
      };
    }
  },
  async mounted() {
    await this.fetchSubscriptions(this.coreParams.exchange);
  }
});
</script>

<style scoped>
/* 可以根据需要添加一些样式 */
</style>