import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  arcadeRomsetFile,
  gameRomUrl,
} from '../utils/server'


export type ArcadePlayerControls = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  paused: boolean
  togglePause: () => void
  hardReset: () => void
}

type Props = {
  gameId: string
  gameName: string
  downloadUrl: string
  onControlsChange?: (controls: ArcadePlayerControls) => void
}

const EJS_DATA = 'https://cdn.emulatorjs.org/stable/data/'

/**
 * 街机六键（参考 FC 手感扩展）
 * P1: WASD 方向 · JKL 下排 1–3 · UIO 上排 4–6 · V 投币 · Enter Start
 * P2: 方向键 · 123 下排 · 789 上排 · 4 投币 · 5 Start
 */
const ARCADE_6BTN_CONTROLS = {
  0: {
    0: { value: 'j', value2: 'BUTTON_2' },
    1: { value: 'u', value2: 'BUTTON_4' },
    2: { value: 'v', value2: 'SELECT' },
    3: { value: 'enter', value2: 'START' },
    4: { value: 'w', value2: 'DPAD_UP' },
    5: { value: 's', value2: 'DPAD_DOWN' },
    6: { value: 'a', value2: 'DPAD_LEFT' },
    7: { value: 'd', value2: 'DPAD_RIGHT' },
    8: { value: 'k', value2: 'BUTTON_1' },
    9: { value: 'l', value2: 'BUTTON_3' },
    10: { value: 'i', value2: 'LEFT_TOP_SHOULDER' },
    11: { value: 'o', value2: 'RIGHT_TOP_SHOULDER' },
    12: { value: '', value2: 'LEFT_BOTTOM_SHOULDER' },
    13: { value: '', value2: 'RIGHT_BOTTOM_SHOULDER' },
    14: { value: '', value2: 'LEFT_STICK' },
    15: { value: '', value2: 'RIGHT_STICK' },
    16: { value: '', value2: 'LEFT_STICK_X:+1' },
    17: { value: '', value2: 'LEFT_STICK_X:-1' },
    18: { value: '', value2: 'LEFT_STICK_Y:+1' },
    19: { value: '', value2: 'LEFT_STICK_Y:-1' },
    20: { value: '', value2: 'RIGHT_STICK_X:+1' },
    21: { value: '', value2: 'RIGHT_STICK_X:-1' },
    22: { value: '', value2: 'RIGHT_STICK_Y:+1' },
    23: { value: '', value2: 'RIGHT_STICK_Y:-1' },
    24: { value: '' },
    25: { value: '' },
    26: { value: '' },
    27: { value: '' },
    28: { value: '' },
    29: { value: '' },
  },
  1: {
    0: { value: '1', value2: 'BUTTON_2' },
    1: { value: '7', value2: 'BUTTON_4' },
    2: { value: '4', value2: 'SELECT' },
    3: { value: '5', value2: 'START' },
    4: { value: 'up arrow', value2: 'DPAD_UP' },
    5: { value: 'down arrow', value2: 'DPAD_DOWN' },
    6: { value: 'left arrow', value2: 'DPAD_LEFT' },
    7: { value: 'right arrow', value2: 'DPAD_RIGHT' },
    8: { value: '2', value2: 'BUTTON_1' },
    9: { value: '3', value2: 'BUTTON_3' },
    10: { value: '8', value2: 'LEFT_TOP_SHOULDER' },
    11: { value: '9', value2: 'RIGHT_TOP_SHOULDER' },
    12: { value: '', value2: 'LEFT_BOTTOM_SHOULDER' },
    13: { value: '', value2: 'RIGHT_BOTTOM_SHOULDER' },
    14: { value: '', value2: 'LEFT_STICK' },
    15: { value: '', value2: 'RIGHT_STICK' },
    16: { value: '', value2: 'LEFT_STICK_X:+1' },
    17: { value: '', value2: 'LEFT_STICK_X:-1' },
    18: { value: '', value2: 'LEFT_STICK_Y:+1' },
    19: { value: '', value2: 'LEFT_STICK_Y:-1' },
    20: { value: '', value2: 'RIGHT_STICK_X:+1' },
    21: { value: '', value2: 'RIGHT_STICK_X:-1' },
    22: { value: '', value2: 'RIGHT_STICK_Y:+1' },
    23: { value: '', value2: 'RIGHT_STICK_Y:-1' },
    24: { value: '' },
    25: { value: '' },
    26: { value: '' },
    27: { value: '' },
    28: { value: '' },
    29: { value: '' },
  },
  2: {},
  3: {},
}

const HIDDEN_BUTTONS = {
  playPause: false,
  restart: false,
  mute: false,
  settings: false,
  fullscreen: false,
  saveState: false,
  loadState: false,
  screenRecord: false,
  gamepad: false,
  cheat: false,
  volume: false,
  saveSavFiles: false,
  loadSavFiles: false,
  quickSave: false,
  quickLoad: false,
  screenshot: false,
  cacheManager: false,
  exitEmulation: false,
}

