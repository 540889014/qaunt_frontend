import { defineStore } from 'pinia';
import {
  getBacktestInstances,
  getBacktestInstance,
  createBacktestInstance,
  updateBacktestInstance,
  deleteBacktestInstance,
  runBacktestInstance
} from '@/api';

export const useBacktestInstanceStore = defineStore('backtestInstance', {
  state: () => ({
    instances: [],
    instance: null,
    loading: false,
    error: null,
    pagination: {
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    },
  }),
  actions: {
    async fetchInstances(page = 0, size = 10, sort = 'createdAt,desc') {
      this.loading = true;
      this.error = null;
      try {
        const response = await getBacktestInstances(page, size, sort);
        this.instances = Array.isArray(response?.content) ? response.content : [];
        this.pagination.page = Number.isFinite(response?.number) ? response.number : page;
        this.pagination.size = Number.isFinite(response?.size) ? response.size : size;
        this.pagination.totalElements = Number.isFinite(response?.totalElements) ? response.totalElements : this.instances.length;
        this.pagination.totalPages = Number.isFinite(response?.totalPages) ? response.totalPages : 1;
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    async fetchInstance(id) {
        this.loading = true;
        this.error = null;
        this.instance = null;
        try {
            const response = await getBacktestInstance(id);
            this.instance = response;
        } catch (error) {
            this.error = error;
        } finally {
            this.loading = false;
        }
    },
    async createInstance(data) {
        this.loading = true;
        this.error = null;
        try {
            const response = await createBacktestInstance(data);
            await this.fetchInstances(); // Refresh list after creation
            return response;
        } catch (error) {
            this.error = error;
            throw error;
        } finally {
            this.loading = false;
        }
    },
    async updateInstance(id, data) {
        this.loading = true;
        this.error = null;
        try {
            await updateBacktestInstance(id, data);
        } catch (error) {
            this.error = error;
            throw error;
        } finally {
            this.loading = false;
        }
    },
    async deleteInstance(id) {
        this.loading = true;
        this.error = null;
        try {
            await deleteBacktestInstance(id);
            // Refresh current page from server to keep pagination consistent.
            const targetPage = this.instances.length <= 1 && this.pagination.page > 0
              ? this.pagination.page - 1
              : this.pagination.page;
            await this.fetchInstances(targetPage, this.pagination.size);
        } catch (error) {
            this.error = error;
            // If the API call fails, we might want to refresh the list to get the true state
            await this.fetchInstances(this.pagination.page, this.pagination.size);
            throw error;
        } finally {
            this.loading = false;
        }
    },
    async runInstance(id) {
        this.loading = true;
        this.error = null;
        try {
            const response = await runBacktestInstance(id);
            // Update the specific instance in the list
            const index = this.instances.findIndex(i => i.id === id);
            if (index !== -1) {
                this.instances[index] = response;
            }
        } catch (error) {
            this.error = error;
            throw error;
        } finally {
            this.loading = false;
        }
    },
    resetInstance() {
        this.instance = null;
    }
  },
}); 