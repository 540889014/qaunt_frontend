<template>
  <div>
    <nav-bar />
    <div class="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">
        {{ isEditMode ? $t('templates.form.edit_title') : $t('templates.form.create_title') }}
      </h1>

      <div class="bg-white p-8 rounded-lg shadow-md">
        <n-form ref="formRef" :model="formValue" :rules="rules" class="space-y-8">
          <n-form-item :label="$t('templates.name')" path="name">
            <n-input v-model:value="formValue.name" :placeholder="$t('templates.form.name_placeholder')" />
          </n-form-item>
          
          <n-form-item :label="$t('templates.description')" path="description">
            <n-input v-model:value="formValue.description" type="textarea" :placeholder="$t('templates.form.description_placeholder')" />
          </n-form-item>

          <n-form-item :label="$t('templates.form.script_file')" path="scriptFile">
            <n-upload
              :max="1"
              :default-upload="false"
              @change="handleFileChange"
            >
              <n-button>{{ $t('templates.form.select_file') }}</n-button>
              <div v-if="fileName" class="ml-4 text-gray-600">{{ fileName }}</div>
            </n-upload>
            <div v-if="isEditMode && !fileName" class="ml-4 text-sm text-gray-500">{{ $t('templates.form.keep_existing_file') }}</div>
          </n-form-item>

          <parameter-editor v-model="formValue.parameters" />

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
import { useStrategyTemplateStore } from '@/stores/strategyTemplate';
import { storeToRefs } from 'pinia';
import { NForm, NFormItem, NInput, NButton, NUpload, useMessage } from 'naive-ui';
import NavBar from '@/components/NavBar.vue';
import ParameterEditor from '@/components/ParameterEditor.vue';
import { parseStrategyParameters } from '@/utils/parameter-parser';

export default defineComponent({
  name: 'StrategyTemplateForm',
  components: {
    NavBar,
    ParameterEditor,
    NForm,
    NFormItem,
    NInput,
    NButton,
    NUpload,
  },
  setup() {
    const router = useRouter();
    const route = useRoute();
    const { t } = useI18n();
    const store = useStrategyTemplateStore();
    const message = useMessage();
    const { loading } = storeToRefs(store);

    const formRef = ref(null);
    const formValue = ref({
      name: '',
      description: '',
      parameters: [],
      scriptFile: null,
    });
    const fileName = ref('');

    const templateId = computed(() => route.params.id);
    const isEditMode = computed(() => !!templateId.value);
    
    const rules = {
      name: { required: true, message: () => t('templates.form.name_required'), trigger: 'blur' },
      scriptFile: { 
        required: !isEditMode.value, 
        message: () => t('templates.form.script_required'),
        validator: () => formValue.value.scriptFile !== null,
        trigger: 'change' 
      },
    };
    
    const handleFileChange = ({ file }) => {
      if (file.status === 'pending' || file.status === 'uploading') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const scriptContent = e.target.result;
            const parsedParams = parseStrategyParameters(scriptContent);
            
            // In edit mode, merge with existing params to preserve settings like dataType
            if (isEditMode.value && store.currentTemplate) {
                formValue.value.parameters = parsedParams.map(p => {
                    const existing = store.currentTemplate.parameters.find(ep => ep.name === p.name);
                    return existing ? { ...p, dataType: existing.dataType, direction: existing.direction } : p;
                });
            } else {
                formValue.value.parameters = parsedParams;
            }

            formValue.value.scriptFile = file.file;
            fileName.value = file.name;
          };
          reader.readAsText(file.file);
      } else if (file.status === 'removed') {
        formValue.value.scriptFile = null;
        fileName.value = '';
        formValue.value.parameters = [];
      }
    };
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      formRef.value?.validate(async (errors) => {
        if (!errors) {
          const formData = new FormData();
          formData.append('name', formValue.value.name);
          formData.append('description', formValue.value.description);
          formData.append('parameters', JSON.stringify(formValue.value.parameters));
          if (formValue.value.scriptFile) {
            formData.append('scriptFile', formValue.value.scriptFile);
          }

          try {
            if (isEditMode.value) {
              await store.updateTemplate(templateId.value, formData);
              message.success(t('templates.form.update_success'));
            } else {
              await store.createTemplate(formData);
              message.success(t('templates.form.create_success'));
            }
            router.push({ name: 'StrategyTemplateList' });
          } catch (error) {
            message.error(error.message || t('templates.form.submit_fail'));
          }
        } else {
          message.error(t('templates.form.validation_fail'));
        }
      });
    };

    const handleCancel = () => {
      router.push({ name: 'StrategyTemplateList' });
    };

    onMounted(async () => {
      if (isEditMode.value) {
        await store.fetchTemplateById(templateId.value);
        if (store.currentTemplate) {
          formValue.value.name = store.currentTemplate.name;
          formValue.value.description = store.currentTemplate.description;
          formValue.value.parameters = store.currentTemplate.parameters;
        }
      } else {
         store.clearCurrentTemplate();
      }
    });

    return {
      formRef,
      formValue,
      fileName,
      rules,
      isEditMode,
      loading,
      handleFileChange,
      handleSubmit,
      handleCancel,
    };
  },
});
</script> 