<template>
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-gray-800">{{ $t('templates.form.parameters_title') }}</h3>
    <div class="border rounded-lg overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_name') }}</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_value') }}</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_data_type') }}</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('templates.form.param_direction') }}</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="!modelValue || modelValue.length === 0">
            <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">{{ $t('templates.form.no_params_detected') }}</td>
          </tr>
          <tr v-for="(param, index) in modelValue" :key="index">
            <td class="px-6 py-4 whitespace-nowrap">
              <n-input :value="param.name" readonly disabled />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <n-input
                :value="param.value"
                @update:value="newValue => updateParameter(index, 'value', newValue)"
                :placeholder="param.defaultValue || $t('common.please_input')"
              />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <n-select
                :value="param.dataType"
                :options="dataTypeOptions"
                @update:value="newValue => updateParameter(index, 'dataType', newValue)"
              />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <n-select
                :value="param.direction"
                :options="directionOptions"
                @update:value="newValue => updateParameter(index, 'direction', newValue)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { NInput, NSelect, NButton } from 'naive-ui';

export default defineComponent({
  name: 'ParameterEditor',
  components: {
    NInput,
    NSelect,
    NButton,
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

    const updateParameter = (index, key, value) => {
      // Create a deep copy of the array to avoid direct prop mutation.
      const newParams = JSON.parse(JSON.stringify(props.modelValue));
      // Update the specific value.
      if (newParams[index]) {
        newParams[index][key] = value;
      }
      // Emit the entire new array to the parent.
      emit('update:modelValue', newParams);
    };

    const deleteParameter = (index) => {
      const newParams = JSON.parse(JSON.stringify(props.modelValue));
      newParams.splice(index, 1);
      emit('update:modelValue', newParams);
    };

    return {
      t,
      dataTypeOptions,
      directionOptions,
      updateParameter,
      deleteParameter,
    };
  },
});
</script> 