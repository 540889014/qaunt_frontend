import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Login from '../views/Login.vue'
import Subscriptions from '../views/Subscriptions.vue'
import SpreadTool from '../views/SpreadTool.vue'
import StatisticalArbitrage from '../views/StatisticalArbitrage.vue'
import Backtest from '../views/Backtest.vue'
import UserManagement from '@/views/UserManagement.vue'
import StrategyTemplateList from '@/views/StrategyTemplateList.vue'
import StrategyTemplateForm from '@/views/StrategyTemplateForm.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
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