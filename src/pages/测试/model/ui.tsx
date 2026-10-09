import styled from 'styled-components'
import type { MacItem } from '../utils/server'
import DramaCard from './DramaCard'

export function Loading() {
  return (
    <Box className="loadbox">
      <div className="spin" />
      加载中…
    </Box>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Box className="empty">{children}</Box>
}

export function Grid({ items, ranked }: { items: MacItem[]; ranked?: boolean }) {
  if (!items.length) {
    return (
      <Empty>
        <div className="big">🎬</div>暂无内容
      </Empty>
    )
  }
  return (
    <GridWrap>
      {items.map((it, i) => (
        <DramaCard key={it.series_id || it.sid || i} item={it} rank={ranked ? i + 1 : null} />
      ))}
    </GridWrap>
  )
}

export const PageStyle = styled.div`
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 4px 0 22px;
  }
  .chip {
    padding: 5px 15px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #eceef1;
    font-size: 13px;
    color: #333;
    cursor: pointer;
    transition: 0.12s;
  }
  .chip:hover {
    border-color: #ffc9d8;
    color: #ff2e5f;
  }
  .chip.on {
    background: #ffe9f0;
    color: #ff2e5f;
    border-color: #ffc9d8;
    font-weight: 600;
  }
  .sechead {
    display: flex;
    align-items: center;
    margin: 26px 0 16px;
  }
  .sechead:first-child {
    margin-top: 2px;
  }
  .sechead h2 {
    font-size: 20px;
    font-weight: 800;
    margin: 0;
  }
  .sechead .acts {
    margin-left: auto;
    display: flex;
    gap: 10px;
  }
  .ghost {
    background: #fff;
    border: 1px solid #eceef1;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
  }
  .ghost:hover {
    border-color: #ffc9d8;
    color: #ff2e5f;
  }
  .note {
    font-size: 12.5px;
    color: #9298a5;
    line-height: 1.8;
  }
`

const Box = styled.div`
  &.loadbox {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 80px 0;
    color: #6b7080;
  }
  .spin {
    width: 22px;
    height: 22px;
    border: 3px solid #e5e6eb;
    border-top-color: #ff2e5f;
    border-radius: 50%;
    animation: rot 0.8s linear infinite;
  }
  @keyframes rot {
    to {
      transform: rotate(360deg);
    }
  }
  &.empty {
    text-align: center;
    padding: 90px 0;
    color: #9298a5;
  }
  .big {
    font-size: 44px;
    margin-bottom: 12px;
  }
`

const GridWrap = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px 14px;
`
