import styled from 'styled-components'

export const Loading = () => (
  <Loadbox>
    <div className="spin" />
    加载中…
  </Loadbox>
)

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <EmptyBox>
    <div className="big">🎬</div>
    {children}
  </EmptyBox>
)

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px 14px;
`

export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 4px 0 22px;

  .chip {
    padding: 5px 15px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid var(--line);
    font-size: 13px;
    color: #333;
    cursor: pointer;
    transition: 0.12s;
  }
  .chip:hover {
    border-color: var(--pink-border);
    color: var(--pink);
  }
  .chip.on {
    background: var(--pink-soft);
    color: var(--pink);
    border-color: var(--pink-border);
    font-weight: 600;
  }
`

export const SecHead = styled.div`
  display: flex;
  align-items: center;
  margin: 26px 0 16px;
  &:first-child {
    margin-top: 2px;
  }
  h2 {
    font-size: 20px;
    font-weight: 800;
    margin: 0;
  }
  .acts {
    margin-left: auto;
    display: flex;
    gap: 10px;
  }
`

export const GhostBtn = styled.button`
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  font-family: inherit;
  &:hover {
    border-color: var(--pink-border);
    color: var(--pink);
  }
`

export const Note = styled.div`
  font-size: 12.5px;
  color: #9298a5;
  line-height: 1.8;
`

const Loadbox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 0;
  color: var(--txt2);
  .spin {
    width: 22px;
    height: 22px;
    border: 3px solid #e5e6eb;
    border-top-color: var(--pink);
    border-radius: 50%;
    animation: test-rot 0.8s linear infinite;
  }
  @keyframes test-rot {
    to {
      transform: rotate(360deg);
    }
  }
`

const EmptyBox = styled.div`
  text-align: center;
  padding: 90px 0;
  color: #9298a5;
  .big {
    font-size: 44px;
    margin-bottom: 12px;
  }
`
