import { createI18n } from 'vue-i18n';

// 使用 Vite 的 import.meta.globEager 机制一次性打包所有 locale JSON
const localeModules = import.meta.glob('./locales/*.json', { eager: true });

const messages = {};
for (const path in localeModules) {
  const matched = path.match(/([A-Za-z0-9-_]+)\.json$/);
  if (matched && matched[1]) {
    messages[matched[1]] = localeModules[path].default;
  }
}

const i18n = createI18n({
  legacy: true, // 使用 Composition API 模式，必须为 false
  globalInjection: true, // 允许在模板中使用 $t 等全局函数
  locale: localStorage.getItem('locale') || 'zh', // 从本地存储读取语言，默认为中文
  fallbackLocale: 'en', // 如果某个 key 在当前语言中不存在，则回退到英文
  messages,
});

export default i18n;
console.log('Loaded messages:', messages);
console.log('Initial locale:', localStorage.getItem('locale') || 'zh');