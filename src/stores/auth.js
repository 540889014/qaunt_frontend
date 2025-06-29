import { defineStore } from 'pinia'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    userRole: localStorage.getItem('userRole') || null,
    username: localStorage.getItem('username') || null
  }),

  actions: {
    async login(username, password) {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, { username, password })
        const { token } = response.data
        this.token = token
        this.username = username
        localStorage.setItem('token', token)
        localStorage.setItem('username', username)

        // 登录后获取用户信息，自动识别角色
        const userInfoResp = await axios.get(`${API_BASE_URL}/api/users/all`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const currentUser = userInfoResp.data.find(u => u.username === username)
        if (currentUser && currentUser.role) {
          this.userRole = currentUser.role
          localStorage.setItem('userRole', currentUser.role)
        } else {
          this.userRole = null
          localStorage.removeItem('userRole')
        }

        return true
      } catch (error) {
        console.error('ログインに失敗しました:', error)
        throw new Error('ログインに失敗しました')
      }
    },

    logout() {
      this.token = null
      this.userRole = null
      this.username = null
      localStorage.removeItem('token')
      localStorage.removeItem('userRole')
      localStorage.removeItem('username')
      window.location.href = '/'
    },

    async validateToken() {
      if (!this.token) return false
      
      try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/auth/validate`, {
          headers: { Authorization: `Bearer ${this.token}` }
        })
        return response.data.valid
      } catch (error) {
        return false
      }
    },

    checkAuth() {
      const token = localStorage.getItem('token')
      if (token) {
        this.token = token
        this.username = localStorage.getItem('username')
      }
    }
  },

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.userRole === 'ADMIN'
  }
}) 