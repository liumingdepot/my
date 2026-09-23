import { createContext, useContext, type ReactNode } from 'react'
import { usePlayer } from '../utils/usePlayer'
import type { Song } from '../utils/types'

type PlayerApi = ReturnType<typeof usePlayer>

type MusicCtx = {
  player: PlayerApi
  play: (list: Song[], index?: number) => void
}

const Ctx = createContext<MusicCtx | null>(null)

export function MusicProvider({ children }: { children: ReactNode }) {
  const player = usePlayer()
  return (
    <Ctx.Provider value={{ player, play: (list, index = 0) => player.playQueue(list, index) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMusic() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMusic must be used within MusicProvider')
  return ctx
}
