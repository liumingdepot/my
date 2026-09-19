import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Home from './pages/首页'

const MusicPage = lazy(() => import('./pages/音乐'))
const VideoPage = lazy(() => import('./pages/视频'))
const SuanmingPage = lazy(() => import('./pages/算命'))
const ReportPage = lazy(() => import('./pages/算命/ReportPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/fortune" element={<SuanmingPage />} />
        <Route path="/fortune/report" element={<ReportPage />} />
        <Route path="/report" element={<Navigate to="/fortune/report" replace />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/video" element={<VideoPage />} />
        <Route path="/算命" element={<Navigate to="/fortune" replace />} />
        <Route path="/算命/report" element={<Navigate to="/fortune/report" replace />} />
        <Route path="/音乐" element={<Navigate to="/music" replace />} />
        <Route path="/视频" element={<Navigate to="/video" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
