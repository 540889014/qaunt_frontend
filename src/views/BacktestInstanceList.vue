<template>
  <div>
    <nav-bar />
    <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">{{ $t('backtest_instances.title') }}</h1>
        <n-button type="primary" @click="handleCreate">{{ $t('backtest_instances.create') }}</n-button>
      </div>

      <div class="bg-white p-8 rounded-lg shadow-md">
        <n-data-table
          :columns="columns"
          :data="instances"
          :loading="loading"
          :pagination="paginationProps"
          :row-key="row => row.id"
          @update:page="handlePageChange"
        />
      </div>
    </div>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title-style="font-weight: bold; font-size: 1.25rem;"
             :title="$t('backtest_instances.delete_confirm_title')"
             :content="$t('backtest_instances.delete_confirm_content')"
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
import { useBacktestInstanceStore } from '@/stores/backtestInstance';
import { storeToRefs } from 'pinia';
import { NButton, NDataTable, NModal, useMessage, NTag } from 'naive-ui';
import NavBar from '@/components/NavBar.vue';

export default defineComponent({
  name: 'BacktestInstanceList',
  components: {
    NavBar,
    NButton,
    NDataTable,
    NModal,
    NTag,
  },
  setup() {
    const router = useRouter();
    const { t } = useI18n();
    const store = useBacktestInstanceStore();
    const message = useMessage();
    const { instances, pagination, loading, error } = storeToRefs(store);

    const showDeleteModal = ref(false);
    const instanceToDelete = ref(null);

    const getStatusType = (status) => {
      switch (status) {
        case 'RUNNING':
          return 'warning';
        case 'COMPLETED':
          return 'success';
        case 'NOT_RUN':
        default:
          return 'default';
      }
    };

    const columns = computed(() => [
      { title: t('backtest_instances.name'), key: 'name', sorter: 'default' },
      { title: t('backtest_instances.strategy_template_id'), key: 'strategyTemplateId' },
      {
        title: t('backtest_instances.status'),
        key: 'status',
        render(row) {
          return h(NTag, {
            type: getStatusType(row.status),
          }, { default: () => row.status });
        }
      },
      {
        title: t('backtest_instances.created_at'),
        key: 'createdAt',
        render: (row) => new Date(row.createdAt).toLocaleString(),
      },
      {
        title: t('backtest_instances.updated_at'),
        key: 'updatedAt',
        render: (row) => new Date(row.updatedAt).toLocaleString(),
      },
      {
        title: t('backtest_instances.actions'),
        key: 'actions',
        render(row) {
          return h('div', { class: 'space-x-2' }, [
            h(NButton, {
              strong: true,
              tertiary: true,
              size: 'small',
              onClick: () => handleRun(row),
              disabled: row.status === 'RUNNING',
            }, { default: () => t('common.run') }),
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
      router.push({ name: 'BacktestInstanceCreate' });
    };

    const handleEdit = (row) => {
      router.push({ name: 'BacktestInstanceEdit', params: { id: row.id } });
    };
    
    const handleRun = async (row) => {
      try {
        await store.runInstance(row.id);
        message.success(t('backtest_instances.run_success_message'));
      } catch {
        message.error(t('backtest_instances.run_fail_message'));
      }
    };

    const handleDelete = (row) => {
      instanceToDelete.value = row;
      showDeleteModal.value = true;
    };

    const confirmDelete = async () => {
      if (instanceToDelete.value) {
        await store.deleteInstance(instanceToDelete.value.id);
        if (error.value) {
          message.error(t('backtest_instances.delete_fail_message'));
        } else {
          message.success(t('backtest_instances.delete_success_message'));
        }
        showDeleteModal.value = false;
        instanceToDelete.value = null;
      }
    };
    
    const handlePageChange = (page) => {
      store.fetchInstances(page - 1, pagination.value.size);
    };

    onMounted(() => {
      store.fetchInstances();
    });

    const paginationProps = computed(() => ({
      page: pagination.value.page + 1,
      pageSize: pagination.value.size,
      itemCount: pagination.value.totalElements,
    }));

    return {
      instances,
      paginationProps,
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