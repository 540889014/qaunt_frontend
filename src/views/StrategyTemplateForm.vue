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
            <div class="flex items-center space-x-4">
              <n-upload
                :max="1"
                :default-upload="false"
                @change="handleFileChange"
                :show-file-list="false"
              >
                <n-button>{{ $t('templates.form.select_file') }}</n-button>
              </n-upload>
              <n-button @click="openCodeEditor" type="info">{{ $t('common.view_edit_code') }}</n-button>
            </div>
            <div v-if="fileName" class="mt-2 text-gray-600 flex items-center">
              <span>{{ fileName }}</span>
              <n-spin v-if="parsingFile" size="small" class="ml-2" />
            </div>
            <div v-if="isEditMode && !fileName" class="mt-2 text-sm text-gray-500">{{ $t('templates.form.keep_existing_file') }}</div>
          </n-form-item>

          <parameter-editor v-model="formValue.parameters" />

          <div class="flex justify-end space-x-4">
            <n-button @click="handleCancel">{{ $t('common.cancel') }}</n-button>
            <n-button type="primary" @click="handleSubmit" :loading="loading" :disabled="isEditMode && !isFormDirty">{{ $t('common.save') }}</n-button>
          </div>
        </n-form>
      </div>

      <n-modal v-model:show="showCodeModal" :mask-closable="false">
        <n-card
          style="width: 80vw; max-width: 1200px;"
          :title="$t('common.code_editor')"
          :bordered="false"
          size="huge"
          role="dialog"
          aria-modal="true"
        >
          <codemirror
            v-model="scriptContent"
            placeholder="Python code goes here..."
            :style="{ height: '60vh' }"
            :autofocus="true"
            :indent-with-tab="true"
            :tab-size="4"
            :extensions="extensions"
          />
          <template #footer>
            <div class="flex justify-end space-x-4">
              <n-button @click="showCodeModal = false">{{ $t('common.cancel') }}</n-button>
              <n-button type="primary" @click="handleCodeUpdate">{{ $t('common.confirm') }}</n-button>
            </div>
          </template>
        </n-card>
      </n-modal>

    </div>
  </div>
</template>
<script>
import { defineComponent, ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useStrategyTemplateStore } from '@/stores/strategyTemplate';
import { storeToRefs } from 'pinia';
import { NForm, NFormItem, NInput, NButton, NUpload, useMessage, NSpin, NModal, NCard } from 'naive-ui';
import { Codemirror } from 'vue-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion } from '@codemirror/autocomplete';
import { pythonApiContext } from '@/utils/python-completion-context.js';
import NavBar from '@/components/NavBar.vue';
import ParameterEditor from '@/components/ParameterEditor.vue';
import { parseStrategyParametersStream } from '@/utils/parameter-parser';

