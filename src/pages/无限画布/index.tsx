import { useLayoutEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import EditPage from './model/EditPage'
import HistoryPage from './model/HistoryPage'
import HomePage from './model/HomePage'
import ListPage from './model/ListPage'
import CanvasLayout from './model/Layout'

export default function CanvasPage() {
  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '铭AI短剧 · 无限画布'
  }, [])

  return (
    <Routes>
      <Route path="edit/:id/canvas" element={<EditPage />} />
      <Route path="edit/:id" element={<ListPage />} />
      <Route element={<CanvasLayout />}>
        <Route index element={<HomePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/canvas" replace />} />
      </Route>
    </Routes>
  )
}
