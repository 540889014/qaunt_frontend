// 错误类型定义
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

// 错误消息映射
const errorMessages = {
  [ErrorTypes.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
  [ErrorTypes.AUTH_ERROR]: '认证失败，请重新登录',
  [ErrorTypes.VALIDATION_ERROR]: '输入数据验证失败',
  [ErrorTypes.SERVER_ERROR]: '服务器错误，请稍后重试',
  [ErrorTypes.UNKNOWN_ERROR]: '发生未知错误，请稍后重试'
}

// 处理 API 错误
export const handleApiError = (error) => {
  if (!error.response) {
    return {
      type: ErrorTypes.NETWORK_ERROR,
      message: errorMessages[ErrorTypes.NETWORK_ERROR]
    }
  }

  const { status, data } = error.response

  switch (status) {
    case 401:
      return {
        type: ErrorTypes.AUTH_ERROR,
        message: data.message || errorMessages[ErrorTypes.AUTH_ERROR]
      }
    case 400:
      return {
        type: ErrorTypes.VALIDATION_ERROR,
        message: data.message || errorMessages[ErrorTypes.VALIDATION_ERROR]
      }
    case 500:
      return {
        type: ErrorTypes.SERVER_ERROR,
        message: data.message || errorMessages[ErrorTypes.SERVER_ERROR]
      }
    default:
      return {
        type: ErrorTypes.UNKNOWN_ERROR,
        message: data.message || errorMessages[ErrorTypes.UNKNOWN_ERROR]
      }
  }
}

// 全局错误处理
export const setupGlobalErrorHandler = (app) => {
  app.config.errorHandler = (err, vm, info) => {
    console.error('Vue Error:', err)
    console.error('Error Info:', info)
    
    // 这里可以添加错误上报逻辑
    // 例如：发送到错误监控服务
  }

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason)
    
    // 这里可以添加错误上报逻辑
    // 例如：发送到错误监控服务
  })
} 