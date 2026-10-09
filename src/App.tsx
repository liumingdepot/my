import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router'
import WorkDisclaimer from './components/WorkDisclaimer'
import BackToWorks from './pages/我的作品集/BackToWorks'
import Home from './pages/首页'

function WithWorkDisclaimer({
  moduleId,
  children,
}: {
  moduleId: string
  children: ReactNode
}) {
  return <WorkDisclaimer moduleId={moduleId}>{children}</WorkDisclaimer>
}

/** 旧 `/arcade/:id` → 统一游戏详情 */
function ArcadeIdRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/game/${id}` : '/game?platform=街机'} replace />
}

const CanvasPage = lazy(() => import('./pages/无限画布'))
const ZhouyiPage = lazy(() => import('./pages/周易'))
const ReportPage = lazy(() => import('./pages/周易/model/ReportPage'))
const MusicPage = lazy(() => import('./pages/音乐'))
const VideoPage = lazy(() => import('./pages/视频'))
const GamePage = lazy(() => import('./pages/游戏'))
const EducationPage = lazy(() => import('./pages/学习教育'))
const MoreWorksPage = lazy(() => import('./pages/我的作品集'))
const HongguoPage = lazy(() => import('./pages/红果短剧'))
const TestPage = lazy(() => import('./pages/测试'))
const FishPage = lazy(() => import('./pages/摸鱼助手'))
const AdminLayout = lazy(() => import('./pages/后台管理/Layout'))
const AdminLoginPage = lazy(() => import('./pages/后台管理/登录'))
const AdminUsersPage = lazy(() => import('./pages/后台管理/用户管理'))
const AdminVideoSourcesPage = lazy(() => import('./pages/后台管理/采集源'))
const AdminEducationPage = lazy(() => import('./pages/后台管理/教育管理'))
const AdminAgnesKeysPage = lazy(() => import('./pages/后台管理/密钥管理'))

export default function App() {
  return (
    <>
      <BackToWorks />
      <Suspense fallback={null}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/canvas/*" element={<CanvasPage />} />
        <Route path="/fortune" element={<ZhouyiPage />} />
        <Route path="/fortune/report" element={<ReportPage />} />
        <Route path="/report" element={<Navigate to="/fortune/report" replace />} />
        <Route
          path="/music/*"
          element={
            <WithWorkDisclaimer moduleId="music">
              <MusicPage />
            </WithWorkDisclaimer>
          }
        />
        <Route
          path="/video/*"
          element={
            <WithWorkDisclaimer moduleId="video">
              <VideoPage />
            </WithWorkDisclaimer>
          }
        />
        <Route
          path="/game/*"
          element={
            <WithWorkDisclaimer moduleId="game">
              <GamePage />
            </WithWorkDisclaimer>
          }
        />
        <Route
          path="/education/*"
          element={
            <WithWorkDisclaimer moduleId="education">
              <EducationPage />
            </WithWorkDisclaimer>
          }
        />
        <Route path="/works" element={<MoreWorksPage />} />
        <Route
          path="/hongguo/*"
          element={
            <WithWorkDisclaimer moduleId="hongguo">
              <HongguoPage />
            </WithWorkDisclaimer>
          }
        />
        <Route
          path="/test/*"
          element={
            <WithWorkDisclaimer moduleId="test">
              <TestPage />
            </WithWorkDisclaimer>
          }
        />
        <Route
          path="/fish/*"
          element={
            <WithWorkDisclaimer moduleId="fish">
              <FishPage />
            </WithWorkDisclaimer>
          }
        />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="video-sources" element={<AdminVideoSourcesPage />} />
          <Route path="games" element={<Navigate to="/admin" replace />} />
          <Route path="arcade" element={<Navigate to="/admin" replace />} />
          <Route path="education" element={<AdminEducationPage />} />
          <Route path="agnes-keys" element={<AdminAgnesKeysPage />} />
        </Route>
        <Route path="/无限画布" element={<Navigate to="/canvas" replace />} />
        <Route path="/无限画布/*" element={<Navigate to="/canvas" replace />} />
        <Route path="/周易" element={<Navigate to="/fortune" replace />} />
        <Route path="/周易/report" element={<Navigate to="/fortune/report" replace />} />
        <Route path="/算命" element={<Navigate to="/fortune" replace />} />
        <Route path="/算命/report" element={<Navigate to="/fortune/report" replace />} />
        <Route path="/音乐" element={<Navigate to="/music" replace />} />
        <Route path="/视频" element={<Navigate to="/video" replace />} />
        <Route path="/短剧" element={<Navigate to="/hongguo" replace />} />
        <Route path="/游戏" element={<Navigate to="/game" replace />} />
        <Route path="/FC游戏" element={<Navigate to="/game" replace />} />
        <Route path="/街机" element={<Navigate to="/game?platform=街机" replace />} />
        <Route path="/arcade" element={<Navigate to="/game?platform=街机" replace />} />
        <Route path="/arcade/:id" element={<ArcadeIdRedirect />} />
        <Route path="/arcade/*" element={<Navigate to="/game?platform=街机" replace />} />
        <Route path="/学习教育" element={<Navigate to="/education" replace />} />
        <Route path="/学习教育/*" element={<Navigate to="/education" replace />} />
        <Route path="/更多作品" element={<Navigate to="/works" replace />} />
        <Route path="/我的作品集" element={<Navigate to="/works" replace />} />
        <Route path="/测试" element={<Navigate to="/test" replace />} />
        <Route path="/测试模块" element={<Navigate to="/test" replace />} />
        <Route path="/short/*" element={<Navigate to="/hongguo" replace />} />
        <Route path="/红果短剧" element={<Navigate to="/hongguo" replace />} />
        <Route path="/红果短剧/*" element={<Navigate to="/hongguo" replace />} />
        <Route path="/摸鱼助手" element={<Navigate to="/fish" replace />} />
        <Route path="/摸鱼助手/*" element={<Navigate to="/fish" replace />} />
        <Route path="/铭摸鱼" element={<Navigate to="/fish" replace />} />
        <Route path="/后台管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/登录" element={<Navigate to="/admin/login" replace />} />
        <Route path="/后台管理/用户管理" element={<Navigate to="/admin/users" replace />} />
        <Route path="/后台管理/采集源" element={<Navigate to="/admin/video-sources" replace />} />
        <Route path="/后台管理/视频管理" element={<Navigate to="/admin/video-sources" replace />} />
        <Route path="/后台管理/游戏管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/FC游戏管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/FC管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/街机管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/教育管理" element={<Navigate to="/admin/education" replace />} />
        <Route path="/后台管理/密钥管理" element={<Navigate to="/admin/agnes-keys" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
