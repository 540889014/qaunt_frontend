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
        this.instances = response.data.content;
        this.pagination.page = response.data.number;
        this.pagination.size = response.data.size;
        this.pagination.totalElements = response.data.totalElements;
        this.pagination.totalPages = response.data.totalPages;
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
            this.instance = response.data;
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
            return response.data;
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
            // Optimistically update the list
            const index = this.instances.findIndex(i => i.id === id);
            if (index !== -1) {
              this.instances.splice(index, 1);
            }
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
                this.instances[index] = response.data;
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