<template>
  <div>
    <nav-bar />
    <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">{{ $t('templates.title') }}</h1>
        <n-button type="primary" @click="handleCreate">{{ $t('templates.create') }}</n-button>
      </div>

      <div class="bg-white p-8 rounded-lg shadow-md">
        <n-data-table
          :columns="columns"
          :data="templates"
          :loading="loading"
          :pagination="pagination"
          :row-key="row => row.id"
          @update:page="handlePageChange"
        />
      </div>
    </div>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title-style="font-weight: bold; font-size: 1.25rem;"
             :title="$t('templates.delete_confirm_title')"
             :content="$t('templates.delete_confirm_content')"
             :positive-text="$t('common.confirm')"
             :negative-text="$t('common.cancel')"
             @positive-click="confirmDelete"
             @negative-click="showDeleteModal = false"
    />
  </div>
</template>

<script>
import { defineComponent, ref, h, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useStrategyTemplateStore } from '@/stores/strategyTemplate';
import { storeToRefs } from 'pinia';
import { NButton, NDataTable, NModal, useMessage } from 'naive-ui';
import NavBar from '@/components/NavBar.vue';

export default defineComponent({
  name: 'StrategyTemplateList',
  components: {
    NavBar,
    NButton,
    NDataTable,
    NModal,
  },
  setup() {
    const router = useRouter();
    const { t } = useI18n();
    const store = useStrategyTemplateStore();
    const message = useMessage();
    const { templates, pagination, loading, error } = storeToRefs(store);

    const showDeleteModal = ref(false);
    const templateToDelete = ref(null);

    const columns = computed(() => [
      { title: t('templates.name'), key: 'name', sorter: 'default' },
      { title: t('templates.description'), key: 'description' },
      {
        title: t('templates.created_at'),
        key: 'createdAt',
        render: (row) => new Date(row.createdAt).toLocaleString(),
        sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      },
      {
        title: t('templates.updated_at'),
        key: 'updatedAt',
        render: (row) => new Date(row.updatedAt).toLocaleString(),
        sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      },
      {
        title: t('templates.actions'),
        key: 'actions',
        render(row) {
          return h('div', { class: 'space-x-2' }, [
            h(NButton, {
              strong: true,
              tertiary: true,
              size: 'small',
              onClick: () => handleEdit(row),
            }, { default: () => t('common.edit') }),
            h(NButton, {
              strong: true,
              tertiary: true,
              type: 'error',
              size: 'small',
              onClick: () => handleDelete(row),
            }, { default: () => t('common.delete') }),
          ]);
        },
      },
    ]);
    
    const handleCreate = () => {
      router.push({ name: 'StrategyTemplateCreate' });
    };

    const handleEdit = (row) => {
      router.push({ name: 'StrategyTemplateEdit', params: { id: row.id } });
    };

    const handleDelete = (row) => {
      templateToDelete.value = row;
      showDeleteModal.value = true;
    };

    const confirmDelete = async () => {
      if (templateToDelete.value) {
        await store.deleteTemplate(templateToDelete.value.id);
        if (store.error) {
          message.error(t('templates.delete_fail_message'));
        } else {
          message.success(t('templates.delete_success_message'));
        }
        showDeleteModal.value = false;
        templateToDelete.value = null;
      }
    };
    
    const handlePageChange = (page) => {
      store.fetchTemplates(page - 1, pagination.value.size);
    };

    onMounted(() => {
      store.fetchTemplates();
    });

    return {
      templates,
      pagination: computed(() => ({
        page: pagination.value.page + 1,
        pageSize: pagination.value.size,
        itemCount: pagination.value.total,
      })),
      loading,
      columns,
      showDeleteModal,
      handleCreate,
      handleEdit,
      handleDelete,
      confirmDelete,
      handlePageChange,
    };
  },
});
</script> 