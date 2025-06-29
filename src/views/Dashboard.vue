<template>
  <div class="dashboard bg-gray-100 min-h-screen">
    <NavBar />
    <div class="content">
      <div class="welcome-section">
        <h1>{{ $t('dashboard.title') }}</h1>
        <p>{{ $t('dashboard.welcome_message') }}</p>
      </div>
      <ErrorMessage v-if="error" :message="error" dismissible @dismiss="error = ''" />
      <LoadingSpinner v-if="loading" :message="$t('dashboard.loading')" :is-overlay="true" />
      <div v-else class="stats-section">
        <div class="card" @click="goToSubscriptions">
          <h3>{{ $t('dashboard.subscription_count') }}</h3>
          <p class="stat-value">{{ subscriptionCount }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useExchangeStore } from '@/stores/exchange'
import { getSubscriptionsByUsername } from '../api'
import NavBar from '../components/NavBar.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import ErrorMessage from '../components/ErrorMessage.vue'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const authStore = useAuthStore()
const exchangeStore = useExchangeStore()
const username = ref(authStore.username)
const subscriptionCount = ref(0)
const loading = ref(false)
const error = ref('')
const router = useRouter()

const fetchDashboardData = async () => {
  loading.value = true
  error.value = ''
  try {
    const resp = await getSubscriptionsByUsername(authStore.username, exchangeStore.selectedExchange || '')
    const subs = resp.data || []
    subscriptionCount.value = subs.length
  } catch (err) {
    error.value = t('dashboard.load_fail')
    console.error('Failed to fetch dashboard data:', err)
  } finally {
    loading.value = false
  }
}

function goToSubscriptions() {
  router.push('/subscriptions')
}

onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/')
    return
  }
  fetchDashboardData()
})
</script>

<style scoped>
.welcome-section {
  margin-bottom: 2rem;
}

.welcome-section h1 {
  color: #333;
  margin-bottom: 0.5rem;
}

.welcome-section p {
  color: #666;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #4CAF50;
  margin-top: 0.5rem;
}

.recent-activity {
  margin-top: 2rem;
}

.recent-activity h2 {
  color: #333;
  margin-bottom: 1rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.activity-time {
  color: #666;
  min-width: 60px;
}

.activity-desc {
  color: #333;
}

.card {
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.card:hover {
  box-shadow: 0 4px 16px rgba(64,159,255,0.12);
}
</style>