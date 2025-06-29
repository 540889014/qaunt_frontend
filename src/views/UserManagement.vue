<template>
  <div class="user-management">
    <nav class="nav-bar">
      <div class="nav-brand">加密货币数据服务</div>
      <div class="nav-links">
        <router-link to="/dashboard" class="nav-link">首页</router-link>
        <router-link to="/subscriptions" class="nav-link">订阅列表</router-link>
        <router-link to="/user-management" class="nav-link">用户管理</router-link>
        <button @click="handleLogout" class="nav-link logout-btn">登出</button>
      </div>
    </nav>

    <div class="content">
      <div class="header">
        <h1>用户管理</h1>
        <button @click="showAddUserModal = true" class="add-user-btn">
          添加用户
        </button>
      </div>

      <div class="user-list">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.username }}</td>
              <td>{{ user.role }}</td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>
                <button @click="editUser(user)" class="action-btn edit">编辑</button>
                <button @click="deleteUser(user.id)" class="action-btn delete">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 添加/编辑用户模态框 -->
    <div v-if="showAddUserModal" class="modal">
      <div class="modal-content">
        <h2>{{ editingUser ? '编辑用户' : '添加用户' }}</h2>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="username">用户名</label>
            <input
              type="text"
              id="username"
              v-model="userForm.username"
              required
              :disabled="editingUser"
            />
          </div>
          <div class="form-group">
            <label for="password">密码</label>
            <input
              type="password"
              id="password"
              v-model="userForm.password"
              :required="!editingUser"
            />
          </div>
          <div class="form-group">
            <label for="role">角色</label>
            <select id="role" v-model="userForm.role" required>
              <option value="USER">普通用户</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="cancel-btn">取消</button>
            <button type="submit" class="submit-btn">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAllUsers, addUser, deleteUser as deleteUserApi, updateUserPassword } from '../api'
import NavBar from '../components/NavBar.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import ErrorMessage from '../components/ErrorMessage.vue'

const router = useRouter()
const authStore = useAuthStore()

const users = ref([])
const showAddUserModal = ref(false)
const editingUser = ref(null)
const loading = ref(false)
const error = ref('')

const userForm = ref({
  username: '',
  password: '',
  role: 'USER'
})

const handleLogout = () => {
  authStore.logout()
  router.push('/')
}

const fetchUsers = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await getAllUsers()
    users.value = response.data
  } catch (err) {
    error.value = err.message || '加载用户数据失败，请稍后重试'
    console.error('Failed to fetch users:', err)
  } finally {
    loading.value = false
  }
}

const editUser = (user) => {
  editingUser.value = user
  userForm.value = {
    username: user.username,
    password: '',
    role: user.role
  }
  showAddUserModal.value = true
}

const deleteUser = async (userId) => {
  if (!confirm('确定要删除这个用户吗？')) return
  try {
    await deleteUserApi(userId)
    await fetchUsers()
  } catch (err) {
    error.value = err.message || '删除用户失败，请稍后重试'
    console.error('Failed to delete user:', err)
  }
}

const handleSubmit = async () => {
  try {
    if (editingUser.value) {
      // 只允许修改密码和角色
      if (userForm.value.password) {
        await updateUserPassword(editingUser.value.id, userForm.value.password)
      }
      // 角色变更（如有需要，可加接口）
      if (userForm.value.role !== editingUser.value.role) {
        // 这里只能重新添加用户或补充后端接口
        error.value = '暂不支持前端修改角色，请联系管理员'
        return
      }
    } else {
      await addUser(userForm.value.username, userForm.value.password, userForm.value.role)
    }
    await fetchUsers()
    closeModal()
  } catch (err) {
    error.value = err.message || '保存用户失败，请稍后重试'
    console.error('Failed to save user:', err)
  }
}

const closeModal = () => {
  showAddUserModal.value = false
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    role: 'USER'
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.user-management {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.nav-bar {
  background-color: #fff;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.nav-link {
  text-decoration: none;
  color: #666;
  font-weight: 500;
  transition: color 0.3s;
}

.nav-link:hover {
  color: #4CAF50;
}

.logout-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
}

.content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.add-user-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.user-list {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
  font-weight: 500;
}

.edit {
  background-color: #2196F3;
  color: white;
}

.delete {
  background-color: #f44336;
  color: white;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
}

input, select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

.submit-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: #4CAF50;
  color: white;
  cursor: pointer;
}
</style> 