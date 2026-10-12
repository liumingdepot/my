import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router'
import WorkDisclaimer from './components/WorkDisclaimer'
import BackToWorks from './pages/首页/BackToWorks'
import HomePage from './pages/首页'
import WorksPage from './pages/首页/作品集'

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

const Resume = lazy(() => import('./pages/个人简历'))
const CanvasPage = lazy(() => import('./pages/无限画布'))
const ZhouyiPage = lazy(() => import('./pages/周易'))
const ReportPage = lazy(() => import('./pages/周易/model/ReportPage'))
const MusicPage = lazy(() => import('./pages/音乐'))
const VideoPage = lazy(() => import('./pages/视频'))
const ShortDramaPage = lazy(() => import('./pages/短剧'))
const GamePage = lazy(() => import('./pages/游戏'))
const EducationPage = lazy(() => import('./pages/学习教育'))
const HongguoPage = lazy(() => import('./pages/红果短剧'))
const FishPage = lazy(() => import('./pages/摸鱼助手'))
const Placeholder1Page = lazy(() => import('./pages/占位1'))
const Placeholder2Page = lazy(() => import('./pages/占位2'))
const AdminLayout = lazy(() => import('./pages/后台管理/Layout'))
const AdminLoginPage = lazy(() => import('./pages/后台管理/登录'))
const AdminVideoSourcesPage = lazy(() => import('./pages/后台管理/视频采集'))
const AdminAgnesKeysPage = lazy(() => import('./pages/后台管理/密钥管理'))
const AdminWorksPage = lazy(() => import('./pages/后台管理/作品管理'))

export default function App() {
  return (
    <>
      <BackToWorks />
      <Suspense fallback={null}>
        <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/home" element={<Resume />} />
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
          path="/short/*"
          element={
            <WithWorkDisclaimer moduleId="short">
              <ShortDramaPage />
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
        <Route
          path="/hongguo/*"
          element={
            <WithWorkDisclaimer moduleId="hongguo">
              <HongguoPage />
            </WithWorkDisclaimer>
          }
        />
        <Route path="/test/*" element={<Navigate to="/hongguo" replace />} />
        <Route
          path="/fish/*"
          element={
            <WithWorkDisclaimer moduleId="fish">
              <FishPage />
            </WithWorkDisclaimer>
          }
        />
        <Route path="/ph1/*" element={<Placeholder1Page />} />
        <Route path="/ph2/*" element={<Placeholder2Page />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="works" replace />} />
          <Route path="works" element={<AdminWorksPage />} />
          <Route path="video-sources" element={<AdminVideoSourcesPage />} />
          <Route path="games" element={<Navigate to="/admin" replace />} />
          <Route path="arcade" element={<Navigate to="/admin" replace />} />
          <Route path="education" element={<Navigate to="/admin" replace />} />
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
        <Route path="/短剧" element={<Navigate to="/short" replace />} />
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
        <Route path="/作品" element={<Navigate to="/works" replace />} />
        <Route path="/作品集" element={<Navigate to="/works" replace />} />
        <Route path="/个人简历" element={<Navigate to="/home" replace />} />
        <Route path="/测试" element={<Navigate to="/hongguo" replace />} />
        <Route path="/测试模块" element={<Navigate to="/hongguo" replace />} />
        <Route path="/红果短剧" element={<Navigate to="/hongguo" replace />} />
        <Route path="/红果短剧/*" element={<Navigate to="/hongguo" replace />} />
        <Route path="/摸鱼助手" element={<Navigate to="/fish" replace />} />
        <Route path="/摸鱼助手/*" element={<Navigate to="/fish" replace />} />
        <Route path="/铭摸鱼" element={<Navigate to="/fish" replace />} />
        <Route path="/后台管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/登录" element={<Navigate to="/admin/login" replace />} />
        <Route path="/后台管理/用户管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/作品管理" element={<Navigate to="/admin/works" replace />} />
        <Route path="/后台管理/采集源" element={<Navigate to="/admin/video-sources" replace />} />
        <Route path="/后台管理/视频管理" element={<Navigate to="/admin/video-sources" replace />} />
        <Route path="/后台管理/视频采集" element={<Navigate to="/admin/video-sources" replace />} />
        <Route path="/后台管理/游戏管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/FC游戏管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/FC管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/街机管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/教育管理" element={<Navigate to="/admin" replace />} />
        <Route path="/后台管理/密钥管理" element={<Navigate to="/admin/agnes-keys" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