// --- Autocompletion Logic ---
const getCompletions = (context) => {
  /**
   * Finds the current function scope by walking up from the cursor position.
   * @returns {{params: {name: string, type: string | null}[]} | null}
   */
  const findCurrentFunctionScope = () => {
    const fullCode = context.state.doc.toString();
    const cursorLineNum = context.state.doc.lineAt(context.pos).number;
    const lines = fullCode.split('\n');

    for (let i = cursorLineNum - 1; i >= 0; i--) {
      const line = lines[i];
      const funcMatch = line.match(/^(\s*)def\s+\w+\(([^)]*)\)/);
      if (funcMatch) {
        const funcIndent = funcMatch[1].length;
        const cursorLine = lines[cursorLineNum - 1];
        // A simple check to see if the cursor is likely inside the function body.
        if (cursorLine.match(/^\s*/)[0].length > funcIndent || (cursorLineNum - 1) === i) {
          const paramsStr = funcMatch[2];
          const params = paramsStr.split(',').map(p => {
            const parts = p.trim().split(':');
            return {
              name: parts[0].trim(),
              type: parts.length > 1 ? parts[1].trim() : null,
            };
          }).filter(p => p.name); // Filter out empty strings if any
          return { params };
        }
      }
    }
    return null; // Not inside a known function scope
  };

  const scope = findCurrentFunctionScope();
  const memberMatch = context.matchBefore(/(\w+)\./);

  // 1. Handle member access (e.g., "ohlc1." or "OrderSide.")
  if (memberMatch) {
    const objName = memberMatch.text.slice(0, -1);

    // Enums
    if (pythonApiContext.enums[objName]) {
      return { from: context.pos, options: pythonApiContext.enums[objName].members };
    }

    // `self`
    if (objName === 'self') {
      return {
        from: context.pos,
        options: [
          ...pythonApiContext.apiFunctions,
          ...Object.keys(pythonApiContext.dataObjects).map(name => ({ label: name, type: 'class' })),
          ...Object.keys(pythonApiContext.enums).map(name => ({ label: name, type: 'enum' })),
        ],
      };
    }

    // Typed variable from function parameters
    if (scope) {
      const param = scope.params.find(p => p.name === objName);
      if (param && param.type && pythonApiContext.dataObjects[param.type]) {
        return { from: context.pos, options: pythonApiContext.dataObjects[param.type].properties };
      }
    }
    
    // Check for `create_order` assignment
    const fullCode = context.state.doc.toString();
    const assignmentRegex = new RegExp(`^\\s*${objName}\\s*=\\s*(self\\.)?create_order\\(.*\\)`, 'm');
    if (assignmentRegex.test(fullCode) && pythonApiContext.dataObjects['Order']) {
        return { from: context.pos, options: pythonApiContext.dataObjects['Order'].properties };
    }

    return null;
  }

  // 2. Handle `def` keyword for lifecycle methods
  const defMatch = context.matchBefore(/def\s+\w*/);
  if (defMatch) {
    return { from: defMatch.from + 4, options: pythonApiContext.lifeCycleMethods };
  }
  
  // 3. Handle global and local variable completions
  const word = context.matchBefore(/\w*/);
  if (word.from === word.to && !context.explicit) {
    return null;
  }

  let options = [
    ...pythonApiContext.apiFunctions,
    ...Object.keys(pythonApiContext.dataObjects).map(name => ({ label: name, type: 'class' })),
    ...Object.keys(pythonApiContext.enums).map(name => ({ label: name, type: 'enum' })),
    { label: "def", type: "keyword" },
    { label: "class", type: "keyword" },
  ];

  if (scope) {
    const localVariables = scope.params.map(p => ({ label: p.name, type: 'variable' }));
    options.push(...localVariables);
  }

  return { from: word.from, options };
};

