import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import HomePage from './model/HomePage'
import DetailPage from './model/DetailPage'

export default function TestModulePage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="detail/:id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to="/test" replace />} />
      </Route>
    </Routes>
  )
}
