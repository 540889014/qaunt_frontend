<template>
  <n-message-provider>
    <router-view />
  </n-message-provider>
</template>

<script>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NMessageProvider } from 'naive-ui'
import Dashboard from './views/Dashboard.vue'
import Subscriptions from './views/Subscriptions.vue'
import SpreadTool from './views/SpreadTool.vue'

export default {
  name: 'App',
  setup() {
    const router = useRouter()

    onMounted(() => {
      // 可以在此添加初始化逻辑
    })

    return {
      router
    }
  },
  components: {
    Dashboard,
    Subscriptions,
    SpreadTool,
    NMessageProvider
  }
}
</script>

<style>
/* 没有自定义样式 */
</style>
