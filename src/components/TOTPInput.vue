<template>
  <div class="totp-input-container">
    <label v-if="label" :for="inputId" class="totp-label">
      {{ label }}
    </label>
    <div class="totp-input-group" :class="{ 'focused': isFocused }">
      <input
        :id="inputId"
        ref="totpInput"
        v-model="code"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="6"
        placeholder="000000"
        class="totp-input"
        :disabled="disabled"
        :class="{ 'error': hasError }"
        @input="handleInput"
        @paste="handlePaste"
        @focus="isFocused = true"
        @blur="isFocused = false"
        autocomplete="one-time-code"
      />
      <div class="totp-input-visual">
        <span
          v-for="(digit, index) in displayDigits"
          :key="index"
          class="digit-box"
          :class="{ 
            'filled': digit !== '', 
            'active': index === code.length && !disabled,
            'error': hasError
          }"
        >
          {{ digit }}
        </span>
      </div>
    </div>
    <small v-if="helpText" class="totp-help">{{ helpText }}</small>
    <div v-if="errorMessage" class="totp-error">{{ errorMessage }}</div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  helpText: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'complete'])

const totpInput = ref(null)
const inputId = `totp-input-${Math.random().toString(36).substr(2, 9)}`
const isFocused = ref(false)

const code = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const hasError = computed(() => !!props.errorMessage)

const displayDigits = computed(() => {
  const digits = code.value.padEnd(6, '').split('')
  return digits.slice(0, 6)
})

const handleInput = (event) => {
  let value = event.target.value.replace(/[^0-9]/g, '')
  
  if (value.length > 6) {
    value = value.slice(0, 6)
  }
  
  code.value = value
  
  if (value.length === 6) {
    emit('complete', value)
  }
}

const handlePaste = (event) => {
  event.preventDefault()
  const pastedData = event.clipboardData.getData('text')
  const numericData = pastedData.replace(/[^0-9]/g, '').slice(0, 6)
  
  code.value = numericData
  
  if (numericData.length === 6) {
    emit('complete', numericData)
  }
}

const focus = () => {
  nextTick(() => {
    if (totpInput.value) {
      totpInput.value.focus()
    }
  })
}

const clear = () => {
  code.value = ''
}

defineExpose({
  focus,
  clear
})
</script>

<style scoped>
.totp-input-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.totp-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .totp-label {
    color: var(--vt-c-text-dark-2);
  }
}

.totp-input-group {
  position: relative;
  display: flex;
  justify-content: center;
}

.totp-input-group.focused {
  outline: 2px solid var(--color-input-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.totp-input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.totp-input-visual {
  display: flex;
  gap: var(--spacing-sm);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs);
  cursor: text;
  transition: all var(--transition-base);
}

@media (prefers-color-scheme: dark) {
  .totp-input-visual {
    background: var(--vt-c-black-soft);
    border: 1px solid var(--color-input-border);
  }
}

.totp-input-visual:hover {
  border-color: var(--color-input-focus);
}

.digit-box {
  width: 48px;
  height: 56px;
  border: 2px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  transition: all var(--transition-base);
}

@media (prefers-color-scheme: dark) {
  .digit-box {
    border: 2px solid var(--color-input-border);
    background-color: var(--vt-c-black);
    color: var(--vt-c-text-dark-1);
  }
}

.digit-box.filled {
  border-color: var(--color-input-focus);
  background-color: var(--color-bg-secondary);
}

@media (prefers-color-scheme: dark) {
  .digit-box.filled {
    border-color: var(--color-input-focus);
    background-color: var(--vt-c-black-mute);
  }
}

.digit-box.active {
  border-color: var(--color-input-focus);
  box-shadow: 0 0 0 1px var(--color-input-focus);
}

.digit-box.active::after {
  content: '|';
  animation: blink 1s infinite;
  color: var(--color-input-focus);
  font-weight: normal;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.digit-box.error {
  border-color: var(--color-error);
  background-color: var(--color-error-light);
}

@media (prefers-color-scheme: dark) {
  .digit-box.error {
    border-color: var(--color-error);
    background-color: var(--color-error-light);
  }
}

.totp-help {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .totp-help {
    color: var(--vt-c-text-dark-2);
  }
}

.totp-error {
  font-size: 0.8rem;
  color: var(--color-error);
  text-align: center;
  margin-top: var(--spacing-xs);
}

@media (prefers-color-scheme: dark) {
  .totp-error {
    color: var(--color-error);
  }
}

@media (max-width: 768px) {
  .totp-input-container::before {
    content: "Tap to enter code";
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    display: block;
    text-align: center;
    margin-bottom: var(--spacing-xs);
  }

  @media (prefers-color-scheme: dark) {
    .totp-input-container::before {
      color: var(--vt-c-text-dark-2);
    }
  }

  .digit-box {
    width: 40px;
    height: 48px;
    font-size: 1.3rem;
  }
  
  .totp-input-visual {
    gap: var(--spacing-xs);
  }
}
</style>