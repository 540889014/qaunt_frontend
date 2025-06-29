import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { handleApiError } from '../utils/error-handler'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorInfo = handleApiError(error)
    if (errorInfo.type === 'AUTH_ERROR') {
      const authStore = useAuthStore()
      authStore.logout()
      window.location.href = '/'
    }
    return Promise.reject(errorInfo)
  }
)

// ========== 用户管理 ==========
export const getAllUsers = () => api.get('/api/users/all')
export const addUser = (username, password, role) =>
  api.post('/api/users/add', null, { params: { username, password, role } })
export const deleteUser = (userId) =>
  api.delete(`/api/users/delete/${userId}`)
export const updateUserPassword = (userId, newPassword) =>
  api.put(`/api/users/update-password/${userId}`, null, { params: { newPassword } })

// ========== 认证 ==========
export const login = (username, password) =>
  api.post('/api/v1/auth/login', { username, password })
export const validateToken = () =>
  api.get('/api/v1/auth/validate')

// ========== 订阅 ==========
export const subscribe = (username, symbol, dataType, instType, timeframe, exchange) =>
  api.post('/api/v1/subscription/subscribe', null, { params: { username, symbol, dataType, instType, timeframe, exchange } })
export const unsubscribe = (username, symbol, dataType, exchange, timeframe = '') =>
  api.post('/api/v1/subscription/unsubscribe', null, { params: { username, symbol, dataType, exchange, timeframe } })
export const getSubscriptionsByUsername = (username, exchange) => {
  return api.get('/api/v1/subscription/user', { params: { username, exchange } })
}
export const getSubscriptionsByDataType = (dataType, exchange = '') =>
  api.get('/api/v1/subscription/type', { params: { dataType, exchange } })

// ========== 市场数据 ==========
export const getKlineData = (symbol, timeframe, startTime, endTime, exchange = 'okx') =>
  api.get('/api/v1/market/kline', { params: { symbol, timeframe, startTime, endTime, exchange } })
export const getRealtimeData = (symbol, exchange = 'okx') =>
  api.get('/api/v1/market/realtime', { params: { symbol, exchange } })
export const getDepthData = (symbol, exchange = 'okx') =>
  api.get('/api/v1/market/depth', { params: { symbol, exchange } })

// ========== 公共市场数据 ==========
export const getInstruments = (instType) =>
  api.get('/api/v5/public/instruments', { params: { instType } })

// --- Strategy Templates API ---

export const getStrategyTemplates = (page = 0, size = 10) => {
  return api.get('/api/strategy-templates', { params: { page, size } })
}

export const getStrategyTemplateById = (id) => {
  return api.get(`/api/strategy-templates/${id}`)
}

export const createStrategyTemplate = (formData) => {
  return api.post('/api/strategy-templates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const updateStrategyTemplate = (id, formData) => {
  return api.put(`/api/strategy-templates/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const deleteStrategyTemplate = (id) => {
  return api.delete(`/api/strategy-templates/${id}`)
}

export default api 