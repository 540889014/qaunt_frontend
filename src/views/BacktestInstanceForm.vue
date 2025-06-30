<template>
  <div>
    <nav-bar />
    <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">
        {{ isEditMode ? $t('backtest_instances.form.edit_title') : $t('backtest_instances.form.create_title') }}
      </h1>

      <div class="bg-white p-8 rounded-lg shadow-md">
        <n-form ref="formRef" :model="formValue" :rules="rules" class="space-y-8">
          <n-form-item :label="$t('backtest_instances.name')" path="name">
            <n-input v-model:value="formValue.name" :placeholder="$t('backtest_instances.form.name_placeholder')" />
          </n-form-item>

          <n-form-item :label="$t('backtest_instances.form.strategy_template')" path="strategyTemplateId">
            <n-select
              v-model:value="formValue.strategyTemplateId"
              :options="strategyTemplateOptions"
              :loading="strategyTemplateStore.loading"
              :placeholder="$t('backtest_instances.form.strategy_template_placeholder')"
              @update:value="handleTemplateChange"
            />
          </n-form-item>

          <n-form-item :label="$t('backtest.exchange')">
            <n-select v-model:value="formValue.exchange" @update:value="handleExchangeChange" :options="exchangeOptions" />
          </n-form-item>

          <n-grid :cols="2" :x-gap="24">
            <n-form-item-gi :label="$t('backtest_instances.form.start_time')" path="startTime">
              <n-date-picker v-model:value="formValue.startTime" type="datetime" class="w-full" />
            </n-form-item-gi>
            <n-form-item-gi :label="$t('backtest_instances.form.end_time')" path="endTime">
              <n-date-picker v-model:value="formValue.endTime" type="datetime" class="w-full" />
            </n-form-item-gi>
          </n-grid>

          <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.data_type_config') }}</h3>
            <div class="flex items-center space-x-6">
              <n-checkbox v-model:checked="formValue.dataTypes.useDepth">{{ $t('backtest.depth') }}</n-checkbox>
              <n-checkbox v-model:checked="formValue.dataTypes.useTrade">{{ $t('backtest.trade') }}</n-checkbox>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.ohlc_period') }}</label>
              <n-select v-model:value="formValue.dataTypes.ohlc" multiple :options="timeframeOptions" :placeholder="$t('backtest.select_period')"/>
            </div>
          </div>

          <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.pattern_config') }}</h3>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('backtest.pattern_name') }}</label>
              <n-select v-model:value="formValue.backtestPattern.name" :options="patternOptions" />
            </div>
            <div v-if="formValue.backtestPattern.name === 'ORDERBOOK'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="missRatio" class="block text-sm font-medium text-gray-700">{{ $t('backtest.miss_ratio') }}</label>
                <n-input type="number" v-model:value="formValue.backtestPattern.params.miss_ratio" id="missRatio" step="0.001" />
              </div>
              <div>
                <label for="slippage" class="block text-sm font-medium text-gray-700">{{ $t('backtest.slippage') }}</label>
                <n-input type="number" v-model:value="formValue.backtestPattern.params.slippage" id="slippage" step="0.001" />
              </div>
            </div>
          </div>

          <n-form-item :label="$t('backtest_instances.form.symbols')">
            <div class="w-full">
              <div v-for="(symbol, index) in formValue.symbols" :key="index" class="flex items-center space-x-2 mb-2">
                <n-select
                  v-model:value="symbol.name"
                  filterable
                  :placeholder="$t('backtest.search_instrument')"
                  :options="symbolOptions"
                  class="flex-grow"
                />
                <n-button @click="removeSymbol(index)" type="error" text>
                  <template #icon><n-icon :component="TrashIcon" /></template>
                </n-button>
              </div>
            </div>
          </n-form-item>
          
          <div class="border-t pt-6">
            <h3 class="text-lg font-medium text-gray-800">{{ $t('backtest.strategy_params') }}</h3>
            <parameter-editor v-model="formValue.parameters" />
          </div>

          <div class="flex justify-end space-x-4">
            <n-button @click="handleCancel">{{ $t('common.cancel') }}</n-button>
            <n-button type="primary" @click="handleSubmit" :loading="loading">{{ $t('common.save') }}</n-button>
          </div>
        </n-form>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBacktestInstanceStore } from '@/stores/backtestInstance';
import { useStrategyTemplateStore } from '@/stores/strategyTemplate';
import { storeToRefs } from 'pinia';
import { NForm, NFormItem, NInput, NButton, NSelect, useMessage, NDatePicker, NGrid, NFormItemGi, NIcon, NCheckbox } from 'naive-ui';
import { Trash as TrashIcon } from '@vicons/ionicons5';
import NavBar from '@/components/NavBar.vue';
import ParameterEditor from '@/components/ParameterEditor.vue';
import { useAuthStore } from '@/stores/auth';
import { useSubscriptionStore } from '@/stores/subscription';
import { parseNumLegsFromScript } from '@/utils/parameter-parser';

