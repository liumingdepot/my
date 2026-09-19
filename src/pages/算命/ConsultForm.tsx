import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { formatBazi, formatDateLabel, SHICHEN, t } from './i18n'
import { saveReport } from './ReportPage'

const MOBILE_QUERY = '(max-width: 900px)'
const YEAR_START = 1920
const ITEM_HEIGHT = 44
const VISIBLE_ROWS = 5

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

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function parseBirthDate(value: string) {
  const now = new Date()
  if (!value) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    }
  }
  const [y, m, d] = value.split('-').map(Number)
  return {
    year: y || now.getFullYear(),
    month: m || now.getMonth() + 1,
    day: d || now.getDate(),
  }
}

function toBirthDate(year: number, month: number, day: number) {
  const maxDay = daysInMonth(year, month)
  const safeDay = Math.min(day, maxDay)
  return `${year}-${pad2(month)}-${pad2(safeDay)}`
}

function WheelColumn({
  options,
  value,
  onChange,
  unit,
  ariaLabel,
}: {
  options: number[]
  value: number
  onChange: (next: number) => void
  unit: string
  ariaLabel: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: number; y: number; offset: number } | null>(null)
  const offsetRef = useRef(0)
  const [active, setActive] = useState(value)
  const pad = Math.floor(VISIBLE_ROWS / 2)
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
    const next = optionsRef.current[index]
    applyOffset(index * ITEM_HEIGHT)
    setActive(next)
    if (next !== valueRef.current) onChangeRef.current(next)
  }

  useEffect(() => {
    if (dragRef.current) return
    const index = options.indexOf(value)
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
      const next = optionsRef.current[readIndex()]
      setActive((prev) => (prev === next ? prev : next))
      window.clearTimeout(timer)
      timer = window.setTimeout(commit, 80)
    }
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.id !== event.pointerId) return
      event.preventDefault()
      applyOffset(drag.offset - (event.clientY - drag.y))
      const next = optionsRef.current[readIndex()]
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
      aria-valuetext={`${active}${unit}`}
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
            key={option}
            className={`wheel-item${option === active ? ' is-active' : ''}`}
            style={{ height: ITEM_HEIGHT }}
          >
            {option}
            <span className="wheel-unit">{unit}</span>
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
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
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
    </div>,
    document.body,
  )
}

