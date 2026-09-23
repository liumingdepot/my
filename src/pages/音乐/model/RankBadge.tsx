import styled from 'styled-components'

export function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <Medal data-rank={rank}>{rank}</Medal>
  }
  return <Plain>{rank}</Plain>
}

const Medal = styled.span`
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);

  &[data-rank='1'] {
    background: var(--grad-btn);
  }
  &[data-rank='2'] {
    background: linear-gradient(145deg, #c8d4e0, #8a9bb0);
    color: #fff;
  }
  &[data-rank='3'] {
    background: linear-gradient(145deg, #d4a574, #a66b3c);
  }
`

const Plain = styled.span`
  display: inline-grid;
  place-items: center;
  width: 26px;
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--muted);
`
