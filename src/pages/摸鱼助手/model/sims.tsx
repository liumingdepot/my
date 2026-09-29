import { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'

/** Windows 10 风格蓝屏 */
export function WinBsod() {
  return (
    <Bsod>
      <div className="face" aria-hidden="true">
        :(
      </div>
      <p className="lead">你的设备遇到问题，需要重启。</p>
      <p className="sub">我们只收集某些错误信息，然后为你重新启动。</p>
      <p className="pct">完成 0%</p>
      <div className="qr" aria-hidden="true" />
      <p className="code">
        有关此问题的详细信息，你可以稍后在线搜索此错误：
        <br />
        CRITICAL_PROCESS_DIED
      </p>
    </Bsod>
  )
}

/** 自动修复 */
export function WinRepair() {
  return (
    <Repair>
      <div className="spinner" aria-hidden="true" />
      <p className="title">正在诊断你的 PC</p>
      <p className="sub">自动修复正在尝试修复你的设备</p>
      <p className="note">请勿关闭计算机</p>
    </Repair>
  )
}

/** CHKDSK 命令行扫描 */
export function WinChkdsk() {
  const [stage, setStage] = useState(0)
  const lines = [
    'Checking file system on C:',
    'The type of the file system is NTFS.',
    '',
    'Volume label is Windows.',
    '',
    'CHKDSK is verifying files (stage 1 of 3)...',
    `  ${Math.min(100, stage * 8)} percent complete.`,
    '',
    'CHKDSK is verifying indexes (stage 2 of 3)...',
    `  ${Math.min(100, Math.max(0, stage * 8 - 40))} percent complete.`,
    '',
    'CHKDSK is verifying security descriptors (stage 3 of 3)...',
    `  ${Math.min(100, Math.max(0, stage * 8 - 70))} percent complete.`,
  ]

  useEffect(() => {
    const t = window.setInterval(() => {
      setStage((s) => (s >= 14 ? 0 : s + 1))
    }, 900)
    return () => window.clearInterval(t)
  }, [])

  return (
    <Console>
      <pre>{lines.join('\n')}</pre>
      <span className="cursor" aria-hidden="true">
        _
      </span>
    </Console>
  )
}

/** 系统还原 */
export function WinRestore() {
  const [pct, setPct] = useState(12)

  useEffect(() => {
    const t = window.setInterval(() => {
      setPct((p) => (p >= 96 ? 18 : p + 1))
    }, 700)
    return () => window.clearInterval(t)
  }, [])

  return (
    <Restore>
      <div className="logo" aria-hidden="true">
        ⊞
      </div>
      <p className="title">正在还原 Windows</p>
      <p className="sub">请勿关闭计算机</p>
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="pct">{pct}%</p>
    </Restore>
  )
}

/** 无信号黑屏 */
export function WinNoSignal() {
  return (
    <NoSignal>
      <p className="label">No Signal</p>
      <p className="hint">Check cable connection</p>
    </NoSignal>
  )
}

/** Windows 10 更新 */
export function Win10Update() {
  const [pct, setPct] = useState(23)

  useEffect(() => {
    const t = window.setInterval(() => {
      setPct((p) => (p >= 97 ? 21 : p + 1))
    }, 1100)
    return () => window.clearInterval(t)
  }, [])

  return (
    <WinUpdate>
      <div className="ring" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="title">正在进行更新 {pct}%</p>
      <p className="sub">请保持电脑开机并插着电源</p>
      <p className="foot">你的电脑可能会重启几次</p>
    </WinUpdate>
  )
}

/** Windows 11 更新 */
export function Win11Update() {
  const [pct, setPct] = useState(18)

  useEffect(() => {
    const t = window.setInterval(() => {
      setPct((p) => (p >= 94 ? 16 : p + 1))
    }, 1200)
    return () => window.clearInterval(t)
  }, [])

  return (
    <Win11>
      <div className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="title">Working on updates</p>
      <p className="pct">{pct}% complete</p>
      <p className="sub">Don&apos;t turn off your PC</p>
      <p className="foot">This might take a while</p>
    </Win11>
  )
}

/** 卡在 99% */
export function WinStuck() {
  return (
    <WinUpdate>
      <div className="ring" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="title">正在进行更新 99%</p>
      <p className="sub">请保持电脑开机并插着电源</p>
      <p className="foot">你的电脑可能会重启几次</p>
    </WinUpdate>
  )
}

/** macOS 更新 */
export function MacUpdate() {
  const [pct, setPct] = useState(0.28)
  const remain = Math.max(1, Math.round((1 - pct) * 28))

  useEffect(() => {
    const t = window.setInterval(() => {
      setPct((p) => (p >= 0.92 ? 0.22 : +(p + 0.01).toFixed(2)))
    }, 1400)
    return () => window.clearInterval(t)
  }, [])

  return (
    <Mac>
      <svg className="apple" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 15 2.94 10.53 4.7 7.5c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
        />
      </svg>
      <div className="track">
        <div className="fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="time">还剩约 {remain} 分钟</p>
    </Mac>
  )
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const pulseDot = keyframes`
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
`

const orbit = keyframes`
  to { transform: rotate(360deg); }
`

const Bsod = styled.div`
  height: 100%;
  padding: min(12vh, 96px) min(8vw, 72px);
  background: #0078d7;
  color: #fff;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;

  .face {
    font-size: clamp(64px, 12vw, 120px);
    line-height: 1;
    margin-bottom: 24px;
  }

  .lead {
    margin: 0 0 16px;
    font-size: clamp(1.2rem, 2.4vw, 1.7rem);
    font-weight: 400;
    max-width: 18em;
  }

  .sub,
  .pct,
  .code {
    margin: 0 0 12px;
    font-size: clamp(0.95rem, 1.6vw, 1.15rem);
    opacity: 0.95;
  }

  .pct {
    margin-top: 28px;
  }

  .qr {
    width: 84px;
    height: 84px;
    margin: 28px 0 16px;
    background:
      linear-gradient(#fff 0 0) 0 0 / 20% 20%,
      linear-gradient(#fff 0 0) 100% 0 / 20% 20%,
      linear-gradient(#fff 0 0) 0 100% / 20% 20%,
      linear-gradient(#fff 0 0) 100% 100% / 20% 20%,
      repeating-conic-gradient(#fff 0 25%, #0078d7 0 50%) 50% / 25% 25%;
    background-repeat: no-repeat;
    border: 4px solid #fff;
  }

  .code {
    max-width: 28em;
    line-height: 1.55;
    font-size: 0.95rem;
  }
`

const Repair = styled.div`
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 18px;
  background: #0067c0;
  color: #fff;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  text-align: center;

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ${spin} 0.9s linear infinite;
  }

  .title {
    margin: 8px 0 0;
    font-size: 1.35rem;
  }

  .sub,
  .note {
    margin: 0;
    opacity: 0.85;
    font-size: 0.95rem;
  }
`

const Console = styled.div`
  height: 100%;
  padding: 28px 32px;
  background: #000;
  color: #cfcfcf;
  font-family: Consolas, 'Courier New', monospace;
  font-size: clamp(13px, 1.6vw, 16px);
  line-height: 1.45;

  pre {
    margin: 0;
    white-space: pre-wrap;
    display: inline;
  }

  .cursor {
    animation: ${pulseDot} 1s step-end infinite;
  }
`

const Restore = styled.div`
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  background: #1a1a1a;
  color: #eee;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  text-align: center;

  .logo {
    font-size: 42px;
    margin-bottom: 8px;
    opacity: 0.9;
  }

  .title {
    margin: 0;
    font-size: 1.25rem;
  }

  .sub,
  .pct {
    margin: 0;
    color: #aaa;
    font-size: 0.92rem;
  }

  .bar {
    width: min(280px, 60vw);
    height: 4px;
    margin-top: 18px;
    background: #333;
    border-radius: 2px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: #3a9bdc;
    transition: width 0.4s ease;
  }
`

const NoSignal = styled.div`
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  background: #000;
  color: #666;
  font-family: Arial, Helvetica, sans-serif;

  .label {
    margin: 0;
    font-size: clamp(1.6rem, 4vw, 2.4rem);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .hint {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.7;
  }
`

const WinUpdate = styled.div`
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  background: #005a9e;
  color: #fff;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  text-align: center;

  .ring {
    position: relative;
    width: 56px;
    height: 56px;
    margin-bottom: 12px;
    animation: ${orbit} 1.2s linear infinite;
  }

  .ring span {
    position: absolute;
    top: 0;
    left: 50%;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background: #fff;
    transform-origin: 50% 28px;
  }

  .ring span:nth-child(1) {
    transform: rotate(0deg);
    opacity: 1;
  }
  .ring span:nth-child(2) {
    transform: rotate(72deg);
    opacity: 0.8;
  }
  .ring span:nth-child(3) {
    transform: rotate(144deg);
    opacity: 0.6;
  }
  .ring span:nth-child(4) {
    transform: rotate(216deg);
    opacity: 0.4;
  }
  .ring span:nth-child(5) {
    transform: rotate(288deg);
    opacity: 0.25;
  }

  .title {
    margin: 0;
    font-size: 1.2rem;
  }

  .sub,
  .foot {
    margin: 0;
    font-size: 0.95rem;
    opacity: 0.9;
  }

  .foot {
    margin-top: 24px;
    opacity: 0.75;
  }
`

const Win11 = styled.div`
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  background: #000;
  color: #fff;
  font-family: 'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei', sans-serif;
  text-align: center;

  .dots {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
  }

  .dots i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    animation: ${pulseDot} 1.2s ease-in-out infinite;
  }

  .dots i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .dots i:nth-child(3) {
    animation-delay: 0.3s;
  }
  .dots i:nth-child(4) {
    animation-delay: 0.45s;
  }
  .dots i:nth-child(5) {
    animation-delay: 0.6s;
  }

  .title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 400;
  }

  .pct,
  .sub,
  .foot {
    margin: 0;
    font-size: 0.95rem;
    color: #c8c8c8;
  }

  .foot {
    margin-top: 28px;
    color: #888;
  }
`

const Mac = styled.div`
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 28px;
  background: #000;
  color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif;

  .apple {
    width: 72px;
    height: 72px;
  }

  .track {
    width: min(220px, 55vw);
    height: 4px;
    border-radius: 2px;
    background: #2c2c2e;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: #f5f5f7;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .time {
    margin: 0;
    font-size: 0.92rem;
    color: #a1a1a6;
  }
`
