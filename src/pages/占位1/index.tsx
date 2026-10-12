import { Navigate, Route, Routes } from 'react-router'
import PlaceholderPage from './PlaceholderPage'

export default function Placeholder1Page() {
  return (
    <Routes>
      <Route index element={<Navigate to="1" replace />} />
      <Route path=":id" element={<PlaceholderPage />} />
      <Route path="*" element={<Navigate to="1" replace />} />
    </Routes>
  )
}
