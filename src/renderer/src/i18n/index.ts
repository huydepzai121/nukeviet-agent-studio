import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en, vi } from './dict'

const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem('nvas.lang')

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: stored === 'en' ? 'en' : 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})

export default i18n
