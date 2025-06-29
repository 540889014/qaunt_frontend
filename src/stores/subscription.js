import { defineStore } from 'pinia';
import { getSubscriptionsByUsername } from '../api';
import { useAuthStore } from './auth';

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    subscriptions: [],
    loading: false,
    error: null,
  }),
  getters: {
    subscribedSymbols: (state) => {
      // 使用 Set 去重
      const symbols = new Set(state.subscriptions.map(sub => sub.symbol));
      return Array.from(symbols);
    }
  },
  actions: {
    async fetchSubscriptions(exchange) {
      const authStore = useAuthStore();
      // This check is too early and can fail on initial load.
      // The API interceptor will handle auth headers and the response interceptor
      // will handle 401 errors, which is a more robust approach.
      // if (!authStore.username) {
      //   this.error = 'User not authenticated';
      //   return;
      // }
      this.loading = true;
      try {
        const response = await getSubscriptionsByUsername(authStore.username, exchange);
        this.subscriptions = response.data;
        this.error = null;
      } catch (error) {
        this.error = error.message || '購読の取得に失敗しました';
        this.subscriptions = [];
      } finally {
        this.loading = false;
      }
    },
  },
}); 