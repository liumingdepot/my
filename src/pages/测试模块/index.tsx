import { useLayoutEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import HomePage from './model/HomePage'
import DetailPage from './model/DetailPage'

export default function TestModulePage() {
  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '七猫短剧 · 测试'
  }, [])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path=":id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to="/test" replace />} />
      </Route>
    </Routes>
  )
}
