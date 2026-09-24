import { Navigate, Route, Routes } from 'react-router'
import Layout from './model/Layout'
import HomePage from './model/HomePage'
import TypePage from './model/TypePage'
import SearchPage from './model/SearchPage'
import PlayPage from './model/PlayPage'

export default function ShortDramaPage() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="play/:id" element={<PlayPage />} />
        <Route path=":cat" element={<TypePage />} />
        <Route path="*" element={<Navigate to="/short" replace />} />
      </Route>
    </Routes>
  )
}
