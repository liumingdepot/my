import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

/** 与首页共用，缺省中文。 */
export type Lang = 'zh' | 'en'

const LANG_KEY = 'lang'

export function readLang(): Lang {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'
}

type LangContextValue = {
  lang: Lang
  toggleLang: () => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readLang)

  useLayoutEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  function toggleLang() {
    setLang((current) => (current === 'zh' ? 'en' : 'zh'))
  }

  return <LangContext.Provider value={{ lang, toggleLang }}>{children}</LangContext.Provider>
}

export function useLang() {
  const value = useContext(LangContext)
  if (!value) throw new Error('useLang must be used within LangProvider')
  return value
}

type Strings<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Strings<U>[]
    : T extends object
      ? { [K in keyof T]: Strings<T[K]> }
      : T

export function dictionary<T>(zh: T, en: Strings<T>) {
  return { zh, en }
}
