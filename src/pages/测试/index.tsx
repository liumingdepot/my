import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import DiscoverPage from './model/DiscoverPage'
import RankPage from './model/RankPage'
import SearchPage from './model/SearchPage'
import DetailPage from './model/DetailPage'
import PlayPage from './model/PlayPage'
import FavPage from './model/FavPage'
import HistoryPage from './model/HistoryPage'
import SettingsPage from './model/SettingsPage'

export default function TestPage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DiscoverPage />} />
        <Route path="rank" element={<RankPage />} />
        <Route path="fav" element={<FavPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="search/:q" element={<SearchPage />} />
        <Route path="detail/:sid" element={<DetailPage />} />
        <Route path="watch/:sid/:ep" element={<PlayPage />} />
        <Route path="*" element={<Navigate to="/test" replace />} />
      </Route>
    </Routes>
  )
}
