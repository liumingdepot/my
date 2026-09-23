import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import {
  formatDateLabel,
  lunarDayLabel,
  lunarMonths,
  lunarToSolar,
  solarToLunar,
  toTimestamp,
  type BirthParts,
  type CalendarMode,
} from '../utils/calendar'
import { SHICHEN, shichenLabel, t } from '../utils/i18n'
import styled from 'styled-components'

const MOBILE_QUERY = '(max-width: 900px)'
const YEAR_START = 1920
const ITEM_HEIGHT = 44
const VISIBLE_ROWS = 5
const DEFAULT_BIRTH: BirthParts = { year: 1995, month: 1, day: 1 }

export type BirthSelection = {
  calendar: CalendarMode
  birth: BirthParts
  shichen: string
}

export type BirthPickerHandle = {
  open: () => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function defaultParts(mode: CalendarMode): BirthParts {
  if (mode === 'solar') return DEFAULT_BIRTH
  return solarToLunar(DEFAULT_BIRTH) ?? DEFAULT_BIRTH
}

function currentShichen() {
  const index = Math.floor(((new Date().getHours() + 1) % 24) / 2)
  return SHICHEN[index]?.name ?? SHICHEN[0].name
}

type WheelOption = {
  value: number
  label: string
}

function WheelColumn({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: WheelOption[]
  value: number
  onChange: (next: number) => void
  ariaLabel: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: number; y: number; offset: number } | null>(null)
  const offsetRef = useRef(0)
  const [active, setActive] = useState(value)
  const pad = Math.floor(VISIBLE_ROWS / 2)
  const activeLabel = options.find((option) => option.value === active)?.label ?? String(active)
  const optionsRef = useRef(options)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  optionsRef.current = options
  onChangeRef.current = onChange
  valueRef.current = value

  function clampIndex(index: number) {
    return Math.max(0, Math.min(optionsRef.current.length - 1, index))
  }

  function applyOffset(offset: number) {
    const max = Math.max(0, (optionsRef.current.length - 1) * ITEM_HEIGHT)
    const next = Math.max(0, Math.min(max, offset))
    offsetRef.current = next
    const el = scrollerRef.current
    if (el) el.style.transform = `translate3d(0, ${-next}px, 0)`
    return next
  }

  function readIndex() {
    return clampIndex(Math.round(offsetRef.current / ITEM_HEIGHT))
  }

  function commit() {
    const index = readIndex()
    const next = optionsRef.current[index]?.value
    if (next == null) return
    applyOffset(index * ITEM_HEIGHT)
    setActive(next)
    if (next !== valueRef.current) onChangeRef.current(next)
  }

  useEffect(() => {
    if (dragRef.current) return
    const index = options.findIndex((option) => option.value === value)
    if (index < 0) return
    applyOffset(index * ITEM_HEIGHT)
    setActive(value)
  }, [options, value])

  useEffect(() => {
    const column = columnRef.current
    if (!column) return
    let timer = 0
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      applyOffset(offsetRef.current + event.deltaY)
      const next = optionsRef.current[readIndex()]?.value
      if (next == null) return
      setActive((prev) => (prev === next ? prev : next))
      window.clearTimeout(timer)
      timer = window.setTimeout(commit, 80)
    }
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.id !== event.pointerId) return
      event.preventDefault()
      applyOffset(drag.offset - (event.clientY - drag.y))
      const next = optionsRef.current[readIndex()]?.value
      if (next == null) return
      setActive((prev) => (prev === next ? prev : next))
    }
    const onUp = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.id !== event.pointerId) return
      dragRef.current = null
      commit()
    }
    column.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      column.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div
      ref={columnRef}
      className="wheel-column"
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={active}
      aria-valuetext={activeLabel}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        event.preventDefault()
        dragRef.current = {
          id: event.pointerId,
          y: event.clientY,
          offset: offsetRef.current,
        }
      }}
    >
      <div ref={scrollerRef} className="wheel-scroller">
        <div className="wheel-pad" style={{ height: pad * ITEM_HEIGHT }} />
        {options.map((option) => (
          <div
            key={option.value}
            className={`wheel-item${option.value === active ? ' is-active' : ''}`}
            style={{ height: ITEM_HEIGHT }}
          >
            {option.label}
          </div>
        ))}
        <div className="wheel-pad" style={{ height: pad * ITEM_HEIGHT }} />
      </div>
    </div>
  )
}

