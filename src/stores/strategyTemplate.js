import { defineStore } from 'pinia';
import * as api from '../api';

export const useStrategyTemplateStore = defineStore('strategyTemplate', {
  state: () => ({
    templates: [],
    currentTemplate: null,
    pagination: {
      page: 0,
      size: 10,
      total: 0,
    },
    loading: false,
    error: null,
  }),
  actions: {
    async fetchTemplates(page = 0, size = 10) {
      this.loading = true;
      try {
        const response = await api.getStrategyTemplates(page, size);
        this.templates = response.data.content;
        this.pagination.page = response.data.number;
        this.pagination.size = response.data.size;
        this.pagination.total = response.data.totalElements;
        this.error = null;
      } catch (error) {
        this.error = error.message || 'Failed to fetch strategy templates.';
        this.templates = [];
      } finally {
        this.loading = false;
      }
    },
    async fetchTemplateById(id) {
      this.loading = true;
      try {
        const response = await api.getStrategyTemplateById(id);
        this.currentTemplate = response.data;
        this.error = null;
        return response.data;
      } catch (error) {
        this.error = error.message || `Failed to fetch template with id ${id}.`;
        this.currentTemplate = null;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async createTemplate(formData) {
      this.loading = true;
      try {
        const response = await api.createStrategyTemplate(formData);
        // Optionally, refresh the list after creation
        await this.fetchTemplates(this.pagination.page, this.pagination.size);
        this.error = null;
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to create template.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async updateTemplate(id, formData) {
      this.loading = true;
      try {
        const response = await api.updateStrategyTemplate(id, formData);
        this.currentTemplate = response.data; // Update current template view
        await this.fetchTemplates(this.pagination.page, this.pagination.size);
        this.error = null;
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to update template.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async deleteTemplate(id) {
      this.loading = true;
      try {
        await api.deleteStrategyTemplate(id);
        // Refresh the list after deletion
        // Check if we need to go to the previous page
        const newTotal = this.pagination.total - 1;
        const lastPage = Math.ceil(newTotal / this.pagination.size) -1;
        const currentPage = this.pagination.page;
        const pageToGo = (currentPage > lastPage && lastPage >= 0) ? lastPage : currentPage;
        await this.fetchTemplates(pageToGo, this.pagination.size);
        this.error = null;
      } catch (error) {
        this.error = error.message || 'Failed to delete template.';
      } finally {
        this.loading = false;
      }
    },
    // Action to clear the current template when leaving the form
    clearCurrentTemplate() {
      this.currentTemplate = null;
    }
  },
}); 