<template>
  <!-- relative + 高层级：下拉浮在正文之上；勿在祖先上使用 overflow-x-auto，否则会按规范把 overflow-y 算成 auto 从而裁切下拉 -->
  <nav class="relative z-[1000] shadow-md min-h-[72px] nav-bar-purple">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between min-h-[72px] py-3">
        <div class="flex items-center min-w-0 flex-1 overflow-visible">
          <router-link to="/" class="text-white text-lg font-semibold shrink-0">{{ $t('nav.title') }}</router-link>
          <div class="hidden md:block min-w-0 flex-1 overflow-visible">
            <div class="ml-6 lg:ml-10 flex flex-wrap items-center gap-x-1 gap-y-1">
              <router-link
                to="/dashboard"
                class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
              >{{ $t('nav.dashboard') }}</router-link>

              <!-- 回测 -->
              <div class="relative group">
                <span
                  class="inline-flex items-center gap-0.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 cursor-default whitespace-nowrap group-hover:bg-gray-700 group-hover:text-white"
                >
                  {{ $t('nav.group_backtest') }}
                  <ChevronDown class="h-3.5 w-3.5 opacity-80" />
                </span>
                <div
                  class="absolute left-0 top-full z-[1100] min-w-[11rem] pt-1 hidden group-hover:block"
                >
                  <div class="rounded-md bg-gray-800 shadow-lg ring-1 ring-white/10 py-1">
                    <router-link
                      to="/backtest"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.backtest') }}</router-link>
                    <router-link
                      to="/strategy-templates"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.strategy_templates') }}</router-link>
                    <router-link
                      to="/backtest-instances"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.backtest_instances') }}</router-link>
                  </div>
                </div>
              </div>

              <!-- 套利 / 价差 -->
              <div class="relative group">
                <span
                  class="inline-flex items-center gap-0.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 cursor-default whitespace-nowrap group-hover:bg-gray-700 group-hover:text-white"
                >
                  {{ $t('nav.group_arbitrage') }}
                  <ChevronDown class="h-3.5 w-3.5 opacity-80" />
                </span>
                <div
                  class="absolute left-0 top-full z-[1100] min-w-[11rem] pt-1 hidden group-hover:block"
                >
                  <div class="rounded-md bg-gray-800 shadow-lg ring-1 ring-white/10 py-1">
                    <router-link
                      to="/spread-tool"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.spread_tool') }}</router-link>
                    <router-link
                      to="/statistical-arbitrage"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.statistical_arbitrage') }}</router-link>
                    <router-link
                      to="/pairs-scanner"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.pairs_scanner') }}</router-link>
                    <router-link
                      to="/euler-golden-pairs"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.euler_golden_pairs') }}</router-link>
                    <router-link
                      to="/pairs-validation-report"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.pairs_validation') }}</router-link>
                  </div>
                </div>
              </div>

              <!-- 趋势 -->
              <div class="relative group">
                <span
                  class="inline-flex items-center gap-0.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 cursor-default whitespace-nowrap group-hover:bg-gray-700 group-hover:text-white"
                >
                  {{ $t('nav.group_trend') }}
                  <ChevronDown class="h-3.5 w-3.5 opacity-80" />
                </span>
                <div
                  class="absolute left-0 top-full z-[1100] min-w-[11rem] pt-1 hidden group-hover:block"
                >
                  <div class="rounded-md bg-gray-800 shadow-lg ring-1 ring-white/10 py-1">
                    <router-link
                      to="/trend-research"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.trend_research') }}</router-link>
                    <router-link
                      to="/trend-validation-report"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.trend_validation_report') }}</router-link>
                  </div>
                </div>
              </div>

              <!-- K 线 / 数据 -->
              <div class="relative group">
                <span
                  class="inline-flex items-center gap-0.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 cursor-default whitespace-nowrap group-hover:bg-gray-700 group-hover:text-white"
                >
                  {{ $t('nav.group_kline') }}
                  <ChevronDown class="h-3.5 w-3.5 opacity-80" />
                </span>
                <div
                  class="absolute left-0 top-full z-[1100] min-w-[12rem] pt-1 hidden group-hover:block"
                >
                  <div class="rounded-md bg-gray-800 shadow-lg ring-1 ring-white/10 py-1">
                    <router-link
                      to="/binance-top-volume"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >币安Top100</router-link>
                    <router-link
                      to="/binance-abo-whitelist"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.binance_abo_whitelist') }}</router-link>
                    <router-link
                      to="/binance-jbar-kline"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.binance_jbar_kline') }}</router-link>
                    <router-link
                      to="/binance-jbar-kline-free-benchmark"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >币安常规K线(自由ABO基准)</router-link>
                    <router-link
                      to="/volume-sync-kline"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.volume_sync_kline') }}</router-link>
                    <router-link
                      to="/btc-point-brick-kline"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.btc_point_brick_kline') }}</router-link>
                    <router-link
                      to="/btc-point-brick-kline-free-benchmark"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >币安砖石K线(自由ABO基准)</router-link>
                    <router-link
                      to="/euler-oi-brick-benchmark"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >单边欧拉·OI加权(点砖+metrics)</router-link>
                    <router-link
                      to="/euler-oi-brick-benchmark-strategy-optimize"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >（策略优化）单边欧拉·OI加权(点砖+metrics)</router-link>
                    <router-link
                      to="/euler-oi-volume-brick-benchmark-strategy-optimize"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >（策略优化）单边欧拉·OI加权(成交额砖+metrics)</router-link>
                    <router-link
                      to="/alt-clock-brick-kline"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >山寨驱动砖石K线</router-link>
                    <router-link
                      to="/spread-synthetic-kline"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.spread_synthetic_kline') }}</router-link>
                    <router-link
                      to="/data-converter"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.data_converter') }}</router-link>
                    <router-link
                      to="/kline-sync-to-live"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.kline_sync_live') }}</router-link>
                    <router-link
                      to="/binance-history-download"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.binance_history') }}</router-link>
                    <router-link
                      to="/binance-vision-trades"
                      class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                    >{{ $t('nav.binance_vision_trades') }}</router-link>
                  </div>
                </div>
              </div>

              <router-link
                to="/subscriptions"
                class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
              >{{ $t('nav.subscriptions') }}</router-link>
              <router-link
                to="/agent"
                class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
              >{{ $t('nav.agent') }}</router-link>
              <router-link
                v-if="isAdmin"
                to="/user-management"
                class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
              >{{ $t('nav.user_management') }}</router-link>
            </div>
          </div>
        </div>
        <div class="hidden md:block shrink-0">
          <div class="ml-4 flex items-center md:ml-6">
            <div class="relative">
              <select v-model="currentLocale" @change="switchLanguage" class="bg-gray-700 text-white rounded-md p-2 appearance-none">
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>

            <div v-if="isLoggedIn" class="flex items-center ml-4">
              <span class="text-gray-300 text-sm mr-4">{{ $t('nav.welcome', { username: username }) }}</span>
              <button type="button" @click="logout" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium">
                {{ $t('nav.logout') }}
              </button>
            </div>
            <router-link
              v-else
              to="/login"
              class="ml-4 text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              {{ $t('nav.login') }}
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script>
import { computed, h, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

/** 小三角图标（避免额外依赖） */
const ChevronDown = {
  name: 'ChevronDown',
  props: { class: { type: String, default: '' } },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          class: props.class,
          fill: 'currentColor',
          viewBox: '0 0 20 20',
          'aria-hidden': 'true',
        },
        h('path', {
          'fill-rule': 'evenodd',
          d: 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z',
          'clip-rule': 'evenodd',
        })
      );
  },
};

export default {
  name: 'NavBar',
  components: { ChevronDown },
  setup() {
    const authStore = useAuthStore();
    const router = useRouter();
    const { locale } = useI18n();

    const isLoggedIn = computed(() => authStore.isAuthenticated);
    const username = computed(() => authStore.username);
    const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

    const currentLocale = ref(locale.value);
    watch(locale, (v) => {
      currentLocale.value = v;
    });

    const logout = () => {
      authStore.logout();
      router.push('/login');
    };

    const switchLanguage = () => {
      locale.value = currentLocale.value;
      localStorage.setItem('locale', currentLocale.value);
    };

    return {
      isLoggedIn,
      username,
      isAdmin,
      logout,
      currentLocale,
      switchLanguage,
    };
  },
};
</script>

<style scoped>
.nav-bar-purple {
  background: linear-gradient(135deg, #4a2c6a 0%, #3d2463 100%);
}
</style>
