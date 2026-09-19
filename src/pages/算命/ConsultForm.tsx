import { useEffect, useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { saveReport } from './ReportPage'

const SHICHEN = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时']
const MOBILE_QUERY = '(max-width: 900px)'

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

export default function ConsultForm() {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [shichen, setShichen] = useState('')
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const sheetTitleId = useId()

  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [sheetOpen])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!shichen) {
      setError('请选择时辰')
      if (isMobile) setSheetOpen(true)
      return
    }
    setPending(true)
    setError('')

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
        setError(message || '提交失败')
        setPending(false)
        return
      }
      const [year, month, day] = birthDate.split('-').map(Number)
      const payload = {
        name: name.trim(),
        bazi: `${year}年${month}月${day}日 ${shichen}`,
        question: question.trim(),
        report: message,
      }
      saveReport(payload)
      navigate('/算命/report', { state: payload })
    } catch {
      setError('网络异常，请稍后再试')
      setPending(false)
    }
  }

  function pickShichen(value: string) {
    setShichen(value)
    setSheetOpen(false)
  }

  return (
    <section className="consult" id="consult">
      <aside className="consult-aside">
        <div className="consult-ornament" aria-hidden="true">
          <span>☰</span>
          <span>☷</span>
          <span>☵</span>
          <span>☲</span>
        </div>
        <p className="consult-kicker">极数知来</p>
        <p className="consult-quote">仰以观于天文，俯以察于地理。</p>
        <div className="consult-rule" />
        <p className="consult-aside-note">生辰既定，吉凶自现</p>
        <p className="consult-aside-author">作者：刘铭</p>
      </aside>

      <form className="consult-form" onSubmit={onSubmit}>
        <p className="eyebrow">问卜</p>
        <h2>填写生辰</h2>

        <label htmlFor="name">姓名</label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          enterKeyHint="next"
          maxLength={20}
          placeholder="请输入姓名"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="birth-date">八字</label>
        <div className="bazi-row">
          <input
            id="birth-date"
            name="birthDate"
            type="date"
            autoComplete="bday"
            aria-label="年月日"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            required
          />
          {isMobile ? (
            <>
              <input type="hidden" name="shichen" value={shichen} />
              <button
                type="button"
                id="shichen"
                className={`shichen-trigger${shichen ? '' : ' is-empty'}`}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                aria-label="时辰"
                onClick={() => setSheetOpen(true)}
              >
                {shichen || '时辰'}
              </button>
            </>
          ) : (
            <select
              id="shichen"
              name="shichen"
              aria-label="时辰"
              value={shichen}
              onChange={(event) => setShichen(event.target.value)}
              required
            >
              <option value="">时辰</option>
              {SHICHEN.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          )}
        </div>

        <label htmlFor="question">咨询问题</label>
        <textarea
          id="question"
          name="question"
          enterKeyHint="done"
          maxLength={300}
          placeholder="请写下想问的事"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          required
        />

        <button type="submit" className="submit-btn" disabled={pending}>
          生成报告
        </button>

        {error ? <p className="feedback error">{error}</p> : null}
      </form>

      {sheetOpen
        ? createPortal(
            <div
              className="sheet-root"
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
            >
              <button
                type="button"
                className="sheet-backdrop"
                aria-label="关闭时辰选择"
                onClick={() => setSheetOpen(false)}
              />
              <div className="sheet-panel">
                <div className="sheet-handle" aria-hidden="true" />
                <p className="sheet-title" id={sheetTitleId}>
                  选择时辰
                </p>
                <ul className="sheet-list">
                  {SHICHEN.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className={item === shichen ? 'is-active' : undefined}
                        onClick={() => pickShichen(item)}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="sheet-cancel" onClick={() => setSheetOpen(false)}>
                  取消
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {pending
        ? createPortal(
            <div className="loading" role="status" aria-live="polite">
              <div className="loading-mark" aria-hidden="true" />
              <p>加载中</p>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