function PickerShell({
  open,
  title,
  titleId,
  closeLabel,
  isMobile,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  titleId: string
  closeLabel: string
  isMobile: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <Style>
      <div
        className={`sheet-root${isMobile ? '' : ' is-center'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button type="button" className="sheet-backdrop" aria-label={closeLabel} onClick={onClose} />
        <div className="sheet-panel">
          {isMobile ? <div className="sheet-handle" aria-hidden="true" /> : null}
          <p className="sheet-title" id={titleId}>
            {title}
          </p>
          {children}
          {footer}
        </div>
      </div>
    </Style>,
    document.body,
  )
}

export default function BirthPicker({
  id = 'birth',
  value,
  onChange,
  ref,
}: {
  id?: string
  value: BirthSelection | null
  onChange: (next: BirthSelection) => void
  ref?: Ref<BirthPickerHandle>
}) {
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [draftCalendar, setDraftCalendar] = useState<CalendarMode>('solar')
  const [draftYear, setDraftYear] = useState(DEFAULT_BIRTH.year)
  const [draftMonth, setDraftMonth] = useState(DEFAULT_BIRTH.month)
  const [draftDay, setDraftDay] = useState(DEFAULT_BIRTH.day)
  const [draftHour, setDraftHour] = useState(0)
  const isMobile = useIsMobile()
  const titleId = useId()
  const valueRef = useRef(value)
  valueRef.current = value

  const hourOptions = useMemo(
    () => SHICHEN.map((item, index) => ({ value: index, label: `${item.name} ${item.range}` })),
    [],
  )

  const years = useMemo(() => {
    const end = new Date().getFullYear()
    const start = Math.min(YEAR_START, value?.birth.year ?? YEAR_START, draftYear)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [value?.birth.year, draftYear])

  const yearOptions = useMemo(
    () => years.map((year) => ({ value: year, label: `${year}${t.year}` })),
    [years],
  )

  const monthOptions = useMemo(() => {
    if (draftCalendar === 'solar') {
      return Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}${t.month}` }))
    }
    return lunarMonths(draftYear).map((month) => ({ value: month.value, label: month.label }))
  }, [draftCalendar, draftYear])

  const dayOptions = useMemo(() => {
    if (draftCalendar === 'solar') {
      const count = daysInMonth(draftYear, draftMonth)
      return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: `${i + 1}${t.day}` }))
    }
    const count = lunarMonths(draftYear).find((month) => month.value === draftMonth)?.days ?? 30
    return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: lunarDayLabel(i + 1) }))
  }, [draftCalendar, draftYear, draftMonth])

  useEffect(() => {
    if (draftCalendar === 'lunar') {
      const list = lunarMonths(draftYear)
      if (!list.some((month) => month.value === draftMonth)) {
        setDraftMonth(list[0]?.value ?? 1)
        return
      }
      const max = list.find((month) => month.value === draftMonth)?.days ?? 30
      if (draftDay > max) setDraftDay(max)
      return
    }
    const max = daysInMonth(draftYear, draftMonth)
    if (draftDay > max) setDraftDay(max)
  }, [draftCalendar, draftYear, draftMonth, draftDay])

  function openPicker() {
    const current = valueRef.current
    const mode = current?.calendar ?? 'solar'
    const parsed = current?.birth ?? defaultParts(mode)
    const hourName = current?.shichen || currentShichen()
    const hourIndex = SHICHEN.findIndex((item) => item.name === hourName)
    setDraftCalendar(mode)
    setDraftYear(parsed.year)
    setDraftMonth(parsed.month)
    setDraftDay(parsed.day)
    setDraftHour(hourIndex < 0 ? 0 : hourIndex)
    setInvalid(false)
    setOpen(true)
  }

  useImperativeHandle(ref, () => ({ open: openPicker }))

  function resolvedDraft(): BirthParts {
    let month = draftMonth
    let day = draftDay
    if (draftCalendar === 'lunar') {
      const list = lunarMonths(draftYear)
      if (!list.some((item) => item.value === month)) month = list[0]?.value ?? 1
      const max = list.find((item) => item.value === month)?.days ?? 30
      day = Math.min(day, max)
    } else {
      day = Math.min(day, daysInMonth(draftYear, month))
    }
    return { year: draftYear, month, day }
  }

  function confirmBirth() {
    const nextBirth = resolvedDraft()
    const nextShichen = SHICHEN[draftHour]?.name ?? ''
    if (!nextShichen || toTimestamp(draftCalendar, nextBirth, nextShichen) == null) {
      setInvalid(true)
      return
    }
    onChange({ calendar: draftCalendar, birth: nextBirth, shichen: nextShichen })
    setInvalid(false)
    setOpen(false)
  }

  function switchDraftCalendar(next: CalendarMode) {
    if (next === draftCalendar) return
    const current = { year: draftYear, month: draftMonth, day: draftDay }
    const converted = draftCalendar === 'solar' ? solarToLunar(current) : lunarToSolar(current)
    const parts = converted ?? defaultParts(next)
    setDraftCalendar(next)
    setDraftYear(parts.year)
    setDraftMonth(parts.month)
    setDraftDay(parts.day)
    setInvalid(false)
  }

  const birthEcho = value
    ? `${value.calendar === 'solar' ? '公历' : ''}${formatDateLabel(value.calendar, value.birth)} ${shichenLabel(value.shichen)}`
    : ''
  const draftHourItem = SHICHEN[draftHour]
  const draftEcho =
    `${draftCalendar === 'solar' ? '公历' : ''}${formatDateLabel(draftCalendar, resolvedDraft())} ${draftHourItem ? `${draftHourItem.name} ${draftHourItem.range}` : ''}`.trim()

  return (
    <Style>
      <button
        type="button"
        id={id}
        className={`picker-trigger${birthEcho ? '' : ' is-empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.bazi}
        onClick={openPicker}
      >
        {birthEcho || t.baziPh}
      </button>
      <PickerShell
        open={open}
        title={t.chooseBirth}
        titleId={titleId}
        closeLabel={t.closeBirth}
        isMobile={isMobile}
        onClose={() => setOpen(false)}
        footer={
          <div className="picker-actions">
            <button type="button" className="picker-cancel" onClick={() => setOpen(false)}>
              {t.cancel}
            </button>
            <button type="button" className="picker-confirm" onClick={confirmBirth}>
              {t.confirm}
            </button>
          </div>
        }
      >
        <div className="calendar-toggle sheet-calendar" role="radiogroup" aria-label={t.calendar}>
          <button
            type="button"
            role="radio"
            aria-checked={draftCalendar === 'lunar'}
            className={draftCalendar === 'lunar' ? 'is-active' : undefined}
            onClick={() => switchDraftCalendar('lunar')}
          >
            {t.lunar}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={draftCalendar === 'solar'}
            className={draftCalendar === 'solar' ? 'is-active' : undefined}
            onClick={() => switchDraftCalendar('solar')}
          >
            {t.solar}
          </button>
        </div>
        <div className="date-wheel">
          <div className="date-wheel-mask" aria-hidden="true" />
          <div className="date-wheel-columns">
            <WheelColumn options={yearOptions} value={draftYear} onChange={setDraftYear} ariaLabel={t.year} />
            <WheelColumn options={monthOptions} value={draftMonth} onChange={setDraftMonth} ariaLabel={t.month} />
            <WheelColumn options={dayOptions} value={draftDay} onChange={setDraftDay} ariaLabel={t.day} />
            <WheelColumn options={hourOptions} value={draftHour} onChange={setDraftHour} ariaLabel={t.hour} />
          </div>
        </div>
        <p className="sheet-hour-range">{draftEcho}</p>
        {invalid ? <p className="sheet-error">{t.needBirth}</p> : null}
      </PickerShell>
    </Style>
  )
}

const Style = styled.div`
  width: 100%;

  @keyframes sheet-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes sheet-pop {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .calendar-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex: 0 0 auto;
    padding: 2px;
    border: 1px solid rgba(214, 186, 138, 0.45);
    border-radius: 999px;
    background: rgba(255, 248, 235, 0.03);
  }

  .calendar-toggle button {
    min-width: 56px;
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(232, 220, 198, 0.55);
    font: 13px/1 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    letter-spacing: 0.12em;
    cursor: pointer;
    touch-action: manipulation;
  }

  .calendar-toggle button.is-active {
    background: rgba(196, 148, 72, 0.2);
    color: #f6edd8;
  }

  .sheet-calendar {
    width: 168px;
    margin: 2px auto 12px;
  }

  .sheet-hour-range {
    margin: 12px 0 0;
    color: #f6edd8;
    font: 700 18px/1.45 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    letter-spacing: 0.06em;
    text-align: center;
  }

  .sheet-error {
    margin: 10px 0 0;
    color: #d4786a;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-align: center;
  }

  .picker-trigger {
    width: 100%;
    min-height: 48px;
    padding: 6px 36px 6px 14px;
    border: 1px solid rgba(214, 186, 138, 0.45);
    border-radius: 10px;
    background-color: rgba(255, 248, 235, 0.03);
    background-image:
      linear-gradient(45deg, transparent 50%, #c4a36a 50%),
      linear-gradient(135deg, #c4a36a 50%, transparent 50%);
    background-position:
      calc(100% - 20px) 52%,
      calc(100% - 14px) 52%;
    background-size:
      6px 6px,
      6px 6px;
    background-repeat: no-repeat;
    color: #f6edd8;
    font: 16px/1.4 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    letter-spacing: 0.08em;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .picker-trigger.is-empty {
    color: rgba(232, 220, 198, 0.38);
  }

  .picker-trigger:focus {
    outline: 1px solid #e0c48a;
    outline-offset: 2px;
  }

  .sheet-root {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .sheet-root.is-center {
    justify-content: center;
    align-items: center;
    padding: 24px;
  }

  .sheet-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: rgba(11, 10, 9, 0.62);
    cursor: pointer;
  }

  .sheet-panel {
    position: relative;
    z-index: 1;
    width: 100%;
    max-height: min(78vh, 620px);
    padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(214, 186, 138, 0.35);
    border-radius: 18px 18px 0 0;
    background: #141210;
    animation: sheet-up 0.28s ease-out;
  }

  .sheet-root.is-center .sheet-panel {
    width: min(100%, 480px);
    max-height: min(80vh, 640px);
    padding: 22px 20px 18px;
    border: 1px solid rgba(214, 186, 138, 0.35);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
    animation: sheet-pop 0.22s ease-out;
    overflow: auto;
  }

  .sheet-handle {
    width: 36px;
    height: 3px;
    margin: 0 auto 14px;
    border-radius: 999px;
    background: rgba(214, 186, 138, 0.35);
  }

  .sheet-title {
    margin: 0 0 12px;
    color: #c4a36a;
    font-size: 14px;
    letter-spacing: 0.36em;
    text-align: center;
    padding-left: 0.36em;
  }

  .picker-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }

  .picker-cancel,
  .picker-confirm {
    width: 100%;
    min-height: 48px;
    border: 1px solid rgba(214, 186, 138, 0.35);
    border-radius: 12px;
    background: transparent;
    color: rgba(232, 220, 198, 0.78);
    font: 16px/1 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    letter-spacing: 0.36em;
    cursor: pointer;
    touch-action: manipulation;
  }

  .picker-confirm {
    border-color: #d4ae62;
    color: #f6edd8;
    background: rgba(196, 148, 72, 0.14);
  }

  .date-wheel {
    position: relative;
    height: 220px;
    margin: 4px 0 2px;
    border: 1px solid rgba(214, 186, 138, 0.22);
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 248, 235, 0.02);
  }

  .date-wheel::before,
  .date-wheel::after {
    content: '';
    position: absolute;
    z-index: 3;
    left: 0;
    right: 0;
    height: 88px;
    pointer-events: none;
  }

  .date-wheel::before {
    top: 0;
    background: linear-gradient(180deg, #141210 18%, rgba(20, 18, 16, 0));
  }

  .date-wheel::after {
    bottom: 0;
    background: linear-gradient(0deg, #141210 18%, rgba(20, 18, 16, 0));
  }

  .date-wheel-mask {
    position: absolute;
    z-index: 1;
    left: 8px;
    right: 8px;
    top: 50%;
    height: 44px;
    margin-top: -22px;
    border-radius: 8px;
    background: rgba(196, 148, 72, 0.12);
    border: 1px solid rgba(214, 186, 138, 0.22);
    pointer-events: none;
  }

  .date-wheel-columns {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1.05fr 0.9fr 0.8fr 1.45fr;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .wheel-column {
    position: relative;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    touch-action: none;
    cursor: ns-resize;
    user-select: none;
  }

  .wheel-column + .wheel-column {
    border-left: 1px solid rgba(214, 186, 138, 0.12);
  }

  .wheel-scroller {
    will-change: transform;
  }

  .wheel-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: rgba(232, 220, 198, 0.38);
    font: 16px/1.15 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    user-select: none;
    pointer-events: none;
    text-align: center;
    padding: 0 4px;
  }

  .wheel-item.is-active {
    color: #f3e6c8;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet-panel {
      animation: none;
    }
  }
`