export default function ConsultForm() {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [shichen, setShichen] = useState('')
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<'' | 'date' | 'hour' | 'fail' | 'network'>('')
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const [picker, setPicker] = useState<'date' | 'hour' | null>(null)
  const [draftYear, setDraftYear] = useState(() => parseBirthDate('').year)
  const [draftMonth, setDraftMonth] = useState(() => parseBirthDate('').month)
  const [draftDay, setDraftDay] = useState(() => parseBirthDate('').day)
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const dateTitleId = useId()
  const hourTitleId = useId()

  const years = useMemo(() => {
    const end = new Date().getFullYear()
    return Array.from({ length: end - YEAR_START + 1 }, (_, i) => YEAR_START + i)
  }, [])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  const days = useMemo(() => {
    const count = daysInMonth(draftYear, draftMonth)
    return Array.from({ length: count }, (_, i) => i + 1)
  }, [draftYear, draftMonth])

  useEffect(() => {
    const max = daysInMonth(draftYear, draftMonth)
    if (draftDay > max) setDraftDay(max)
  }, [draftYear, draftMonth, draftDay])

  function openDatePicker() {
    const parsed = parseBirthDate(birthDate)
    setDraftYear(parsed.year)
    setDraftMonth(parsed.month)
    setDraftDay(parsed.day)
    setPicker('date')
  }

  function confirmDate() {
    setBirthDate(toBirthDate(draftYear, draftMonth, draftDay))
    setError((prev) => (prev === 'date' ? '' : prev))
    setPicker(null)
  }

  function pickShichen(value: string) {
    setShichen(value)
    setError((prev) => (prev === 'hour' ? '' : prev))
    setPicker(null)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!birthDate) {
      setServerError('')
      setError('date')
      openDatePicker()
      return
    }
    if (!shichen) {
      setServerError('')
      setError('hour')
      setPicker('hour')
      return
    }
    setPending(true)
    setError('')
    setServerError('')

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          birthDate,
          shichen,
          question: question.trim(),
        }),
      })
      const message = await response.text()
      if (!response.ok) {
        if (message) setServerError(message)
        else setError('fail')
        setPending(false)
        return
      }
      const payload = {
        name: name.trim(),
        bazi: formatBazi(birthDate, shichen),
        question: question.trim(),
        report: message,
      }
      saveReport(payload)
      navigate('/fortune/report', { state: payload })
    } catch {
      setError('network')
      setPending(false)
    }
  }

  const selectedShichen = SHICHEN.find((item) => item.name === shichen)
  const errorText =
    serverError ||
    (error === 'date'
      ? t.needDate
      : error === 'hour'
        ? t.needHour
        : error === 'network'
          ? t.network
          : error === 'fail'
            ? t.fail
            : '')

  return (
    <section className="consult" id="consult">
      <aside className="consult-aside">
        <div className="consult-ornament" aria-hidden="true">
          <span>☰</span>
          <span>☷</span>
          <span>☵</span>
          <span>☲</span>
        </div>
        <p className="consult-kicker">{t.kicker}</p>
        <p className="consult-quote">{t.quote}</p>
        <div className="consult-rule" />
        <p className="consult-aside-note">{t.note}</p>
        <p className="consult-aside-author">{t.author}</p>
      </aside>

      <form className="consult-form" onSubmit={onSubmit}>
        <p className="eyebrow">{t.formEyebrow}</p>
        <h2>{t.formTitle}</h2>

        <label htmlFor="name">{t.name}</label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          enterKeyHint="next"
          maxLength={20}
          placeholder={t.namePh}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="birth-date">{t.bazi}</label>
        <div className="bazi-row">
          <input type="hidden" name="birthDate" value={birthDate} />
          <input type="hidden" name="shichen" value={shichen} />
          <button
            type="button"
            id="birth-date"
            className={`picker-trigger${birthDate ? '' : ' is-empty'}`}
            aria-haspopup="dialog"
            aria-expanded={picker === 'date'}
            aria-label={t.date}
            onClick={openDatePicker}
          >
            {birthDate ? formatDateLabel(birthDate) : t.date}
          </button>
          <button
            type="button"
            id="shichen"
            className={`picker-trigger${shichen ? '' : ' is-empty'}`}
            aria-haspopup="dialog"
            aria-expanded={picker === 'hour'}
            aria-label={t.hour}
            onClick={() => setPicker('hour')}
          >
            {selectedShichen ? selectedShichen.name : t.hour}
          </button>
        </div>

        <label htmlFor="question">{t.question}</label>
        <textarea
          id="question"
          name="question"
          enterKeyHint="done"
          maxLength={300}
          placeholder={t.questionPh}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          required
        />

        <button type="submit" className="submit-btn" disabled={pending}>
          {t.submit}
        </button>

        {errorText ? <p className="feedback error">{errorText}</p> : null}
      </form>

      <PickerShell
        open={picker === 'date'}
        title={t.chooseDate}
        titleId={dateTitleId}
        closeLabel={t.closeDate}
        isMobile={isMobile}
        onClose={() => setPicker(null)}
        footer={
          <div className="picker-actions">
            <button type="button" className="picker-cancel" onClick={() => setPicker(null)}>
              {t.cancel}
            </button>
            <button type="button" className="picker-confirm" onClick={confirmDate}>
              {t.confirm}
            </button>
          </div>
        }
      >
        <div className="date-wheel">
          <div className="date-wheel-mask" aria-hidden="true" />
          <div className="date-wheel-columns">
            <WheelColumn
              options={years}
              value={draftYear}
              onChange={setDraftYear}
              unit={t.year}
              ariaLabel={t.year}
            />
            <WheelColumn
              options={months}
              value={draftMonth}
              onChange={setDraftMonth}
              unit={t.month}
              ariaLabel={t.month}
            />
            <WheelColumn
              options={days}
              value={draftDay}
              onChange={setDraftDay}
              unit={t.day}
              ariaLabel={t.day}
            />
          </div>
        </div>
      </PickerShell>

      <PickerShell
        open={picker === 'hour'}
        title={t.chooseHour}
        titleId={hourTitleId}
        closeLabel={t.closeHour}
        isMobile={isMobile}
        onClose={() => setPicker(null)}
        footer={
          <button type="button" className="picker-cancel" onClick={() => setPicker(null)}>
            {t.cancel}
          </button>
        }
      >
        <ul className="picker-list">
          {SHICHEN.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                className={item.name === shichen ? 'is-active' : undefined}
                onClick={() => pickShichen(item.name)}
              >
                <span className="picker-list-name">{item.name}</span>
                <span className="picker-list-range">（{item.range}）</span>
              </button>
            </li>
          ))}
        </ul>
      </PickerShell>

      {pending
        ? createPortal(
            <div className="loading" role="status" aria-live="polite">
              <div className="loading-mark" aria-hidden="true" />
              <p>{t.loading}</p>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