function hashGameId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0
  return h || 1
}

function absoluteUrl(path: string) {
  return new URL(path, window.location.origin).href
}

function buildPlayerHtml(options: {
  romUrl: string
  romsetName: string
  gameId: string
}) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0a0c12; overflow: hidden; }
  #game { width: 100%; height: 100%; }
  /* 隐藏 EmulatorJS 全部控制条 / 虚拟手柄 */
  .ejs--bar, .ejs-bar, .ejs--controls, .ejs-controls,
  .ejs--control, .ejs-control, .ejs--context-menu,
  .ejs-virtual-gamepad, .ejs--virtual-gamepad,
  [class*="ejs"][class*="bar"], [class*="ejs"][class*="control"] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
    height: 0 !important;
    opacity: 0 !important;
  }
</style>
</head>
<body>
<div id="game"></div>
<script>
  function hideChrome() {
    var nodes = document.querySelectorAll(
      '.ejs--bar, .ejs-bar, .ejs--controls, .ejs-controls, .ejs--control, .ejs-control, .ejs-virtual-gamepad, [class*="ejs"][class*="bar"]'
    );
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.setProperty('display', 'none', 'important');
    }
  }

  var obs = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(hideChrome)
    : null;
  if (obs) obs.observe(document.documentElement, { childList: true, subtree: true });

  EJS_player = '#game';
  EJS_core = 'arcade';
  EJS_pathtodata = ${JSON.stringify(EJS_DATA)};
  EJS_gameUrl = ${JSON.stringify(options.romUrl)};
  EJS_gameName = ${JSON.stringify(options.romsetName)};
  EJS_gameID = ${hashGameId(options.gameId)};
  EJS_language = 'zh-CN';
  EJS_color = '#7c5cff';
  EJS_backgroundColor = '#0a0c12';
  EJS_startOnLoaded = true;
  EJS_controlScheme = 'arcade';
  EJS_disableLocalStorage = true;
  EJS_defaultControls = ${JSON.stringify(ARCADE_6BTN_CONTROLS)};
  EJS_Buttons = ${JSON.stringify(HIDDEN_BUTTONS)};
  /* BIOS 已由 /api/game/rom 合并进 romset；勿再设 EJS_biosUrl（stable 会解压导致 FBNeo 找不到 pgm/neogeo.zip） */
  EJS_ready = function () {
    hideChrome();
    parent.postMessage({ type: 'arcade:status', status: 'ready' }, '*');
  };
  EJS_onGameStart = function () {
    hideChrome();
    parent.postMessage({ type: 'arcade:status', status: 'ready' }, '*');
  };
</script>
<script src="${EJS_DATA}loader.js"></script>
</body>
</html>`
}

export default function ArcadePlayer({
  gameId,
  gameName,
  downloadUrl,
  onControlsChange,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [bootKey, setBootKey] = useState(0)

  const srcDoc = useMemo(() => {
    const romsetFile = arcadeRomsetFile(downloadUrl)
    const romsetName = romsetFile.replace(/\.zip$/i, '')
    const romUrl = absoluteUrl(gameRomUrl(gameId, downloadUrl))
    return buildPlayerHtml({ romUrl, romsetName, gameId })
  }, [gameId, downloadUrl, bootKey])

  function hardReset() {
    if (status !== 'ready' && status !== 'error') return
    setBootKey((n) => n + 1)
  }

  const reportControls = useEffectEvent((next: ArcadePlayerControls) => {
    onControlsChange?.(next)
  })

  useEffect(() => {
    reportControls({
      status,
      paused: false,
      togglePause: () => {},
      hardReset,
    })
  }, [status, bootKey])

  useEffect(() => {
    setStatus('loading')
    setError('')

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'arcade:status' && data.status === 'ready') {
        setStatus('ready')
      }
    }
    window.addEventListener('message', onMessage)

    const timer = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev !== 'loading') return prev
        setError('加载超时，请刷新页面重试')
        return 'error'
      })
    }, 180_000)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timer)
    }
  }, [bootKey, gameId])

  return (
    <Style>
      <div className="stage">
        <iframe
          key={bootKey}
          className="screen"
          title={`${gameName} 街机模拟器`}
          srcDoc={srcDoc}
          allow="autoplay; gamepad; fullscreen"
        />
        {status === 'loading' ? (
          <div className="overlay">加载中…首次需下载模拟器核心，请稍候</div>
        ) : null}
        {status === 'error' ? <div className="overlay overlay--err">{error}</div> : null}
      </div>
    </Style>
  )
}

const Style = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    border-radius: 0.9rem;
    overflow: hidden;
    border: 1px solid var(--line);
    background: #0a0c12;
    box-shadow: var(--shadow);
  }

  .screen {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: #0a0c12;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    text-align: center;
    background: color-mix(in srgb, var(--bg) 55%, transparent);
    color: var(--ink);
    font-size: 0.95rem;
    backdrop-filter: blur(4px);
    pointer-events: none;
  }

  .overlay--err {
    color: var(--danger);
  }
`
