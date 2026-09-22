import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Home from './pages/首页'

const MusicPage = lazy(() => import('./pages/音乐'))
const SuanmingPage = lazy(() => import('./pages/算命'))
const ReportPage = lazy(() => import('./pages/算命/model/ReportPage'))
const VideoPage = lazy(() => import('./pages/视频'))
const AdminLayout = lazy(() => import('./pages/后台管理/Layout'))
const AdminLoginPage = lazy(() => import('./pages/后台管理/登录'))
const AdminUsersPage = lazy(() => import('./pages/后台管理/用户管理'))
const AdminVideoSourcesPage = lazy(() => import('./pages/后台管理/采集源'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/fortune" element={<SuanmingPage />} />
        <Route path="/fortune/report" element={<ReportPage />} />
        <Route path="/report" element={<Navigate to="/fortune/report" replace />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/video/*" element={<VideoPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="video-sources" element={<AdminVideoSourcesPage />} />
        </Route>
        <Route path="/算命" element={<Navigate to="/fortune" replace />} />
        <Route path="/算命/report" element={<Navigate to="/fortune/report" replace />} />
        <Route path="/音乐" element={<Navigate to="/music" replace />} />
        <Route path="/视频" element={<Navigate to="/video" replace />} />
        <Route path="/后台管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/登录" element={<Navigate to="/admin/login" replace />} />
        <Route path="/后台管理/用户管理" element={<Navigate to="/admin/users" replace />} />
        <Route path="/后台管理/采集源" element={<Navigate to="/admin/video-sources" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
