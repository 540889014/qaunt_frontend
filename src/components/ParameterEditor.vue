<template>
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-gray-800">{{ $t('templates.form.parameters_title') }}</h3>
    <div class="border rounded-lg overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_name') }}</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_default_value') }}</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_data_type') }}</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_direction') }}</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="localParams.length === 0">
            <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">{{ $t('templates.form.no_params_detected') }}</td>
          </tr>
          <tr v-for="(param, index) in localParams" :key="index">
            <td class="px-6 py-4 whitespace-nowrap">
              <n-input :value="param.name" readonly disabled />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <n-input :value="param.defaultValue" readonly disabled />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <n-select v-model:value="param.dataType" :options="dataTypeOptions" />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <n-select v-model:value="param.direction" :options="directionOptions" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NInput, NSelect } from 'naive-ui';

export default defineComponent({
  name: 'ParameterEditor',
  components: {
    NInput,
    NSelect,
  },
  props: {
    modelValue: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const localParams = ref([...props.modelValue]);

    const dataTypeOptions = [
      { label: 'Integer', value: 'INT' },
      { label: 'Double', value: 'DOUBLE' },
      { label: 'String', value: 'STRING' },
      { label: 'Boolean', value: 'BOOLEAN' },
    ];

    const directionOptions = [
      { label: 'In', value: 'IN' },
      { label: 'Out', value: 'OUT' },
      { label: 'In/Out', value: 'INOUT' },
    ];

    watch(() => props.modelValue, (newValue) => {
      // Ensure we have a defensive copy to avoid direct prop mutation
      localParams.value = JSON.parse(JSON.stringify(newValue));
    }, { deep: true, immediate: true });

    watch(localParams, (newValue) => {
      emit('update:modelValue', newValue);
    }, { deep: true });

    return {
      t,
      localParams,
      dataTypeOptions,
      directionOptions,
    };
  },
});
</script> 