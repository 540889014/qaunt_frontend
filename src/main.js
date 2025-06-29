import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupGlobalErrorHandler } from './utils/error-handler'
import VueApexCharts from 'vue3-apexcharts'
import i18n from './i18n' 
// 导入全局样式
import './assets/main.css'
import './assets/tailwind.css'

const app = createApp(App)
app.use(VueApexCharts)
// 设置全局错误处理
setupGlobalErrorHandler(app)

// 使用 Pinia 和路由
app.use(createPinia())
app.use(router)
console.log('i18n module:', i18n); // 调试
app.use(i18n) // 使用 i18n
app.component('apexcharts', VueApexCharts)

app.mount('#app')
