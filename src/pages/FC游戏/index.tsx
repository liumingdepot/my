import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import ListPage from './model/ListPage'
import DetailPage from './model/DetailPage'

export default function GamePage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ListPage />} />
        <Route path=":id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to="/game" replace />} />
      </Route>
    </Routes>
  )
}
