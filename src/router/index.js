import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Login from '../views/Login.vue'
import Subscriptions from '../views/Subscriptions.vue'
import SpreadTool from '../views/SpreadTool.vue'
import StatisticalArbitrage from '../views/StatisticalArbitrage.vue'
import Backtest from '../views/Backtest.vue'
import AgentCenter from '../views/AgentCenter.vue'
import UserManagement from '@/views/UserManagement.vue'
import StrategyTemplateList from '@/views/StrategyTemplateList.vue'
import StrategyTemplateForm from '@/views/StrategyTemplateForm.vue'
import BacktestInstanceList from '@/views/BacktestInstanceList.vue'
import BacktestInstanceForm from '@/views/BacktestInstanceForm.vue'
import PairsScanner from '@/views/PairsScanner.vue'
import EulerGoldenPairs from '@/views/EulerGoldenPairs.vue'
import DataConverter from '@/views/DataConverter.vue'
import TrendResearchLab from '@/views/TrendResearchLab.vue'
import TrendValidationReport from '@/views/TrendValidationReport.vue'
import PairsValidationReport from '@/views/PairsValidationReport.vue'
import KlineSyncToLive from '@/views/KlineSyncToLive.vue'
import BinanceHistoryDownload from '@/views/BinanceHistoryDownload.vue'
import BinanceVisionTradesDownload from '@/views/BinanceVisionTradesDownload.vue'
import BtcVolumeSyncKline from '@/views/BtcVolumeSyncKline.vue'
import BtcPointBrickKline from '@/views/BtcPointBrickKline.vue'
import BtcPointBrickKlineFreeBenchmark from '@/views/BtcPointBrickKlineFreeBenchmark.vue'
import EulerOiBrickBenchmark from '@/views/EulerOiBrickBenchmark.vue'
import EulerOiBrickBenchmarkStrategyOptimize from '@/views/EulerOiBrickBenchmarkStrategyOptimize.vue'
import EulerOiVolumeBrickBenchmarkStrategyOptimize from '@/views/EulerOiVolumeBrickBenchmarkStrategyOptimize.vue'
import SpreadSyntheticKline from '@/views/SpreadSyntheticKline.vue'
import BinanceJbarKline from '@/views/BinanceJbarKline.vue'
import BinanceTopVolume from '@/views/BinanceTopVolume.vue'
import BinanceAboDynamicWhitelist from '@/views/BinanceAboDynamicWhitelist.vue'
import AltClockBrickKline from '@/views/AltClockBrickKline.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/agent',
    name: 'AgentCenter',
    component: AgentCenter,
    meta: { requiresAuth: true, title: 'Agent Research Center' }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { title: 'ログイン' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, title: 'ダッシュボード' }
  },
  {
    path: '/user-management',
    name: 'UserManagement',
    component: UserManagement,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/subscriptions',
    name: 'Subscriptions',
    component: Subscriptions,
    meta: { requiresAuth: true, title: '購読管理' }
  },
  {
    path: '/spread-tool',
    name: 'SpreadTool',
    component: SpreadTool,
    meta: { requiresAuth: true, title: 'スプレッドツール' }
  },
  {
    path: '/statistical-arbitrage',
    name: 'StatisticalArbitrage',
    component: StatisticalArbitrage,
    meta: { requiresAuth: true, title: '統計的裁定' }
  },
  {
    path: '/pairs-scanner',
    name: 'PairsScanner',
    component: PairsScanner,
    meta: { requiresAuth: true, title: 'Pairs Scanner' }
  },
  {
    path: '/euler-golden-pairs',
    name: 'EulerGoldenPairs',
    component: EulerGoldenPairs,
    meta: { requiresAuth: true, title: 'Euler Golden Pairs' }
  },
  {
    path: '/data-converter',
    name: 'DataConverter',
    component: DataConverter,
    meta: { requiresAuth: true, title: 'Data Converter' }
  },
  {
    path: '/kline-sync-to-live',
    name: 'KlineSyncToLive',
    component: KlineSyncToLive,
    meta: { requiresAuth: true, title: 'K线同步到实盘' }
  },
  {
    path: '/binance-history-download',
    name: 'BinanceHistoryDownload',
    component: BinanceHistoryDownload,
    meta: { requiresAuth: true, title: '币安历史K线' }
  },
  {
    path: '/binance-vision-trades',
    name: 'BinanceVisionTradesDownload',
    component: BinanceVisionTradesDownload,
    meta: { requiresAuth: true, title: '币安月度成交 Trades' }
  },
  {
    path: '/trend-research',
    name: 'TrendResearchLab',
    component: TrendResearchLab,
    meta: { requiresAuth: true, title: 'Trend Research Lab' }
  },
  {
    path: '/trend-validation-report',
    name: 'TrendValidationReport',
    component: TrendValidationReport,
    meta: { requiresAuth: true, title: 'Trend Validation Report' }
  },
  {
    path: '/pairs-validation-report',
    name: 'PairsValidationReport',
    component: PairsValidationReport,
    meta: { requiresAuth: true, title: 'Pairs Validation Report' }
  },
  {
    path: '/volume-sync-kline',
    name: 'BtcVolumeSyncKline',
    component: BtcVolumeSyncKline,
    meta: { requiresAuth: true, title: 'Volume Sync Kline' }
  },
  {
    path: '/btc-point-brick-kline',
    name: 'BtcPointBrickKline',
    component: BtcPointBrickKline,
    meta: { requiresAuth: true, title: 'BTC Point Brick Kline' }
  },
  {
    path: '/btc-point-brick-kline-free-benchmark',
    name: 'BtcPointBrickKlineFreeBenchmark',
    component: BtcPointBrickKlineFreeBenchmark,
    meta: { requiresAuth: true, title: '币安砖石K线（自由ABO基准）' }
  },
  {
    path: '/euler-oi-brick-benchmark',
    name: 'EulerOiBrickBenchmark',
    component: EulerOiBrickBenchmark,
    meta: { requiresAuth: true, title: '单边欧拉·OI加权（点砖+metrics）' }
  },
  {
    path: '/euler-oi-brick-benchmark-strategy-optimize',
    name: 'EulerOiBrickBenchmarkStrategyOptimize',
    component: EulerOiBrickBenchmarkStrategyOptimize,
    meta: { requiresAuth: true, title: '（策略优化）单边欧拉·OI加权（点砖+metrics）' }
  },
  {
    path: '/euler-oi-volume-brick-benchmark-strategy-optimize',
    name: 'EulerOiVolumeBrickBenchmarkStrategyOptimize',
    component: EulerOiVolumeBrickBenchmarkStrategyOptimize,
    meta: { requiresAuth: true, title: '（策略优化）单边欧拉·OI加权（成交额砖+metrics）' }
  },
  {
    path: '/spread-synthetic-kline',
    name: 'SpreadSyntheticKline',
    component: SpreadSyntheticKline,
    meta: { requiresAuth: true, title: 'Spread Synthetic Kline' }
  },
  {
    path: '/binance-jbar-kline',
    name: 'BinanceJbarKline',
    component: BinanceJbarKline,
    meta: { requiresAuth: true, title: 'Binance Jbar Kline' }
  },
  {
    path: '/binance-jbar-kline-free-benchmark',
    name: 'BinanceJbarKlineFreeBenchmark',
    component: BinanceJbarKline,
    meta: { requiresAuth: true, title: '币安常规K线（自由ABO基准）' }
  },
  {
    path: '/binance-top-volume',
    name: 'BinanceTopVolume',
    component: BinanceTopVolume,
    meta: { requiresAuth: true, title: '币安U本位永续成交量Top100' }
  },
  {
    path: '/binance-abo-whitelist',
    name: 'BinanceAboDynamicWhitelist',
    component: BinanceAboDynamicWhitelist,
    meta: { requiresAuth: true, title: '币安ABO动态白名单' }
  },
  {
    path: '/alt-clock-brick-kline',
    name: 'AltClockBrickKline',
    component: AltClockBrickKline,
    meta: { requiresAuth: true, title: '山寨驱动砖石K线' }
  },
  {
    path: '/backtest',
    name: 'Backtest',
    component: Backtest,
    meta: { requiresAuth: true, title: 'バックテスト' }
  },
  {
    path: '/strategy-templates',
    name: 'StrategyTemplateList',
    component: StrategyTemplateList,
    meta: { requiresAuth: true }
  },
  {
    path: '/strategy-templates/new',
    name: 'StrategyTemplateCreate',
    component: StrategyTemplateForm,
    meta: { requiresAuth: true }
  },
  {
    path: '/strategy-templates/:id/edit',
    name: 'StrategyTemplateEdit',
    component: StrategyTemplateForm,
    meta: { requiresAuth: true }
  },
  {
    path: '/backtest-instances',
    name: 'BacktestInstanceList',
    component: BacktestInstanceList,
    meta: { requiresAuth: true }
  },
  {
    path: '/backtest-instances/new',
    name: 'BacktestInstanceCreate',
    component: BacktestInstanceForm,
    meta: { requiresAuth: true }
  },
  {
    path: '/backtest-instances/:id/edit',
    name: 'BacktestInstanceEdit',
    component: BacktestInstanceForm,
    meta: { requiresAuth: true }
  },
  {
    path: '/backtest-reports/:strategyName',
    name: 'BacktestReport',
    component: () => import('@/views/BacktestReport.vue'),
    props: true,
    meta: { requiresAuth: true, title: 'Backtest Report' }
  },
  {
    path: '/backtest-instances/:instanceId/report',
    name: 'BacktestReportByInstance',
    component: () => import('@/views/BacktestReport.vue'),
    props: true,
    meta: { requiresAuth: true, title: 'Backtest Report' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  // 确保在路由守卫开始时，store的状态与localStorage同步
  if (!authStore.token && localStorage.getItem('token')) {
    authStore.checkAuth();
  }

  const isAuthenticated = authStore.isAuthenticated;
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    // 用户未登录且目标页面需要认证，跳转到登录页
    next({ name: 'Login' });
  } else if (to.name === 'Login' && isAuthenticated) {
    // 如果用户已登录，访问登录页时直接跳转到仪表盘
    next({ name: 'Dashboard' });
  } else {
    // 其他情况正常放行
    next();
  }
});

export default router 