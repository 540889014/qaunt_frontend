<template>
  <div v-if="message" class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
    <p class="font-bold">エラー</p>
    <p>{{ message }}</p>
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    required: true
  },
  dismissible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['dismiss'])
</script>

<style scoped>
.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message__content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-message__icon {
  background-color: #c62828;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.error-message__text {
  margin: 0;
}

.error-message__dismiss {
  background: none;
  border: none;
  color: #c62828;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.error-message__dismiss:hover {
  color: #b71c1c;
}
</style> 