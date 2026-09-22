import { ar } from './locales/ar'
import { de } from './locales/de'
import { en } from './locales/en'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { hi } from './locales/hi'
import { ja } from './locales/ja'
import { pt } from './locales/pt'
import { ru } from './locales/ru'
import { zh } from './locales/zh'
import { zht } from './locales/zht'

/** 语言列表：中文排首位；无本地记录时默认英语 */
export const LANG_OPTIONS = [
  { code: 'zh', label: '中文', htmlLang: 'zh-CN', dir: 'ltr', title: '刘铭 · 前端开发' },
  { code: 'en', label: 'English', htmlLang: 'en', dir: 'ltr', title: 'Liu Ming · Frontend' },
  { code: 'zht', label: '繁體', htmlLang: 'zh-TW', dir: 'ltr', title: '劉銘 · 前端開發' },
  { code: 'es', label: 'Español', htmlLang: 'es', dir: 'ltr', title: 'Liu Ming · Frontend' },
  { code: 'ar', label: 'العربية', htmlLang: 'ar', dir: 'rtl', title: 'Liu Ming · Frontend' },
  { code: 'fr', label: 'Français', htmlLang: 'fr', dir: 'ltr', title: 'Liu Ming · Frontend' },
  { code: 'pt', label: 'Português', htmlLang: 'pt', dir: 'ltr', title: 'Liu Ming · Frontend' },
  { code: 'ru', label: 'Русский', htmlLang: 'ru', dir: 'ltr', title: 'Liu Ming · Frontend' },
  { code: 'hi', label: 'हिन्दी', htmlLang: 'hi', dir: 'ltr', title: 'Liu Ming · Frontend' },
  { code: 'ja', label: '日本語', htmlLang: 'ja', dir: 'ltr', title: 'Liu Ming · フロントエンド' },
  { code: 'de', label: 'Deutsch', htmlLang: 'de', dir: 'ltr', title: 'Liu Ming · Frontend' },
] as const

export type Lang = (typeof LANG_OPTIONS)[number]['code']

export const I18N = { en, zh, zht, es, ar, fr, pt, ru, hi, ja, de }

export function isLang(value: string | null): value is Lang {
  return LANG_OPTIONS.some((item) => item.code === value)
}

export function resolveLang(value: string | null): Lang {
  return isLang(value) ? value : 'en'
}

export function getLangMeta(lang: Lang) {
  return LANG_OPTIONS.find((item) => item.code === lang)!
}