// A simple UUID generator for browser compatibility.
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default defineComponent({
  name: 'BacktestInstanceForm',
  components: {
    NavBar,
    ParameterEditor,
    NForm,
    NFormItem,
    NInput,
    NButton,
    NSelect,
    NDatePicker,
    NGrid,
    NFormItemGi,
    NIcon,
    NCheckbox,
  },
  setup() {
    const router = useRouter();
    const route = useRoute();
    const { t } = useI18n();
    const message = useMessage();

    const backtestInstanceStore = useBacktestInstanceStore();
    const { loading, error } = storeToRefs(backtestInstanceStore);

    const strategyTemplateStore = useStrategyTemplateStore();
    const { templates: strategyTemplates, currentTemplate } = storeToRefs(strategyTemplateStore);
    
    const subscriptionStore = useSubscriptionStore();
    const { subscribedSymbols } = storeToRefs(subscriptionStore);
    
    const authStore = useAuthStore();

    const formRef = ref(null);
    const formValue = ref({
      name: '',
      strategyTemplateId: null,
      startTime: Date.now() - 365 * 24 * 60 * 60 * 1000, // Default to one year ago
      endTime: Date.now(),
      symbols: [{ name: '' }],
      exchange: 'okx',
      dataTypes: {
        useDepth: false,
        useTrade: false,
        ohlc: ['15m'],
      },
      backtestPattern: {
        name: 'OHLC',
        params: {
          miss_ratio: 0.01,
          slippage: 0.005,
        },
      },
      parameters: [],
    });
    
    const instanceId = computed(() => route.params.id);
    const isEditMode = computed(() => !!instanceId.value);

    const strategyTemplateOptions = computed(() => 
      strategyTemplates.value.map(template => ({
        label: template.name,
        value: template.id,
      }))
    );
    
    const symbolOptions = computed(() =>
      Array.isArray(subscribedSymbols.value) ? subscribedSymbols.value.map(s => ({ label: s, value: s })) : []
    );

    const exchangeOptions = [{ label: 'OKX', value: 'okx' }, { label: 'Binance', value: 'binance' }];
    const patternOptions = [{ label: 'OHLC', value: 'OHLC' }, { label: 'ORDERBOOK', value: 'ORDERBOOK' }];
    const timeframeOptions = [
        { label: '1m', value: '1m' }, { label: '3m', value: '3m' }, { label: '5m', value: '5m' },
        { label: '15m', value: '15m' }, { label: '30m', value: '30m' }, { label: '1H', value: '1H' },
        { label: '2H', value: '2H' }, { label: '4H', value: '4H' }, { label: '6H', value: '6H' },
        { label: '12H', value: '12H' }, { label: '1D', value: '1D' }, { label: '2D', value: '2D' },
        { label: '3D', value: '3D' }, { label: '1W', value: '1W' }, { label: '1M', value: '1M' },
        { label: '3M', value: '3M' }
    ];

    const timeframeMap = {
      '1m': 'ONE_MINUTE', '3m': 'THREE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE', '30m': 'THIRTY_MINUTE',
      '1H': 'ONE_HOUR', '2H': 'TWO_HOUR', '4H': 'FOUR_HOUR', '6H': 'SIX_HOUR', '12H': 'TWELVE_HOUR',
      '1D': 'ONE_DAY', '2D': 'TWO_DAY', '3D': 'THREE_DAY',
      '1W': 'ONE_WEEK',
      '1M': 'ONE_MONTH', '3M': 'THREE_MONTH'
    };

    const reverseTimeframeMap = Object.fromEntries(Object.entries(timeframeMap).map(([key, value]) => [value, key]));

    const rules = {
      name: { required: true, message: () => t('backtest_instances.form.name_required'), trigger: 'blur' },
      strategyTemplateId: { required: true, type: 'number', message: () => t('backtest_instances.form.strategy_template_required'), trigger: 'change' },
      startTime: { required: true, type: 'number', message: () => t('backtest_instances.form.start_time_required'), trigger: 'blur' },
      endTime: { required: true, type: 'number', message: () => t('backtest_instances.form.end_time_required'), trigger: 'blur' },
    };

    const addSymbol = () => {
      formValue.value.symbols.push({ name: '' });
    };

    const removeSymbol = (index) => {
      formValue.value.symbols.splice(index, 1);
    };

    const handleExchangeChange = (value) => {
      subscriptionStore.fetchSubscriptions(value);
    };

    const handleTemplateChange = (templateId) => {
      if (!templateId) {
        formValue.value.parameters = [];
        formValue.value.symbols = [{ name: '' }];
        return;
      }
      strategyTemplateStore.fetchTemplateById(templateId)
        .then((fetchedTemplate) => {
          if (fetchedTemplate) {
             // When a template is loaded, map its parameters to include a 'value' field
             // that users can edit, initializing it with the 'defaultValue'.
             formValue.value.parameters = (fetchedTemplate.parameters || []).map(p => ({
               ...p,
               value: p.defaultValue 
             }));

             // Parse the number of legs from the script content
             const numberOfLegs = fetchedTemplate.script 
               ? parseNumLegsFromScript(fetchedTemplate.script) 
               : 1;
             console.log("Parsed number of legs:", numberOfLegs);

             // Adjust the number of symbol inputs based on the number of legs
             formValue.value.symbols = Array(numberOfLegs > 0 ? numberOfLegs : 1).fill(null).map(() => ({ name: '' }));
          }
        })
        .catch(err => {
          message.error(t('backtest_instances.form.fetch_template_error'));
          console.error(err);
        });
    };

    onMounted(async () => {
      // Initial data fetching
      await strategyTemplateStore.fetchTemplates(0, 100);
      handleExchangeChange(formValue.value.exchange);

      if (isEditMode.value) {
        await backtestInstanceStore.fetchInstance(instanceId.value);
        const instance = backtestInstanceStore.instance;

        if (instance) {
          // Set simple form values from the instance
          formValue.value.name = instance.name;
          formValue.value.strategyTemplateId = instance.strategyTemplateId;

          // Fetch the full strategy template to get parameter definitions
          if (instance.strategyTemplateId) {
            const template = await strategyTemplateStore.fetchTemplateById(instance.strategyTemplateId);
            const savedParamsData = instance.params ? JSON.parse(instance.params) : {};
            
            // Combine template parameter definitions with saved instance values
            if (template && template.parameters) {
              const savedParamsMap = new Map(
                (savedParamsData.PARAMS || []).map(p => [p.NAME, p.VALUE])
              );

              formValue.value.parameters = template.parameters.map(p => ({
                ...p,
                value: savedParamsMap.has(p.name) ? String(savedParamsMap.get(p.name)) : p.defaultValue,
              }));
            }
            
            // Set other form values from saved params
            const params = savedParamsData;
            formValue.value.startTime = params.BACKTEST?.START_TIME || null;
            formValue.value.endTime = params.BACKTEST?.END_TIME || null;
            formValue.value.symbols = params.SYMBOLS?.map(s => ({ name: s.WITHOUT_TIME[0] })) || [{ name: '' }];
            formValue.value.exchange = params.ASSET_TYPE === 'CRYPTO' ? 'okx' : 'other';
            formValue.value.dataTypes.useDepth = params.DATA_TYPE?.USE_ORDER_BOOK || false;
            formValue.value.dataTypes.useTrade = params.DATA_TYPE?.USE_TRADE || false;
            formValue.value.dataTypes.ohlc = params.DATA_TYPE?.OHLC?.filter(o => o.USE).map(o => reverseTimeframeMap[o.TIME_TYPE]) || ['15m'];
            formValue.value.backtestPattern.name = params.BACKTEST?.BACKTEST_PATTERN?.PATTERN_NAME || 'OHLC';
            formValue.value.backtestPattern.params = params.BACKTEST?.BACKTEST_PATTERN?.PATTERN_PARAMS || { miss_ratio: 0.01, slippage: 0.005 };
          }
        }
      }
    });

    const handleSubmit = async () => {
      try {
        await formRef.value?.validate();
        
        const formattedParams = formValue.value.parameters.map(p => {
          const numValue = parseFloat(p.value);
          let valueType;

          if (p.dataType === 'INT') {
              valueType = 'INT';
          } else if (p.dataType === 'DOUBLE' || p.dataType === 'FLOAT') {
              if (Number.isInteger(numValue)) {
                  valueType = 'INT';
              } else {
                  valueType = 'DECIMAL';
              }
          } else {
              valueType = p.dataType;
          }
          
          return {
            NAME: p.name,
            TYPE: p.direction,
            VALUE: numValue,
            VALUE_TYPE: valueType
          };
        });

        if (isEditMode.value) {
          const paramsObject = {
            BACKTEST: {
              OUTPUT_REPORT: true,
              START_TIME: formValue.value.startTime,
              END_TIME: formValue.value.endTime,
              PERFORMANCE: {},
              BACKTEST_PATTERN: {
                PATTERN_NAME: formValue.value.backtestPattern.name,
                PATTERN_PARAMS: formValue.value.backtestPattern.params,
              },
              SEND_HEARTBEAT: false,
              HEARTBEAT_INTERVAL: 60000
            },
            IS_OPTIMIZE: false,
            STRATEGY_FILE: currentTemplate.value?.scriptPath || "",
            STUDIO_DB: "finone_crypto.db",
            ASSET_TYPE: "CRYPTO",
            RESULT_ID: generateUUID(),
            SYMBOLS: formValue.value.symbols.map(s => ({ "WITHOUT_TIME": [s.name.includes('.') ? s.name : `${s.name}.${formValue.value.exchange.toLowerCase()}`] })),
            PARAMS: formattedParams,
            CSV_OUTPUT_PATH: "backtest_results/",
            RATES_URL: "http://localhost:8080",
            STRATEGY_NAME: `backtestInstance_${instanceId.value}`,
            LOG_LEVEL: "INFO",
            DATA_TYPE: {
              USE_ORDER_BOOK: formValue.value.dataTypes.useDepth,
              USE_TRADE: formValue.value.dataTypes.useTrade,
              OHLC: formValue.value.dataTypes.ohlc.map(t => ({
                TYPE: "MID",
                TIME_TYPE: timeframeMap[t] || t.toUpperCase(),
                USE: true
              }))
            }
          };

          const payload = {
            name: formValue.value.name,
            strategyTemplateId: formValue.value.strategyTemplateId,
            params: JSON.stringify(paramsObject),
          };

          await backtestInstanceStore.updateInstance(instanceId.value, payload);
          message.success(t('backtest_instances.form.update_success_message'));

        } else {
          // Step 1: Create instance with minimal data to get an ID.
          const initialPayload = {
            name: formValue.value.name,
            strategyTemplateId: formValue.value.strategyTemplateId,
            params: JSON.stringify({ status: "initializing" }),
          };
          const newInstance = await backtestInstanceStore.createInstance(initialPayload);
          if (!newInstance || !newInstance.id) {
            throw new Error("Failed to create backtest instance or get a valid ID.");
          }
          const newInstanceId = newInstance.id;

          // Step 2: Build the full parameters with the new ID and update the instance.
          const paramsObject = {
             BACKTEST: {
                OUTPUT_REPORT: true,
                START_TIME: formValue.value.startTime,
                END_TIME: formValue.value.endTime,
                PERFORMANCE: {},
                BACKTEST_PATTERN: {
                  PATTERN_NAME: formValue.value.backtestPattern.name,
                  PATTERN_PARAMS: formValue.value.backtestPattern.params,
                },
                SEND_HEARTBEAT: false,
                HEARTBEAT_INTERVAL: 60000
              },
              IS_OPTIMIZE: false,
              STRATEGY_FILE: currentTemplate.value?.scriptPath || "",
              STUDIO_DB: "finone_crypto.db",
              ASSET_TYPE: "CRYPTO",
              RESULT_ID: generateUUID(),
              SYMBOLS: formValue.value.symbols.map(s => ({ "WITHOUT_TIME": [s.name.includes('.') ? s.name : `${s.name}.${formValue.value.exchange.toLowerCase()}`] })),
              PARAMS: formattedParams,
              CSV_OUTPUT_PATH: "backtest_results/",
              RATES_URL: "http://localhost:8080",
              STRATEGY_NAME: `backtestInstance_${newInstanceId}`,
              LOG_LEVEL: "INFO",
              DATA_TYPE: {
                USE_ORDER_BOOK: formValue.value.dataTypes.useDepth,
                USE_TRADE: formValue.value.dataTypes.useTrade,
                OHLC: formValue.value.dataTypes.ohlc.map(t => ({
                  TYPE: "MID",
                  TIME_TYPE: timeframeMap[t] || t.toUpperCase(),
                  USE: true
                }))
              }
          };
          
          const finalPayload = {
            name: formValue.value.name,
            strategyTemplateId: formValue.value.strategyTemplateId,
            params: JSON.stringify(paramsObject),
          };
          await backtestInstanceStore.updateInstance(newInstanceId, finalPayload);
          message.success(t('backtest_instances.form.create_success_message'));
        }
        
        router.push({ name: 'BacktestInstanceList' });
      } catch (validationErrors) {
        if (validationErrors) {
          console.error('Form validation failed', validationErrors);
        } else {
          message.error(error.value?.message || t('common.error_unexpected'));
        }
      }
    };

    const handleCancel = () => {
      router.push({ name: 'BacktestInstanceList' });
    };

    return {
      formRef,
      formValue,
      rules,
      isEditMode,
      loading,
      strategyTemplateOptions,
      symbolOptions,
      exchangeOptions,
      patternOptions,
      timeframeOptions,
      strategyTemplateStore,
      handleSubmit,
      handleCancel,
      handleTemplateChange,
      handleExchangeChange,
      addSymbol,
      removeSymbol,
      TrashIcon,
    };
  },
});
</script> 