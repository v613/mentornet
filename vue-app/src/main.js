import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'

const app = createApp(App)
app.use(i18n)

// Check for saved locale preference
const savedLocale = localStorage.getItem('locale')
if (savedLocale && ['ro', 'en', 'ru'].includes(savedLocale)) {
  i18n.global.locale.value = savedLocale
}

app.mount('#app')
