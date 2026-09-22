import styled from 'styled-components'

export default function Footer() {
  return (
    <Wrap>
      <p>铭影视 · 多源聚合影音</p>
      <p className="sub">内容来自公开采集接口，仅供学习交流</p>
    </Wrap>
  )
}

const Wrap = styled.footer`
  margin-top: 64px;
  padding: 36px 20px 48px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  text-align: center;
  color: rgba(245, 242, 234, 0.45);
  font-size: 13px;

  .sub {
    margin-top: 6px;
    font-size: 12px;
    opacity: 0.7;
  }
`
