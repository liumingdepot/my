import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import styled from 'styled-components'
import { api, imgUrl } from '../utils/server'
import { hist, type HistItem } from '../utils/history'
import { Empty, GhostBtn, SecHead } from './shared'

const HistoryPage = () => {
  const nav = useNavigate()
  const [list, setList] = useState<HistItem[]>(() => hist.all())
  const healed = useState(() => new Set<string>())[0]

  const refresh = () => setList(hist.all())

  useEffect(() => {
    list
      .filter((x) => !x.title || !x.cover)
      .slice(0, 8)
      .forEach((x) => {
        if (healed.has(x.sid)) return
        healed.add(x.sid)
        api
          .episodes(x.sid)
          .then((d) => {
            const m = d.meta || {}
            if (!m.title && !m.cover) return
            hist.updateMeta(x.sid, {
              title: x.title || m.title,
              cover: x.cover || m.cover,
            })
            refresh()
          })
          .catch(() => {})
      })
  }, [list, healed])

  const clearAll = () => {
    if (!confirm('确定清空全部观看历史？收藏不受影响。')) return
    hist.clear()
    refresh()
  }

  return (
    <Style>
      <SecHead>
        <h2>观看历史</h2>
        <div className="acts">
          {list.length ? (
            <GhostBtn type="button" onClick={clearAll}>
              清空列表
            </GhostBtn>
          ) : null}
        </div>
      </SecHead>
      {list.length ? (
        list.map((x) => (
          <div key={x.sid} className="hrow" onClick={() => nav(`/test/watch/${x.sid}/${x.ep}`)}>
            <img
              className="hthumb"
              src={imgUrl(x.cover)}
              alt=""
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.visibility = 'hidden'
              }}
            />
            <div className="hinfo2">
              <div className="t">{x.title || '未知剧名'}</div>
              <div className="m">
                看到 第{x.ep}集{x.epCnt ? ` / 共${x.epCnt}集` : ''} ·{' '}
                {new Date(x.ts).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="hbar">
                <i style={{ width: `${Math.min(100, ((x.pos || 0) / (x.dur || 1)) * 100).toFixed(1)}%` }} />
              </div>
            </div>
            <div className="hacts">
              <GhostBtn
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  nav(`/test/watch/${x.sid}/${x.ep}`)
                }}
              >
                继续播放
              </GhostBtn>
              <GhostBtn
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  hist.remove(x.sid)
                  refresh()
                }}
              >
                删除
              </GhostBtn>
            </div>
          </div>
        ))
      ) : (
        <Empty>暂无观看记录</Empty>
      )}
    </Style>
  )
}

export default HistoryPage

const Style = styled.div`
  .hrow {
    display: flex;
    gap: 14px;
    background: #fff;
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 12px;
    align-items: center;
    cursor: pointer;
  }
  .hrow:hover {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  }
  .hthumb {
    width: 86px;
    aspect-ratio: 7/10;
    border-radius: 8px;
    object-fit: cover;
    flex: none;
    background: #e8e9ee;
  }
  .hinfo2 {
    flex: 1;
    min-width: 0;
  }
  .hinfo2 .t {
    font-size: 15px;
    font-weight: 600;
  }
  .hinfo2 .m {
    font-size: 12.5px;
    color: var(--txt2);
    margin-top: 5px;
  }
  .hbar {
    margin-top: 9px;
    height: 4px;
    background: #eef0f3;
    border-radius: 2px;
    max-width: 320px;
  }
  .hbar i {
    display: block;
    height: 100%;
    background: var(--pink);
    border-radius: 2px;
  }
  .hacts {
    display: flex;
    gap: 8px;
    flex: none;
  }

  @media (max-width: 720px) {
    .hacts {
      flex-direction: column;
    }
  }
`
