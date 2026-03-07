import { defineStore } from 'pinia';
import * as api from '../api';

export const useStrategyTemplateStore = defineStore('strategyTemplate', {
  state: () => ({
    templates: [],
    currentTemplate: null,
    pagination: {
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    },
    loading: false,
    error: null,
  }),
  actions: {
    async fetchTemplates(page = 0, size = 10) {
      this.loading = true;
      try {
        const response = await api.getStrategyTemplates(page, size);
        this.templates = Array.isArray(response?.content) ? response.content : [];
        this.pagination.page = Number.isFinite(response?.number) ? response.number : page;
        this.pagination.size = Number.isFinite(response?.size) ? response.size : size;
        this.pagination.totalElements = Number.isFinite(response?.totalElements) ? response.totalElements : this.templates.length;
        this.pagination.totalPages = Number.isFinite(response?.totalPages) ? response.totalPages : 1;
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
        this.currentTemplate = response;
        this.error = null;
        return response;
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
        return response;
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
        this.currentTemplate = response; // Update current template view
        await this.fetchTemplates(this.pagination.page, this.pagination.size);
        this.error = null;
        return response;
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
        // Refresh current page from server to keep pagination consistent.
        const targetPage = this.templates.length <= 1 && this.pagination.page > 0
          ? this.pagination.page - 1
          : this.pagination.page;
        await this.fetchTemplates(targetPage, this.pagination.size);
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