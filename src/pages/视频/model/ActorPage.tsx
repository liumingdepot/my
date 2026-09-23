import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import styled from 'styled-components'

const HOT_ACTORS = [
  '梁朝伟',
  '周星驰',
  '刘德华',
  '张曼玉',
  '周迅',
  '巩俐',
  '汤唯',
  '彭于晏',
  '赵丽颖',
  '易烊千玺',
  '迪丽热巴',
  '肖战',
  'Tom Cruise',
  'Leonardo DiCaprio',
  'Scarlett Johansson',
  'Robert Downey Jr.',
]

export default function ActorPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const q = name.trim()
    if (!q) return
    navigate(`/video/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <Page>
      <div className="panel">
        <h1>演员</h1>
        <p className="lead">输入演员名，检索相关作品</p>

        <form onSubmit={onSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：梁朝伟"
            aria-label="演员名"
          />
          <button type="submit">搜索作品</button>
        </form>

        <h2>热门演员</h2>
        <div className="tags">
          {HOT_ACTORS.map((actor) => (
            <Link key={actor} to={`/video/search?q=${encodeURIComponent(actor)}`}>
              {actor}
            </Link>
          ))}
        </div>
      </div>
    </Page>
  )
}

const Page = styled.div`
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  box-sizing: border-box;

  .panel {
    width: min(720px, 100%);
    max-height: 100%;
    overflow: hidden;
  }

  h1 {
    margin: 0;
    font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
    font-size: clamp(24px, 4vw, 30px);
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .lead {
    margin: 8px 0 20px;
    font-size: 14px;
    color: rgba(245, 242, 234, 0.5);
  }

  form {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;

    input {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 44px;
      height: 44px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.04);
      color: #f5f2ea;
      font-size: 16px; /* iOS 避免聚焦自动放大 */
      line-height: 44px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      -webkit-tap-highlight-color: transparent;

      &:focus {
        border-color: rgba(232, 165, 75, 0.55);
      }

      &::placeholder {
        color: rgba(245, 242, 234, 0.3);
      }
    }

    button {
      flex: 0 0 auto;
      min-height: 44px;
      height: 44px;
      padding: 0 18px;
      border: 0;
      border-radius: 10px;
      background: #e8a54b;
      color: #0a0a0c;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
  }

  h2 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: rgba(245, 242, 234, 0.7);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    a {
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.03);
      color: rgba(245, 242, 234, 0.8);
      text-decoration: none;
      font-size: 13px;
      -webkit-tap-highlight-color: transparent;
      transition: border-color 0.2s, color 0.2s, background 0.2s;

      @media (hover: hover) {
        &:hover {
          border-color: rgba(232, 165, 75, 0.5);
          color: #e8a54b;
          background: rgba(232, 165, 75, 0.08);
        }
      }
    }
  }

  @media (max-width: 900px) {
    padding: 12px 14px;
  }

  @media (max-width: 560px) {
    form {
      flex-direction: column;
      margin-bottom: 18px;

      input {
        flex: none;
        width: 100%;
        min-height: 44px;
        height: 44px;
      }

      button {
        width: 100%;
        flex: none;
      }
    }

    .lead {
      margin-bottom: 14px;
    }

    .tags {
      gap: 6px;

      a {
        padding: 6px 10px;
        font-size: 12px;
      }
    }
  }
`
