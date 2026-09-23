import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import RecommendPage from './model/RecommendPage'
import ChartsPage from './model/ChartsPage'
import ArtistsPage from './model/ArtistsPage'
import PlaylistsPage from './model/PlaylistsPage'
import SearchPage from './model/SearchPage'

export default function MusicPage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<RecommendPage />} />
        <Route path="charts" element={<ChartsPage />} />
        <Route path="artists" element={<ArtistsPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/music" replace />} />
      </Route>
    </Routes>
  )
}
