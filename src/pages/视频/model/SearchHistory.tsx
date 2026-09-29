import type { MouseEvent } from 'react'
import styled from 'styled-components'

type Props = {
  items: string[]
  onPick: (keyword: string) => void
  onDelete: (keyword: string) => void
  onClear: () => void
}

export default function SearchHistory({ items, onPick, onDelete, onClear }: Props) {
  if (!items.length) return null

  function handleDelete(e: MouseEvent, keyword: string) {
    e.preventDefault()
    e.stopPropagation()
    onDelete(keyword)
  }

  return (
    <Wrap>
      <div className="head">
        <span>搜索历史</span>
        <button type="button" className="clear" onClick={onClear}>
          清空
        </button>
      </div>
      <ul className="list">
        {items.map((keyword) => (
          <li key={keyword}>
            <button type="button" className="chip" onClick={() => onPick(keyword)}>
              {keyword}
            </button>
            <button
              type="button"
              className="del"
              aria-label={`删除 ${keyword}`}
              onClick={(e) => handleDelete(e, keyword)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </Wrap>
  )
}

const Wrap = styled.div`
  width: 100%;

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    span {
      font-size: 13px;
      color: rgba(245, 242, 234, 0.55);
      letter-spacing: 0.04em;
    }

    .clear {
      border: 0;
      background: transparent;
      color: rgba(245, 242, 234, 0.42);
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      transition: color 0.2s;

      &:hover {
        color: #e07070;
      }
    }
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  li {
    position: relative;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
  }

  .chip {
    max-width: 220px;
    height: 32px;
    padding: 0 28px 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(245, 242, 234, 0.82);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition:
      border-color 0.2s,
      background 0.2s,
      color 0.2s;

    &:hover {
      border-color: rgba(232, 165, 75, 0.45);
      background: rgba(232, 165, 75, 0.1);
      color: #f5f2ea;
    }
  }

  .del {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: rgba(245, 242, 234, 0.4);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;

    &:hover {
      color: #e07070;
      background: rgba(224, 112, 112, 0.12);
    }
  }
`
