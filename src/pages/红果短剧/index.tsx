import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import HomePage from './model/HomePage'
import TypePage from './model/TypePage'
import BrowsePage from './model/BrowsePage'
import SearchPage from './model/SearchPage'
import PlayPage from './model/PlayPage'

export default function HongguoPage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="play/:id" element={<PlayPage />} />
        <Route path=":cat" element={<TypePage />} />
        <Route path="*" element={<Navigate to="/hongguo" replace />} />
      </Route>
    </Routes>
  )
}
