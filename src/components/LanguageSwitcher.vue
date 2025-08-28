<template>
  <div class="language-switcher">
    <select v-model="currentLocale" @change="changeLanguage" class="language-select">
      <option value="ro">🇷🇴 {{ $t('language.ro') }}</option>
      <option value="en">🇺🇸 {{ $t('language.en') }}</option>
      <option value="ru">🇷🇺 {{ $t('language.ru') }}</option>
    </select>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const currentLocale = ref(locale.value)

const changeLanguage = () => {
  locale.value = currentLocale.value
  localStorage.setItem('locale', currentLocale.value)
}

watch(locale, (newLocale) => {
  currentLocale.value = newLocale
})
</script>

<style scoped>
.language-switcher {
  position: absolute;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
}

.language-select {
  padding: var(--spacing-sm);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-sm);
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text-inverse);
  font-size: 0.9rem;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all var(--transition-base);
}

.language-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.2);
}

.language-select option {
  background-color: var(--color-gray-800);
  color: var(--color-text-inverse);
}
</style>