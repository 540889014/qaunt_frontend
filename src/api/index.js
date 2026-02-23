import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { handleApiError } from '../utils/error-handler'
import i18n from '@/i18n'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Agent API（单独模块，默认端口 8099）
const agentApi = axios.create({
  baseURL: import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8099/api',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    const token = authStore.token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

agentApi.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    const token = authStore.token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

agentApi.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    handleApiError(error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  /**
   * onFulfilled: Executed for any response with a 2xx status code.
   */
  (response) => {
    // For requests like raw text logs, pass them through directly.
    if (response.config.responseType === 'text') {
        return response.data;
    }

    const apiResponse = response.data;

    // Check for the standard API response structure.
    if (apiResponse && typeof apiResponse.code !== 'undefined') {
      if (apiResponse.code === 200) {
        // Success: resolve the promise with the actual business data.
        return apiResponse.data;
      } else {
        // Business Error: reject the promise so it can be caught by .catch() blocks.
        const error = new Error(apiResponse.message || 'An error occurred.');
        error.code = apiResponse.code;
        return Promise.reject(error);
      }
    } else {
      // If not in the standard format, resolve with the raw data for compatibility.
      return apiResponse;
    }
  },

  /**
   * onRejected: Executed for non-2xx status codes or network errors.
   */
  async (error) => {
    // Handle 401 Unauthorized globally: log out and redirect.
    if (error.response && error.response.status === 401) {
      const authStore = useAuthStore();
      if (authStore.token) {
          authStore.logout();
          const router = (await import('@/router')).default;
          // Using .replace to avoid adding a new entry to the history stack
          await router.replace('/login');
      }
    }

    // Even on HTTP error, the backend should return our standard { code, message, ... } response.
    if (error.response && error.response.data && typeof error.response.data.message !== 'undefined') {
      const backendError = new Error(error.response.data.message);
      backendError.code = error.response.data.code;
      handleApiError(error); // This can be used for logging or UI notifications
      return Promise.reject(backendError);
    }

    // Fallback for network errors or non-standard error responses.
    handleApiError(error);
    return Promise.reject(error);
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
export const subscribe = (username, symbol, dataType, instType, timeframe, exchange, assetType) =>
  api.post('/api/v1/subscription/subscribe', null, { params: { username, symbol, dataType, instType, timeframe, exchange, assetType } })
export const unsubscribe = (username, symbol, dataType, exchange, timeframe = '', assetType) =>
  api.post('/api/v1/subscription/unsubscribe', null, { params: { username, symbol, dataType, exchange, timeframe, assetType } })
export const getSubscriptionsByUsername = (username) => {
  return api.get('/api/v1/subscription/user', { params: { username } })
}
export const getSubscriptionsByDataType = (dataType, exchange = '') =>
  api.get('/api/v1/subscription/type', { params: { dataType, exchange } })

// ========== 市场数据 ==========
export const getKlineData = (symbol, timeframe, startTime, endTime, exchange = 'okx', assetType) =>
  api.get('/api/v1/market/kline', { params: { symbol, timeframe, startTime, endTime, exchange, assetType } })
export const getRealtimeData = (symbol, exchange = 'okx') =>
  api.get('/api/v1/market/realtime', { params: { symbol, exchange } })
export const getDepthData = (symbol, exchange = 'okx') =>
  api.get('/api/v1/market/depth', { params: { symbol, exchange } })
export const getAllForexMetadata = () => api.get('/api/forex/metadata/all')

// ========== 公共市场数据 ==========
export const getInstruments = (instType) =>
  api.get('/api/v5/public/instruments', { params: { instType } })

export const getMarketInstruments = (instType, exchange) =>
  api.get('/api/v1/market/instruments', { params: { instType, exchange } });

// --- Strategy Templates API ---

export const getStrategyTemplates = (page = 0, size = 10) => {
  return api.get('/api/strategy-templates', { params: { page, size } })
}

export const getStrategyTemplateById = (id) => {
  return api.get(`/api/strategy-templates/${id}`)
}

/** Metadata-driven: legs + parameters for dynamic UI. Only JAVA templates return descriptor. */
export const getStrategyDescriptor = (id) => {
  return api.get(`/api/strategy-templates/${id}/descriptor`)
}

export const getStrategyTemplateScript = (id) => api.get(`/strategy-templates/${id}/script`)

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

// --- Backtest Instances API ---

export const getBacktestInstances = (page = 0, size = 10, sort = 'createdAt,desc') => {
  return api.get('/api/backtest-instances', { params: { page, size, sort } });
};

export const getBacktestInstance = (id) => {
  return api.get(`/api/backtest-instances/${id}`);
};

export const createBacktestInstance = (data) => {
  return api.post('/api/backtest-instances', data);
};

export const updateBacktestInstance = (id, data) => {
  return api.put(`/api/backtest-instances/${id}`, data);
};

// --- Pairs Scanner API ---
export const scanPairs = (payload) => {
  return api.post('/api/v1/pairs-scanner/scan', payload);
};

export const getPairsScanRuns = (timeframe, limit = 20) => {
  return api.get('/api/v1/pairs-scanner/runs', { params: { timeframe, limit } });
};

export const getPairsScanRunResults = (runId, limit = 200) => {
  return api.get(`/api/v1/pairs-scanner/runs/${runId}/results`, { params: { limit } });
};

export const deleteBacktestInstance = (id) => {
  return api.delete(`/api/backtest-instances/${id}`);
};

export const runBacktestInstance = (id) => {
  return api.post(`/api/backtest-instances/${id}/run`);
};

// --- Backtest Reports API ---
export const getBacktestReportList = (strategyName) => {
  return api.get(`/api/backtest-reports/${strategyName}`);
}

export const getBacktestReportData = (strategyName, timestamp) => {
  return api.get(`/api/backtest-reports/${strategyName}/${timestamp}`);
}

export const getBacktestReportLog = (strategyName, timestamp) => {
  return api.get(`/api/backtest-reports/${strategyName}/${timestamp}/log`);
}

export const deleteBacktestReport = (strategyName, timestamp) => {
  return api.delete(`/api/backtest-reports/${strategyName}/${timestamp}`);
}

// --- Backtest Reports by Instance ID API (for database-backed reports) ---
export const getBacktestReportTimestampsByInstanceId = (instanceId) => {
  return api.get(`/api/backtest-reports/instance/${instanceId}/timestamps`);
}

export const getBacktestReportDataByInstanceId = (instanceId, timestamp = null) => {
  const url = timestamp 
    ? `/api/backtest-reports/instance/${instanceId}?timestamp=${timestamp}`
    : `/api/backtest-reports/instance/${instanceId}`;
  return api.get(url);
}

export const getAdfTestResults = (timeframe, exchange) => api.get('/api/v1/statistical-arbitrage/adf-test', { params: { timeframe, exchange } });
export const getKpssTestResults = (timeframe, exchange) => api.get('/api/v1/statistical-arbitrage/kpss-test', { params: { timeframe, exchange } });
export const getHurstExponentResults = (timeframe, exchange) => api.get('/api/v1/statistical-arbitrage/hurst-exponent', { params: { timeframe, exchange } });
export const recalculateStatisticalArbitrage = (timeframe, exchange) => api.post('/api/v1/statistical-arbitrage/recalculate', null, { params: { timeframe, exchange } });

export const runBacktest = (payload) => api.post('/api/v1/backtest/run', payload);

export default api 

// ========== Agent APIs ==========
export const agentBacktestRun = (config) => agentApi.post('/agent/backtest/run', config)
export const agentSubmitTask = (config) => agentApi.post('/agent/tasks', config)
export const agentGetTask = (id) => agentApi.get(`/agent/tasks/${id}`)
export const agentGetTaskMetrics = (id) => agentApi.get(`/agent/tasks/${id}/metrics`)
export const agentStrategyGenerate = (paper, objective) =>
  agentApi.post('/agent/strategy/generate', { paper, objective })
export const pipelineGenerateAndBacktest = (payload) =>
  agentApi.post('/agent/pipeline/generate-and-backtest', payload)
export const pipelineGenerateImproveBacktest = (payload, iterations, timeframe) => {
  const params = new URLSearchParams()
  if (iterations !== undefined && iterations !== null) params.set('iterations', String(iterations))
  if (timeframe !== undefined && timeframe !== null) params.set('timeframe', String(timeframe))
  const qs = params.toString()
  const url = qs ? `/agent/pipeline/generate-improve-backtest?${qs}` : '/agent/pipeline/generate-improve-backtest'
  return agentApi.post(url, payload)
}
export const optimizeParams = (payload) =>
  agentApi.post('/agent/optimize', payload)