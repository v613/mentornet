import fs from 'fs';
import path from 'path';

// Cache for loaded translations
const translationCache = new Map();

// Load translations for a specific locale
function loadTranslations(locale = 'en') {
  if (translationCache.has(locale)) {
    return translationCache.get(locale);
  }

  try {
    // In Netlify Functions, we need to read from the project root
    const translationsPath = path.join(process.cwd(), 'src', 'i18n', 'locales', `${locale}.json`);
    const translationsData = fs.readFileSync(translationsPath, 'utf-8');
    const translations = JSON.parse(translationsData);
    
    translationCache.set(locale, translations);
    return translations;
  } catch (error) {
    console.warn(`Failed to load translations for locale ${locale}:`, error.message);
    
    // Fallback to English if not already trying English
    if (locale !== 'en') {
      return loadTranslations('en');
    }
    
    // If English also fails, return empty object
    return {};
  }
}

// Get translation for a key with dot notation support
export function t(key, locale = 'en', params = {}) {
  const translations = loadTranslations(locale);
  
  // Support dot notation (e.g., 'courses.messages.courseNotFound')
  const keys = key.split('.');
  let value = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, return the key itself as fallback
      return key;
    }
  }
  
  // Replace parameters in the translation string
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }
  
  return value;
}

// Clear cache (useful for testing)
export function clearTranslationCache() {
  translationCache.clear();
}