import styled from 'styled-components'
import { gameJavaEmbedUrl } from '../utils/server'

type Props = {
  gameId: string
  gameName: string
}

export default function JavaPlayer({ gameId, gameName }: Props) {
  return (
    <Style>
      <div className="stage" aria-label={`${gameName} Java 模拟器`}>
        <iframe
          className="frame"
          title={`${gameName} Java 模拟器`}
          src={gameJavaEmbedUrl(gameId)}
          allow="unload; autoplay; fullscreen; gamepad"
          referrerPolicy="no-referrer"
        />
      </div>
    </Style>
  )
}

const Style = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .stage {
    position: relative;
    flex: 1;
    min-height: 280px;
    border-radius: 0.85rem;
    overflow: hidden;
    background: #0a0c14;
    border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  }

  .frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: #000;
  }
`
