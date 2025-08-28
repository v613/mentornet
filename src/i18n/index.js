import { createI18n } from 'vue-i18n'
import ro from './locales/ro.json'
import ru from './locales/ru.json'
import en from './locales/en.json'

const messages = {ro,en,ru}
const i18n = createI18n({legacy:false, locale:'ro', fallbackLocale:'ru', messages})
export default i18n