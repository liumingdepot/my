import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { api } from '../utils/server'
import { GhostBtn, Note } from './shared'

const SettingsPage = () => {
  const [apiOk, setApiOk] = useState<'checking' | 'ok' | 'fail'>('checking')
  const [note, setNote] = useState('')

  const check = () => {
    setApiOk('checking')
    api
      .stats()
      .then((d) => {
        setApiOk('ok')
        setNote(d.note || '')
      })
      .catch(() => setApiOk('fail'))
  }

  useEffect(() => {
    check()
  }, [])

  return (
    <Style>
      <div className="setbox">
        <h3>播放服务</h3>
        <div className="kv">
          <span className="k">后端 API (/api/test)</span>
          <span className={apiOk === 'ok' ? 'oktag' : ''} style={apiOk === 'fail' ? { color: '#e0304e' } : undefined}>
            {apiOk === 'checking' ? '检查中…' : apiOk === 'ok' ? '已连接' : '未连接'}
          </span>
        </div>
        <div className="kv">
          <span className="k">取流方式</span>
          <span className="oktag">站源 Referer 代理</span>
        </div>
        {note ? <Note style={{ marginTop: 8 }}>{note}</Note> : null}
        <div style={{ marginTop: 10 }}>
          <GhostBtn type="button" onClick={check}>
            重新检查
          </GhostBtn>
        </div>
      </div>
      <div className="setbox">
        <h3>关于</h3>
        <Note>
          测试短剧模块（对齐 hongguo-mac 界面与接口契约，非官方，仅供个人学习研究）。
          <br />
          观看进度 / 收藏保存在本机浏览器存储，不与手机账号同步。
          <br />
          请勿用于商业用途或公开分发。
        </Note>
      </div>
    </Style>
  )
}

export default SettingsPage

const Style = styled.div`
  .setbox {
    background: #fff;
    border-radius: 14px;
    padding: 22px 26px;
    margin-bottom: 16px;
  }
  .setbox h3 {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 14px;
  }
  .kv {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    font-size: 13.5px;
  }
  .kv .k {
    color: var(--txt2);
  }
  .oktag {
    color: #0aa870;
    font-weight: 600;
  }
`
