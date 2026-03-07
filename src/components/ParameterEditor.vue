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
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="!modelValue || modelValue.length === 0">
            <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">{{ $t('templates.form.no_params_detected') }}</td>
          </tr>
          <tr v-for="(param, index) in modelValue" :key="index">
            <td class="px-6 py-4 whitespace-nowrap">
              <n-input :value="param.name" readonly disabled />
            </td>
            <td class="px-6 py-4">
              <template v-if="param.dataType === 'BOOLEAN'">
                <n-switch
                  :value="toBoolean(param.value, param.defaultValue)"
                  @update:value="newValue => updateParameter(index, 'value', newValue)"
                />
              </template>
              <template v-else-if="isNumericType(param.dataType)">
                <div class="space-y-2">
                  <div class="flex items-center gap-2 text-xs text-gray-600">
                    <n-switch
                      size="small"
                      :value="isRangeMode(param)"
                      @update:value="enabled => toggleRangeMode(index, enabled)"
                    />
                    <span>区间寻优</span>
                  </div>

                  <div v-if="isRangeMode(param)" class="grid grid-cols-3 gap-2">
                    <n-input
                      :value="getRangeFieldValue(param, 'start')"
                      type="number"
                      placeholder="起始值"
                      @update:value="v => updateRangeField(index, 'rangeStart', v)"
                    />
                    <n-input
                      :value="getRangeFieldValue(param, 'end')"
                      type="number"
                      placeholder="结束值"
                      @update:value="v => updateRangeField(index, 'rangeEnd', v)"
                    />
                    <n-input
                      :value="getRangeFieldValue(param, 'step')"
                      type="number"
                      placeholder="步长"
                      @update:value="v => updateRangeField(index, 'rangeStep', v)"
                    />
                  </div>

                  <n-input
                    v-else
                    :value="param.value"
                    type="number"
                    @update:value="newValue => updateParameter(index, 'value', newValue)"
                    :placeholder="param.defaultValue || $t('common.please_input')"
                  />

                  <div v-if="isRangeMode(param)" class="text-xs text-gray-500">
                    提交格式: {{ buildRangeValue(param) || '-' }}
                  </div>
                </div>
              </template>
              <template v-else>
                <n-input
                  :value="param.value"
                  @update:value="newValue => updateParameter(index, 'value', newValue)"
                  :placeholder="param.defaultValue || $t('common.please_input')"
                />
              </template>
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
            <td class="px-6 py-4 whitespace-nowrap">
              <n-button type="error" size="small" @click="deleteParameter(index)">{{ $t('common.delete') }}</n-button>
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
import { NInput, NSelect, NButton, NSwitch } from 'naive-ui';

const RANGE_PATTERN = /^\s*-?\d+(?:\.\d+)?\s*-\s*-?\d+(?:\.\d+)?\s*:\s*-?\d+(?:\.\d+)?\s*$/;

export default defineComponent({
  name: 'ParameterEditor',
  components: {
    NInput,
    NSelect,
    NButton,
    NSwitch,
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

    const toBoolean = (v, defaultValue) => {
      if (v === true || v === false) return v;
      const raw = (v ?? defaultValue ?? '').toString().trim().toLowerCase();
      if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'y') return true;
      if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'n') return false;
      return false;
    };

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

    const cloneParams = () => JSON.parse(JSON.stringify(props.modelValue));

    const isNumericType = (dataType) => ['INT', 'DOUBLE', 'FLOAT', 'DECIMAL'].includes((dataType || '').toUpperCase());

    const parseRangeString = (value) => {
      if (value == null) return null;
      const raw = String(value).trim();
      if (!RANGE_PATTERN.test(raw)) return null;
      const [rangePart, stepPart] = raw.split(':');
      const splitIdx = rangePart.slice(1).indexOf('-');
      if (splitIdx < 0) return null;
      const idx = splitIdx + 1;
      const start = rangePart.slice(0, idx).trim();
      const end = rangePart.slice(idx + 1).trim();
      const step = (stepPart || '').trim();
      return { start, end, step };
    };

    const getRangeFieldValue = (param, field) => {
      const direct = {
        start: param?.rangeStart,
        end: param?.rangeEnd,
        step: param?.rangeStep,
      }[field];
      if (direct != null && String(direct).trim() !== '') return direct;

      const parsed = parseRangeString(param?.value);
      if (!parsed) return '';
      if (field === 'start') return parsed.start;
      if (field === 'end') return parsed.end;
      if (field === 'step') return parsed.step;
      return '';
    };

    const buildRangeValue = (param) => {
      const start = (param?.rangeStart ?? '').toString().trim();
      const end = (param?.rangeEnd ?? '').toString().trim();
      const step = (param?.rangeStep ?? '').toString().trim();
      if (!start || !end || !step) return '';
      return `${start}-${end}:${step}`;
    };

    const isRangeMode = (param) => {
      // Respect explicit toggle state first, so user can collapse after enabling.
      if (param?.rangeMode === true) return true;
      if (param?.rangeMode === false) return false;
      return RANGE_PATTERN.test(String(param?.value ?? '').trim());
    };

    const updateParameter = (index, key, value) => {
      const newParams = cloneParams();
      if (!newParams[index]) return;
      const p = newParams[index];
      p[key] = value;

      if (key === 'dataType' && !isNumericType(value)) {
        delete p.rangeMode;
        delete p.rangeStart;
        delete p.rangeEnd;
        delete p.rangeStep;
        delete p.singleValueBackup;
      }

      // Keep latest scalar value so we can restore it after collapsing range mode.
      if (key === 'value' && isNumericType(p.dataType) && !isRangeMode(p)) {
        p.singleValueBackup = value;
      }

      emit('update:modelValue', newParams);
    };

    const toggleRangeMode = (index, enabled) => {
      const newParams = cloneParams();
      if (!newParams[index]) return;
      const p = newParams[index];

      if (!enabled) {
        p.rangeMode = false;
        const backup = p.singleValueBackup ?? p.defaultValue ?? '';
        const text = String(p.value ?? '').trim();
        // If current value is empty or range expression, restore scalar backup/default.
        if (!text || RANGE_PATTERN.test(text)) {
          p.value = backup;
        }
        emit('update:modelValue', newParams);
        return;
      }

      const currentText = String(p.value ?? '').trim();
      if (currentText && !RANGE_PATTERN.test(currentText)) {
        p.singleValueBackup = p.value;
      } else if (p.singleValueBackup == null && p.defaultValue != null) {
        p.singleValueBackup = p.defaultValue;
      }

      const parsed = parseRangeString(p.value);
      p.rangeMode = true;
      p.rangeStart = parsed?.start ?? String(p.value ?? p.defaultValue ?? '').trim();
      p.rangeEnd = parsed?.end ?? p.rangeStart;
      p.rangeStep = parsed?.step ?? '1';
      p.value = buildRangeValue(p);
      emit('update:modelValue', newParams);
    };

    const updateRangeField = (index, key, value) => {
      const newParams = cloneParams();
      if (!newParams[index]) return;
      const p = newParams[index];
      p.rangeMode = true;
      p[key] = value;
      p.value = buildRangeValue(p);
      emit('update:modelValue', newParams);
    };

    const deleteParameter = (index) => {
      const newParams = cloneParams();
      newParams.splice(index, 1);
      emit('update:modelValue', newParams);
    };

    return {
      t,
      toBoolean,
      dataTypeOptions,
      directionOptions,
      isNumericType,
      isRangeMode,
      buildRangeValue,
      getRangeFieldValue,
      updateParameter,
      updateRangeField,
      toggleRangeMode,
      deleteParameter,
    };
  },
});
</script>
