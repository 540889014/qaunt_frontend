import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useExchangeStore = defineStore('exchange', () => {
  // 交易所状态
  const selectedExchange = ref('okx')
  // 交易所列表
  const exchanges = ref(['すべての取引所', 'okx', 'binance'])

  // 设置所选交易所
  const setExchange = (exchange) => {
    selectedExchange.value = exchange
    localStorage.setItem('selectedExchange', exchange)
  }

  // 从本地存储加载交易所选择
  const loadExchange = () => {
    const savedExchange = localStorage.getItem('selectedExchange')
    if (savedExchange && exchanges.value.includes(savedExchange)) {
      selectedExchange.value = savedExchange
    }
  }

  return { selectedExchange, exchanges, setExchange, loadExchange }
}) 