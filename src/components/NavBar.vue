<template>
  <nav class="bg-gray-800 shadow-md">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <router-link to="/" class="text-white text-lg font-semibold">{{ $t('nav.title') }}</router-link>
          <div class="hidden md:block">
            <div class="ml-10 flex items-baseline space-x-4">
              <router-link to="/dashboard" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">{{ $t('nav.dashboard') }}</router-link>
              <router-link to="/subscriptions" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">{{ $t('nav.subscriptions') }}</router-link>
              <router-link to="/spread-tool" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">{{ $t('nav.spread_tool') }}</router-link>
              <router-link to="/backtest" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">{{ $t('nav.backtest') }}</router-link>
              <router-link to="/statistical-arbitrage" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">{{ $t('nav.statistical_arbitrage') }}</router-link>
            </div>
          </div>
        </div>
        <div class="hidden md:block">
          <div class="ml-4 flex items-center md:ml-6">
            <!-- Language Switcher -->
            <div class="relative">
              <select v-model="currentLocale" @change="switchLanguage" class="bg-gray-700 text-white rounded-md p-2 appearance-none">
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
            
            <div v-if="isLoggedIn" class="flex items-center ml-4">
              <span class="text-gray-300 text-sm mr-4">{{ $t('nav.welcome', { username: username }) }}</span>
              <button @click="logout" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium">
                {{ $t('nav.logout') }}
              </button>
            </div>
            <router-link v-else to="/login" class="ml-4 text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
              {{ $t('nav.login') }}
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script>
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

export default {
  name: 'NavBar',
  setup() {
    const authStore = useAuthStore();
    const router = useRouter();
    const { t, locale } = useI18n();

    const isLoggedIn = computed(() => authStore.isAuthenticated);
    const username = computed(() => authStore.username);
    
    const currentLocale = ref(locale.value);

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
      logout,
      t,
      currentLocale,
      switchLanguage,
    };
  },
};
</script>