import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import '../admin.css'
import { ApiError, SEED_ACCOUNT, fetchMe, login } from '../auth'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState<string>(SEED_ACCOUNT.username)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '登录 · 后台管理'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f4f6f8')
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
    if (!username.trim() || !password) {
      setError('请填写用户名和密码')
      return
    }
    setPending(true)
    setError('')
    try {
      await login(username, password)
      navigate('/admin/users', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '用户名或密码错误')
    } finally {
      setPending(false)
    }
  }

  if (checking) {
    return (
      <div className="admin admin-login">
        <p className="admin-hint">加载中…</p>
      </div>
    )
  }

  if (authed) {
    return <Navigate to="/admin/users" replace />
  }

  return (
    <div className="admin admin-login">
      <div className="admin-login__card">
        <div className="admin-login__brand">
          <span className="admin-login__mark">管</span>
          <h1>后台管理</h1>
          <p>使用管理员账号进入控制台</p>
        </div>

        <form className="admin-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="admin-field">
            <label htmlFor="admin-username">用户名</label>
            <input
              id="admin-username"
              name="username"
              autoComplete="username"
              placeholder="请输入用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">密码</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="admin-error">{error}</p> : null}
          <button className="admin-btn admin-btn--primary" type="submit" disabled={pending}>
            {pending ? '登录中…' : '登录'}
          </button>
          <p className="admin-hint">
            初始账号 {SEED_ACCOUNT.username} / {SEED_ACCOUNT.password}
          </p>
        </form>

        <div className="admin-login__footer">
          <Link to="/">返回门户</Link>
        </div>
      </div>
    </div>
  )
}
