import { createI18n } from 'vue-i18n'
import ro from './locales/ro.json'
import en from './locales/en.json'
import ru from './locales/ru.json'

const messages = {
  ro,
  en,
  ru
}

const i18n = createI18n({
  legacy: false,
  locale: 'ro',
  fallbackLocale: 'en',
  messages
})

export default i18n