import { type FormEvent, useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import styled, { createGlobalStyle } from 'styled-components'
import { ApiError, fetchMe, login } from '../auth'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home', 'video-body')
    document.documentElement.classList.remove('video-html')
    document.title = '登录 · 后台管理'
    document.documentElement.dataset.theme = 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#e8f0ee')
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setAuthed(Boolean(me))
      } catch {
        if (!cancelled) setAuthed(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate('/admin/users', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '用户名或密码错误')
    } finally {
      setPending(false)
    }
  }

  if (checking) {
    return (
      <>
        <AdminGlobalStyle />
        <Style>
          <div className="admin admin-boot">加载中…</div>
        </Style>
      </>
    )
  }

  if (authed) {
    return <Navigate to="/admin/users" replace />
  }

  return (
    <>
      <AdminGlobalStyle />
      <Style>
        <div className="admin admin-login">
          <div className="backdrop" aria-hidden="true">
            <div className="wash wash-a" />
            <div className="wash wash-b" />
            <div className="grid" />
          </div>

          <form className="card" onSubmit={(event) => void onSubmit(event)}>
            <div className="brand">
              <span className="mark">管</span>
              <h1 className="title">后台管理</h1>
              <p className="desc">使用管理员账号进入控制台</p>
            </div>

            <label className="field">
              <span>用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="请输入用户名"
                required
              />
            </label>

            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
                required
              />
            </label>

            {error ? <div className="error">{error}</div> : null}

            <button className="submit" type="submit" disabled={pending}>
              {pending ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
      </Style>
    </>
  )
}

const AdminGlobalStyle = createGlobalStyle`
  html:has(.admin) {
    color-scheme: light !important;
    font-size: 16px !important;
  }

  body:has(.admin) {
    margin: 0 !important;
    background: #e8f0ee !important;
    color: #111827 !important;
    font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden !important;
  }
`

const Style = styled.div`
  min-height: 100dvh;
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #111827;

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .admin-boot {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    color: #6b7280;
    background: #e8f0ee;
  }

  .admin-login {
    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px;
    overflow: hidden;
    background: #e8f0ee;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  .wash {
    position: absolute;
    border-radius: 50%;
    filter: blur(72px);
    animation: float 14s ease-in-out infinite;
  }

  .wash-a {
    width: min(58vw, 480px);
    height: min(58vw, 480px);
    top: -18%;
    left: -10%;
    background: rgba(15, 118, 110, 0.22);
  }

  .wash-b {
    width: min(48vw, 400px);
    height: min(48vw, 400px);
    right: -12%;
    bottom: -16%;
    background: rgba(180, 140, 60, 0.16);
    animation-delay: -5s;
  }

  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(15, 118, 110, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15, 118, 110, 0.06) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse 65% 55% at 50% 42%, #000 15%, transparent 72%);
  }

  .card {
    position: relative;
    z-index: 1;
    width: min(100%, 400px);
    padding: 36px 32px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-radius: 18px;
    border: 1px solid rgba(15, 118, 110, 0.12);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(12px);
    box-shadow: 0 18px 40px rgba(15, 50, 45, 0.08);
    animation: rise 0.5s ease-out both;
  }

  .brand {
    text-align: center;
    margin-bottom: 8px;
  }

  .mark {
    width: 52px;
    height: 52px;
    margin: 0 auto 14px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f766e;
    color: #fff;
    font-weight: 700;
    font-size: 18px;
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.25;
    color: #0f172a;
  }

  .desc {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
  }

  .field input {
    height: 44px;
    padding: 0 14px;
    border: 1px solid #d7e0e6;
    border-radius: 12px;
    font-size: 14px;
    color: #0f172a;
    background: #f7faf9;
    outline: none;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      background 0.18s ease;
  }

  .field input::placeholder {
    color: #94a3b8;
  }

  .field input:hover {
    border-color: #b8c9c4;
    background: #fff;
  }

  .field input:focus {
    border-color: #0f766e;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
  }

  .error {
    padding: 10px 12px;
    border-radius: 10px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 13px;
    border: 1px solid #fecaca;
  }

  .submit {
    margin-top: 4px;
    height: 46px;
    border: 0;
    border-radius: 12px;
    background: #0f766e;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.15s ease;
  }

  .submit:hover:not(:disabled) {
    background: #0d9488;
    transform: translateY(-1px);
  }

  .submit:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(0, 0);
    }
    50% {
      transform: translate(10px, -14px);
    }
  }

  @media (max-width: 480px) {
    .card {
      padding: 28px 20px 24px;
      border-radius: 16px;
    }

    .title {
      font-size: 22px;
    }
  }
`
