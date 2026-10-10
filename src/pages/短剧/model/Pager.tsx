import styled from 'styled-components'

type Props = {
  page: number
  totalPages: number
  loading?: boolean
  onChange: (page: number) => void
}

export default function Pager({ page, totalPages, loading, onChange }: Props) {
  if (totalPages <= 1) return null

  const prevDisabled = page <= 1 || loading
  const nextDisabled = page >= totalPages || loading

  return (
    <Wrap>
      <button type="button" disabled={prevDisabled} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      <span className="info">
        {page} / {totalPages}
      </span>
      <button type="button" disabled={nextDisabled} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 36px 0 8px;

  button {
    min-width: 96px;
    height: 40px;
    padding: 0 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #e8f5ee;
    font-size: 14px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:hover:not(:disabled) {
      border-color: rgba(62, 186, 122, 0.55);
      color: #3eba7a;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .info {
    font-size: 13px;
    color: rgba(232, 245, 238, 0.5);
    font-variant-numeric: tabular-nums;
  }
`
