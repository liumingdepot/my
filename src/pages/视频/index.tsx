import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import HomePage from './model/HomePage'
import TypePage from './model/TypePage'
import SearchPage from './model/SearchPage'
import PlayPage from './model/PlayPage'
import ActorPage from './model/ActorPage'

export default function VideoPage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="movie" element={<TypePage />} />
        <Route path="tv" element={<TypePage />} />
        <Route path="anime" element={<TypePage />} />
        <Route path="variety" element={<TypePage />} />
        <Route path="actor" element={<ActorPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="play/:source/:id" element={<PlayPage />} />
        <Route path="*" element={<Navigate to="/video" replace />} />
      </Route>
    </Routes>
  )
}
