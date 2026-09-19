import { Navigate, Route, Routes } from 'react-router'
import Home from './pages/首页'
import ReportPage from './pages/算命/ReportPage'
import SuanmingPage from './pages/算命'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/算命" element={<SuanmingPage />} />
      <Route path="/算命/report" element={<ReportPage />} />
      <Route path="/report" element={<Navigate to="/算命/report" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
