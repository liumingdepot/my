import { useEffect, useRef, useState } from 'react'
import { fetchPlayUrl } from './server'
import type { PlayMode, Song } from './types'

const STORAGE_KEY = 'musicPlayList'

export type PlayError = '' | 'next' | 'url' | 'fail'

type StoredQueue = { index: number; list: Song[] }

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<Song[]>([])
  const [index, setIndex] = useState(0)
  const [current, setCurrent] = useState<Song | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<PlayError>('')
  const [mode, setMode] = useState<PlayMode>('list')
  const modeRef = useRef<PlayMode>('list')
  const queueRef = useRef<Song[]>([])
  const indexRef = useRef(0)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTime = () => {
      setCurrentTime(audio.currentTime)
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (modeRef.current === 'single') {
        audio.currentTime = 0
        void audio.play().catch(() => setPlaying(false))
        return
      }
      const list = queueRef.current
      if (!list.length) return
      const next = (indexRef.current + 1) % list.length
      void playAt(next, list)
    }
    const onError = () => {
      setError('next')
      setPlaying(false)
      setLoading(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as StoredQueue
        if (Array.isArray(saved.list) && saved.list.length) {
          setQueue(saved.list)
          setIndex(Math.min(saved.index || 0, saved.list.length - 1))
          setCurrent(saved.list[Math.min(saved.index || 0, saved.list.length - 1)] || null)
        }
      }
    } catch {
      /* ignore */
    }

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audioRef.current = null
    }
  }, [])

  function persist(list: Song[], i: number) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: i, list }))
    } catch {
      /* ignore */
    }
  }

  async function playAt(i: number, list = queueRef.current) {
    const song = list[i]
    if (!song?.id) return
    const audio = audioRef.current
    if (!audio) return

    setLoading(true)
    setError('')
    setIndex(i)
    setCurrent(song)
    persist(list, i)
    audio.pause()

    try {
      const { url } = await fetchPlayUrl(song.id)
      audio.src = url
      await audio.play()
      setPlaying(true)
    } catch {
      setError('url')
      setPlaying(false)
    } finally {
      setLoading(false)
    }
  }

  function playQueue(list: Song[], startIndex = 0) {
    if (!list.length) return
    setQueue(list)
    queueRef.current = list
    void playAt(startIndex, list)
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (!current) {
      if (queue.length) void playAt(index)
      return
    }
    if (playing) {
      audio.pause()
    } else if (audio.src) {
      void audio.play().catch(() => setError('fail'))
    } else {
      void playAt(index)
    }
  }

  function next() {
    const list = queueRef.current
    if (!list.length) return
    const i = (indexRef.current + 1) % list.length
    void playAt(i, list)
  }

  function prev() {
    const list = queueRef.current
    if (!list.length) return
    const i = indexRef.current > 0 ? indexRef.current - 1 : list.length - 1
    void playAt(i, list)
  }

  function seek(time: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(time)) return
    audio.currentTime = Math.max(0, Math.min(time, duration || time))
    setCurrentTime(audio.currentTime)
  }

  function toggleMode() {
    setMode((m) => (m === 'list' ? 'single' : 'list'))
  }

  return {
    queue,
    index,
    current,
    playing,
    currentTime,
    duration,
    loading,
    error,
    mode,
    playQueue,
    playAt,
    toggle,
    next,
    prev,
    seek,
    toggleMode,
  }
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
