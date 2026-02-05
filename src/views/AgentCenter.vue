<template>
  <div class="page-container">
    <NavBar />
    <div class="content">
      <h1>Agent 研究中心</h1>
      <div class="card">
        <h2>一键生成并回测</h2>
        <div class="form-group">
          <label>论文/要点（可直接粘贴论文链接）</label>
          <textarea v-model="paper" rows="6" class="form-input" placeholder="支持：论文摘要/要点，或论文链接（HTML 页面将自动抓取文本）"></textarea>
        </div>
        <div class="form-group">
          <label>目标（只需写期待的年化收益率等）</label>
          <input v-model="objective" class="form-input" placeholder="例如：期待年化收益率 30%，最大回撤 < 10%" />
        </div>
        <button class="btn btn-primary" @click="runGenerateImprove" :disabled="loading">
          {{ loading ? '运行中...' : '生成 + 自修复回测' }}
        </button>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="result" class="result">
          <h3>结果摘要</h3>
          <pre>{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import NavBar from '../components/NavBar.vue'
import { pipelineGenerateImproveBacktest } from '../api'
import { useAuthStore } from '../stores/auth'

const paper = ref('')
const objective = ref('')

const loading = ref(false)
const error = ref('')
const result = ref(null)

async function runGenerateImprove() {
  error.value = ''
  result.value = null
  loading.value = true
  try {
    const authStore = useAuthStore()
    const payload = {
      paper: paper.value,
      objective: objective.value,
      // Auto-selection: backend will query your subscriptions and pick optimal symbols/params.
      username: authStore.username
    }
    const res = await pipelineGenerateImproveBacktest(payload)
    result.value = res
  } catch (e) {
    error.value = e?.message || '执行失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-container { display: flex; flex-direction: column; height: 100vh; }
.content { flex: 1; padding: 2rem; overflow-y: auto; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.2rem; max-width: 900px; }
.form-group { margin-bottom: 0.8rem; display: flex; flex-direction: column; }
.form-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; }
.btn { padding: 8px 14px; border-radius: 6px; cursor: pointer; }
.btn-primary { background: #2563eb; color: #fff; border: none; }
.error { margin-top: 10px; color: #b91c1c; }
.result { margin-top: 14px; }
</style>
