import { useLayoutEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'theme'

/** 读取与首页共用的主题，缺省为浅色。 */
export function readTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
}

/** 浏览器地址栏颜色，与首页浅色 / 暗色底一致。 */
export function themeColor(theme: ThemeMode) {
  return theme === 'dark' ? '#0b1020' : '#f5f6fb'
}

/**
 * 同步文档主题。
 * 写入 documentElement.dataset.theme 与 localStorage，和首页共用同一键。
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(readTheme)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
  }, [theme])

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}
