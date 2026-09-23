import { Navigate, Route, Routes } from 'react-router'
import ListPage from './model/ListPage'
import PlayPage from './model/PlayPage'

export default function EducationPage() {
  return (
    <Routes>
      <Route index element={<ListPage />} />
      <Route path="play/:bvid" element={<PlayPage />} />
      <Route path="*" element={<Navigate to="/education" replace />} />
    </Routes>
  )
}
