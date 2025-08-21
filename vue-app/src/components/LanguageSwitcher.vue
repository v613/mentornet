<template>
  <div class="language-switcher">
    <select v-model="currentLocale" @change="changeLanguage" class="language-select">
      <option value="ro">{{ $t('language.ro') }}</option>
      <option value="en">{{ $t('language.en') }}</option>
      <option value="ru">{{ $t('language.ru') }}</option>
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
  top: 1rem;
  right: 1rem;
}

.language-select {
  padding: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.language-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
}

.language-select option {
  background-color: #333;
  color: white;
}
</style>