const pythonCompletions = autocompletion({ override: [getCompletions] });
// --- End Autocompletion Logic ---

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
    NSpin,
    NModal,
    NCard,
    Codemirror,
  },
  setup() {
    const router = useRouter();
    const route = useRoute();
    const { t } = useI18n();
    const store = useStrategyTemplateStore();
    const message = useMessage();
    const { loading, currentTemplate } = storeToRefs(store);

    const formRef = ref(null);
    const formValue = ref({
      name: '',
      description: '',
      parameters: [],
      scriptFile: null,
    });
    const initialFormValue = ref(null);
    const fileName = ref('');
    const parsingFile = ref(false);
    const showCodeModal = ref(false);
    const scriptContent = ref('');

    const templateId = computed(() => route.params.id);
    const isEditMode = computed(() => !!templateId.value);
    
    const isFormDirty = computed(() => {
      if (!initialFormValue.value) return false;
      const current = { ...formValue.value };
      const initial = { ...initialFormValue.value };
      // Don't compare the scriptFile object directly
      current.scriptFile = null;
      initial.scriptFile = null;
      return JSON.stringify(current) !== JSON.stringify(initial) || formValue.value.scriptFile !== null;
    });

    const extensions = [python(), oneDark, pythonCompletions];

    const rules = {
      name: { required: true, message: () => t('templates.form.name_required'), trigger: 'blur' },
      scriptFile: { 
        required: !isEditMode.value, 
        message: () => t('templates.form.script_required'),
        validator: (rule, value) => !rule.required || formValue.value.scriptFile !== null,
        trigger: 'change' 
      },
    };
    
    const handleFileChange = async ({ file }) => {
      if ((file.status === 'pending' || file.status === 'uploading') && file.file) {
        parsingFile.value = true;
        formValue.value.scriptFile = file.file;
        fileName.value = file.name;
        
        try {
          const stream = file.file.stream();
          const parsedParams = await parseStrategyParametersStream(stream);

          // Preserve existing types if in edit mode
          if (isEditMode.value && currentTemplate.value?.parameters) {
            const existingParams = JSON.parse(currentTemplate.value.parameters);
            formValue.value.parameters = parsedParams.map(p => {
              const existing = existingParams.find(ep => ep.name === p.name);
              return existing ? { ...p, dataType: existing.dataType, direction: existing.direction } : p;
            });
          } else {
            formValue.value.parameters = parsedParams;
          }
        } catch (error) {
          message.error(`Failed to parse parameters: ${error.message}`);
          formValue.value.parameters = [];
        } finally {
          parsingFile.value = false;
        }
      } else if (file.status === 'removed') {
        formValue.value.scriptFile = null;
        fileName.value = '';
        formValue.value.parameters = [];
      }
    };
    
    const openCodeEditor = async () => {
      if (isEditMode.value && !currentTemplate.value) {
        await store.fetchTemplateById(templateId.value);
      }
      scriptContent.value = currentTemplate.value?.script || '';
      showCodeModal.value = true;
    };

    const handleCodeUpdate = async () => {
      parsingFile.value = true;
      try {
        const blob = new Blob([scriptContent.value], { type: 'text/x-python' });
        const stream = blob.stream();
        const parsedParams = await parseStrategyParametersStream(stream);

        formValue.value.parameters = parsedParams.map(p => {
            const existing = formValue.value.parameters.find(ep => ep.name === p.name);
            return existing ? { ...p, dataType: existing.dataType, direction: existing.direction } : p;
        });

        const updatedFile = new File([blob], fileName.value || 'strategy.py', { type: 'text/x-python' });
        formValue.value.scriptFile = updatedFile;
        message.success(t('templates.form.code_updated_and_reparsed'));
      } catch (error) {
        message.error(`Failed to re-parse parameters: ${error.message}`);
      } finally {
        parsingFile.value = false;
        showCodeModal.value = false;
      }
    };
    
    const handleSubmit = (e) => {
      e.preventDefault();
      formRef.value?.validate(async (errors) => {
        if (!errors) {
          const formData = new FormData();
          formData.append('name', formValue.value.name);
          formData.append('description', formValue.value.description);
          formData.append('parameters', JSON.stringify(formValue.value.parameters));
          if (formValue.value.scriptFile) {
            formData.append('file', formValue.value.scriptFile);
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
      store.clearCurrentTemplate();
      if (isEditMode.value) {
        await store.fetchTemplateById(templateId.value);
        if (store.currentTemplate) {
          formValue.value.name = store.currentTemplate.name;
          formValue.value.description = store.currentTemplate.description;
          formValue.value.parameters = store.currentTemplate.parameters || [];
          fileName.value = store.currentTemplate.fileName || '';
          
          // Store the initial state after loading
          initialFormValue.value = JSON.parse(JSON.stringify(formValue.value));
        }
      }
    });

    return {
      formRef,
      formValue,
      fileName,
      parsingFile,
      showCodeModal,
      scriptContent,
      isEditMode,
      rules,
      loading,
      isFormDirty,
      handleFileChange,
      openCodeEditor,
      handleCodeUpdate,
      handleSubmit,
      handleCancel,
      extensions,
    };
  },
});
</script>