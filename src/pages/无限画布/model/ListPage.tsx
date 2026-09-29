import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import type { Node } from '@xyflow/react'
import {
  ASSET_STYLES,
  buildAssetImagePrompt,
  buildStoryboardImagePrompt,
  buildStoryboardVideoPrompt,
  createNodeAt,
  formatAssetCatalog,
  getStoryboardLinkedAssets,
  getStoryboardRefImages,
  kindMeta,
  normalizeIdList,
  parseCanvasDocument,
  parseStoryboardAiText,
  pruneStoryboardAssetLinks,
  pushImageHistory,
  resolveAssetStyle,
  restoreImageFromHistory,
  serializeCanvasDocument,
  syncAssetStoryboardEdges,
  type CanvasDocument,
  type CanvasNodeData,
  type CanvasNodeKind,
} from '../utils/canvasContent'
import {
  createCanvasVideo,
  generateCanvasImage,
  generateCanvasText,
  getProject,
  updateProject,
  waitCanvasVideo,
  type CanvasProject,
} from '../utils/server'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type StepStatus = 'pending' | 'partial' | 'done'
type FlowStep = 'script' | 'assets' | 'storyboard'
type BusyMap = Record<string, string>

type BatchVideoProgress = {
  current: number
  total: number
  failed: number
  running: boolean
  stopping: boolean
}

/** 串行生成，避免多路轮询打满接口限频 */
const VIDEO_BATCH_CONCURRENCY = 1
const VIDEO_MAX_RETRIES = 3
/** 两条分镜之间的间隔 */
const VIDEO_BATCH_GAP_MS = 4000
/** 状态查询轮询间隔（过短易触发「查询过于频繁」） */
const VIDEO_POLL_INTERVAL_MS = 5000
const VIDEO_RETRY_DELAY_MS = 6000
const VIDEO_RATE_LIMIT_RETRY_MS = 12000

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isRateLimitError(message: string) {
  return /过于频繁|请稍后重试|rate.?limit|too many|429/i.test(message)
}

function retryDelayForError(message: string) {
  return isRateLimitError(message) ? VIDEO_RATE_LIMIT_RETRY_MS : VIDEO_RETRY_DELAY_MS
}

const STEPS: {
  key: string
  label: string
  anchor: string
  kind?: CanvasNodeKind
  group?: 'assets'
}[] = [
  { key: 'script', label: '故事剧本', anchor: 'anchor-script', kind: 'script' },
  { key: 'assets', label: '资产情况', anchor: 'anchor-assets' },
  { key: 'chars', label: '角色', anchor: 'anchor-characters', kind: 'character', group: 'assets' },
  { key: 'props', label: '道具', anchor: 'anchor-props', kind: 'prop', group: 'assets' },
  { key: 'scenes', label: '场景', anchor: 'anchor-scenes', kind: 'scene', group: 'assets' },
  { key: 'sb', label: '分镜脚本', anchor: 'anchor-storyboard', kind: 'storyboard' },
]

const ASSET_KINDS: CanvasNodeKind[] = ['character', 'prop', 'scene']

function layoutPosition(kind: CanvasNodeKind, index: number) {
  const col: Record<CanvasNodeKind, number> = {
    script: 80,
    character: 420,
    prop: 420,
    scene: 420,
    storyboard: 780,
    text: 80,
    image: 420,
    video: 780,
    compose: 1140,
  }
  const rowBase: Record<CanvasNodeKind, number> = {
    script: 80,
    character: 80,
    prop: 320,
    scene: 560,
    storyboard: 80,
    text: 80,
    image: 80,
    video: 80,
    compose: 80,
  }
  return {
    x: col[kind] ?? 80,
    y: (rowBase[kind] ?? 80) + index * 160,
  }
}

function stepStatus(nodes: Node<CanvasNodeData>[], kind?: CanvasNodeKind): StepStatus {
  if (!kind) return 'pending'
  const list = nodes.filter((n) => n.data.kind === kind)
  if (list.length === 0) return 'pending'
  if (kind === 'script') {
    return list.some((n) => n.data.body.trim().length > 20) ? 'done' : 'partial'
  }
  if (kind === 'storyboard') {
    return list.some((n) => n.data.body.trim()) ? 'done' : 'partial'
  }
  const withImage = list.filter((n) => Boolean(n.data.imageUrl)).length
  if (withImage === list.length) return 'done'
  return 'partial'
}

export default function ListPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<CanvasProject | null>(null)
  const [doc, setDoc] = useState<CanvasDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [busy, setBusy] = useState<BusyMap>({})
  const [outline, setOutline] = useState('')
  const [activeStep, setActiveStep] = useState<FlowStep>('script')
  const [previewUrl, setPreviewUrl] = useState('')
  const [batchVideoProgress, setBatchVideoProgress] = useState<BatchVideoProgress>({
    current: 0,
    total: 0,
    failed: 0,
    running: false,
    stopping: false,
  })
  const [batchVideoErrors, setBatchVideoErrors] = useState<string[]>([])
  const [batchVideoFailedIds, setBatchVideoFailedIds] = useState<string[]>([])
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const batchVideoStopRef = useRef(false)

  const goStep = (step: FlowStep) => {
    setActiveStep(step)
    const anchor =
      step === 'script'
        ? 'anchor-script'
        : step === 'assets'
          ? 'anchor-assets'
          : 'anchor-storyboard'
    requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDoc(null)
    void getProject(id)
      .then(async (data) => {
        if (cancelled) return
        const parsed = parseCanvasDocument(data.item.content, data.item.title)
        setItem(data.item)
        setDoc(parsed)
        setOutline(data.item.prompt || '')
        if (!data.item.content?.trim()) {
          try {
            const { item: saved } = await updateProject(id, {
              content: serializeCanvasDocument(parsed),
            })
            if (!cancelled) setItem(saved)
          } catch {
            /* seed best-effort */
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setItem(null)
          setDoc(null)
          setError(err instanceof Error ? err.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [id])

  const persist = useCallback(
    (next: CanvasDocument) => {
      if (!id) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(() => {
        void updateProject(id, { content: serializeCanvasDocument(next) })
          .then(({ item: saved }) => {
            setItem(saved)
            setSaveState('saved')
          })
          .catch(() => setSaveState('error'))
      }, 450)
    },
    [id],
  )

  const setNodes = useCallback(
    (updater: (nodes: Node<CanvasNodeData>[]) => Node<CanvasNodeData>[]) => {
      setDoc((prev) => {
        if (!prev) return prev
        const nodes = updater(prev.nodes)
        const edges = syncAssetStoryboardEdges(nodes, prev.edges)
        const next = { ...prev, nodes, edges }
        persist(next)
        return next
      })
    },
    [persist],
  )

  const scripts = useMemo(
    () => doc?.nodes.filter((n) => n.data.kind === 'script') || [],
    [doc],
  )
  const characters = useMemo(
    () => doc?.nodes.filter((n) => n.data.kind === 'character') || [],
    [doc],
  )
  const props = useMemo(
    () => doc?.nodes.filter((n) => n.data.kind === 'prop') || [],
    [doc],
  )
  const scenes = useMemo(
    () => doc?.nodes.filter((n) => n.data.kind === 'scene') || [],
    [doc],
  )
  const storyboards = useMemo(
    () => doc?.nodes.filter((n) => n.data.kind === 'storyboard') || [],
    [doc],
  )

  const scriptNode = scripts[0] || null
  const scriptText = scriptNode?.data.body || ''
  const assetStyleId = doc?.assetStyle || ASSET_STYLES[0]!.id
  const assetStyle = resolveAssetStyle(assetStyleId)

  useEffect(() => {
    if (!previewUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewUrl('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewUrl])

  const setAssetStyle = (styleId: string) => {
    setDoc((prev) => {
      if (!prev) return prev
      const next = { ...prev, assetStyle: styleId }
      persist(next)
      return next
    })
  }

  const assetTotal = characters.length + props.length + scenes.length
  const assetStatus = useMemo((): StepStatus => {
    if (!doc) return 'pending'
    const assets = doc.nodes.filter((n) => ASSET_KINDS.includes(n.data.kind))
    if (!assets.length) return 'pending'
    const withImage = assets.filter((n) => Boolean(n.data.imageUrl)).length
    if (withImage === assets.length) return 'done'
    return 'partial'
  }, [doc])

  const navSteps = useMemo(() => {
    if (!doc) {
      return STEPS.map((s) => ({
        ...s,
        status: 'pending' as StepStatus,
        count: 0,
      }))
    }
    return STEPS.map((s) => {
      if (s.key === 'assets') {
        return { ...s, status: assetStatus, count: assetTotal }
      }
      const list = s.kind ? doc.nodes.filter((n) => n.data.kind === s.kind) : []
      return {
        ...s,
        status: stepStatus(doc.nodes, s.kind),
        count: list.length,
      }
    })
  }, [doc, assetStatus, assetTotal])

  const topNavSteps = useMemo(
    () => navSteps.filter((s) => !s.group),
    [navSteps],
  )
  const assetNavSteps = useMemo(
    () => navSteps.filter((s) => s.group === 'assets'),
    [navSteps],
  )

  const flowSteps = useMemo(() => {
    const scriptStatus = topNavSteps.find((s) => s.key === 'script')?.status || 'pending'
    const assetsStatus = topNavSteps.find((s) => s.key === 'assets')?.status || 'pending'
    const sbStatus = topNavSteps.find((s) => s.key === 'sb')?.status || 'pending'
    return [
      {
        key: 'script' as FlowStep,
        label: '故事剧本',
        desc: '梗概与正文',
        status: scriptStatus,
        count: topNavSteps.find((s) => s.key === 'script')?.count || 0,
        unlocked: true,
      },
      {
        key: 'assets' as FlowStep,
        label: '资产情况',
        desc: '角色 / 道具 / 场景',
        status: assetsStatus,
        count: assetTotal,
        unlocked: scriptStatus === 'done',
      },
      {
        key: 'storyboard' as FlowStep,
        label: '分镜脚本',
        desc: '分镜图与视频',
        status: sbStatus,
        count: topNavSteps.find((s) => s.key === 'sb')?.count || 0,
        unlocked: scriptStatus === 'done' && assetsStatus === 'done',
      },
    ]
  }, [topNavSteps, assetTotal])

  const activeFlowIndex = Math.max(0, flowSteps.findIndex((s) => s.key === activeStep))
  const nextFlow =
    activeFlowIndex < flowSteps.length - 1 ? flowSteps[activeFlowIndex + 1] : null

  useEffect(() => {
    const cur = flowSteps.find((s) => s.key === activeStep)
    if (cur && !cur.unlocked) {
      const fallback = [...flowSteps].reverse().find((s) => s.unlocked)
      if (fallback) setActiveStep(fallback.key)
    }
  }, [flowSteps, activeStep])

  const scrollToEl = (anchor: string) => {
    requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const scrollToAnchor = (anchor: string) => {
    if (anchor === 'anchor-script') setActiveStep('script')
    else if (
      anchor === 'anchor-assets' ||
      anchor === 'anchor-characters' ||
      anchor === 'anchor-props' ||
      anchor === 'anchor-scenes'
    ) {
      setActiveStep('assets')
    } else if (anchor === 'anchor-storyboard') {
      setActiveStep('storyboard')
    } else if (anchor.startsWith('item-')) {
      const nodeId = anchor.slice('item-'.length)
      const node = doc?.nodes.find((n) => n.id === nodeId)
      if (node?.data.kind === 'storyboard') setActiveStep('storyboard')
      else if (node && ASSET_KINDS.includes(node.data.kind)) setActiveStep('assets')
    }
    scrollToEl(anchor)
  }

  const onTitleBlur = () => {
    if (!item || !titleRef.current) return
    const title = titleRef.current.value.trim() || '未命名短剧'
    if (title === item.title) return
    setSaveState('saving')
    void updateProject(id, { title })
      .then(({ item: saved }) => {
        setItem(saved)
        setSaveState('saved')
      })
      .catch(() => setSaveState('error'))
  }

  const patchNode = (nodeId: string, patch: Partial<CanvasNodeData>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
    )
  }

  const ensureScriptNode = () => {
    if (scriptNode) return scriptNode
    const created = createNodeAt('script', layoutPosition('script', 0), {
      title: `${item?.title || '未命名短剧'} · 剧本`,
      body: '',
    })
    setNodes((nodes) => [...nodes, created])
    return created
  }

  const addAsset = (kind: 'character' | 'scene' | 'prop' | 'storyboard') => {
    const list = doc?.nodes.filter((n) => n.data.kind === kind) || []
    const meta = kindMeta(kind)
    const created = createNodeAt(kind, layoutPosition(kind, list.length), {
      title: kind === 'storyboard' ? `分镜 ${String(list.length + 1).padStart(2, '0')}` : meta.title,
    })
    setNodes((nodes) => [...nodes, created])
    requestAnimationFrame(() => scrollToAnchor(`item-${created.id}`))
  }

  const removeNode = (nodeId: string) => {
    if (!window.confirm('确定删除该项？')) return
    setDoc((prev) => {
      if (!prev) return prev
      const pruned = pruneStoryboardAssetLinks(
        prev.nodes.filter((n) => n.id !== nodeId),
        nodeId,
      )
      const edges = syncAssetStoryboardEdges(pruned, prev.edges).filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      )
      const next = { ...prev, nodes: pruned, edges }
      persist(next)
      return next
    })
  }

  const patchStoryboardLinks = (
    nodeId: string,
    patch: Pick<CanvasNodeData, 'characterIds' | 'sceneId' | 'propIds'>,
  ) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== nodeId || n.data.kind !== 'storyboard') return n
        return {
          ...n,
          data: {
            ...n.data,
            characterIds:
              patch.characterIds !== undefined
                ? normalizeIdList(patch.characterIds)
                : normalizeIdList(n.data.characterIds),
            propIds:
              patch.propIds !== undefined
                ? normalizeIdList(patch.propIds)
                : normalizeIdList(n.data.propIds),
            sceneId:
              patch.sceneId !== undefined ? patch.sceneId || null : n.data.sceneId ?? null,
          },
        }
      }),
    )
  }

  const toggleStoryboardCharacter = (sbId: string, charId: string) => {
    const sb = storyboards.find((n) => n.id === sbId)
    if (!sb) return
    const current = normalizeIdList(sb.data.characterIds)
    const next = current.includes(charId)
      ? current.filter((id) => id !== charId)
      : [...current, charId]
    patchStoryboardLinks(sbId, { characterIds: next })
  }

  const toggleStoryboardProp = (sbId: string, propId: string) => {
    const sb = storyboards.find((n) => n.id === sbId)
    if (!sb) return
    const current = normalizeIdList(sb.data.propIds)
    const next = current.includes(propId)
      ? current.filter((id) => id !== propId)
      : [...current, propId]
    patchStoryboardLinks(sbId, { propIds: next })
  }

  const setBusyKey = (key: string, value: string) => {
    setBusy((prev) => {
      if (!value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }

  const onGenerateScript = async () => {
    const node = ensureScriptNode()
    const prompt =
      outline.trim() ||
      item?.prompt?.trim() ||
      '请根据常见短剧结构，写一集约 800 字的故事剧本，包含开场、冲突与收束。'
    setBusyKey('script', '生成剧本中…')
    try {
      const { text } = await generateCanvasText({
        prompt,
        kind: 'script',
        title: node.data.title,
        context: outline.trim() || item?.prompt || '',
      })
      patchNode(node.id, { body: text })
      if (outline.trim() && outline.trim() !== item?.prompt) {
        void updateProject(id, { prompt: outline.trim() }).then(({ item: saved }) => setItem(saved))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '剧本生成失败')
    } finally {
      setBusyKey('script', '')
    }
  }

  const onExtractAssets = async (kind: 'character' | 'scene' | 'prop') => {
    const body = scriptText.trim()
    if (!body) {
      setError('请先完成剧本，再提取素材')
      scrollToAnchor('anchor-script')
      return
    }
    const label = kindMeta(kind).label
    setBusyKey(`extract-${kind}`, `提取${label}中…`)
    setError('')
    try {
      const extractHint =
        kind === 'prop'
          ? '描述只写单体道具外观与材质，不得出现人物、手、场景背景或杂物。'
          : kind === 'scene'
            ? '描述只写空间环境、建筑与光线，不得出现人物、角色或生物。'
            : '描述外貌服装与辨识特征，便于三视图设定。'
      const { text } = await generateCanvasText({
        prompt: `请从以下短剧剧本中提取${label}列表。每行一项，格式：名称｜简要描述。${extractHint}只输出列表，不要编号说明。\n\n${body}`,
        kind,
        title: label,
        context: body,
      })
      const lines = text
        .split(/\n+/)
        .map((line) => line.replace(/^\s*[-*\d.。）]+\s*/, '').trim())
        .filter(Boolean)
      const existing = doc?.nodes.filter((n) => n.data.kind === kind) || []
      const created = lines.slice(0, 12).map((line, index) => {
        const [titlePart, ...rest] = line.split(/[｜|：:]/)
        const title = (titlePart || `${label}${index + 1}`).trim().slice(0, 40)
        const desc = rest.join('：').trim() || line
        return createNodeAt(kind, layoutPosition(kind, existing.length + index), {
          title,
          body: desc,
        })
      })
      if (created.length) {
        setNodes((nodes) => [...nodes, ...created])
        scrollToAnchor(
          kind === 'character'
            ? 'anchor-characters'
            : kind === 'prop'
              ? 'anchor-props'
              : 'anchor-scenes',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `提取${label}失败`)
    } finally {
      setBusyKey(`extract-${kind}`, '')
    }
  }

  const onExtractAllAssets = async () => {
    const body = scriptText.trim()
    if (!body) {
      setError('请先完成剧本，再提取素材')
      scrollToAnchor('anchor-script')
      return
    }
    setBusyKey('extract-all', '提取所有资产中…')
    setError('')
    setActiveStep('assets')
    try {
      for (const kind of ASSET_KINDS) {
        if (kind === 'character' || kind === 'prop' || kind === 'scene') {
          await onExtractAssets(kind)
        }
      }
      scrollToAnchor('anchor-assets')
    } finally {
      setBusyKey('extract-all', '')
    }
  }

  const onGenerateStoryboards = async () => {
    const body = scriptText.trim()
    if (!body) {
      setError('请先完成剧本，再生成分镜')
      scrollToAnchor('anchor-script')
      return
    }
    if (storyboards.length > 0) {
      const ok = window.confirm(
        `将删除现有 ${storyboards.length} 条分镜并重新生成，是否继续？`,
      )
      if (!ok) return
    }
    const allNodes = doc?.nodes || []
    const catalog = formatAssetCatalog(allNodes)
    const hasAssets = assetTotal > 0
    setBusyKey('storyboard', '生成分镜中…')
    setError('')
    try {
      const formatHint = hasAssets
        ? `只输出合法 JSON 数组（不要 Markdown、不要代码围栏、不要解释）。每项：
{"title":"分镜标题","body":"景别+运镜+画面+对白","characters":[1],"scene":1,"props":[1]}
规则：
1. characters/scene/props 只能填下方资产清单的序号（数字），或资产名称；没有则 characters/props 用 []，scene 用 null
2. 禁止输出任何内部 id（如 character-xxx）
3. title/body 可用中文自然语言，不要夹带 JSON 符号或序号说明`
        : `只输出合法 JSON 数组（不要 Markdown、不要代码围栏、不要解释）。每项：
{"title":"分镜标题","body":"景别+运镜+画面+对白"}
title/body 可用中文自然语言。`
      const { text } = await generateCanvasText({
        prompt: `请把下面剧本拆成 4~8 个分镜。${formatHint}\n\n【剧本】\n${body}${
          hasAssets ? `\n\n【资产清单】（请用序号关联）\n${catalog}` : ''
        }`,
        kind: 'storyboard',
        title: '分镜脚本',
        // 勿把整段剧本再塞进 context，避免冲淡 JSON 格式要求
        context: hasAssets ? `资产清单：\n${catalog}` : '',
      })
      const parsedList = parseStoryboardAiText(text, allNodes)
      if (!parsedList.length) {
        setError('未能解析分镜结果，请重试')
        return
      }
      const created = parsedList.map((parsed, index) => {
        const title =
          parsed.title || `分镜 ${String(index + 1).padStart(2, '0')}`
        return createNodeAt('storyboard', layoutPosition('storyboard', index), {
          title: title.slice(0, 40),
          body: parsed.body,
          characterIds: parsed.characterIds,
          sceneId: parsed.sceneId,
          propIds: parsed.propIds,
        })
      })
      // 每次重新生成：删除旧分镜，整批替换
      setNodes((nodes) => {
        const kept = nodes.filter((n) => n.data.kind !== 'storyboard')
        return [...kept, ...created]
      })
      scrollToAnchor('anchor-storyboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '分镜生成失败')
    } finally {
      setBusyKey('storyboard', '')
    }
  }

  const onGenerateImage = async (node: Node<CanvasNodeData>) => {
    const kind = node.data.kind
    const isAsset = kind === 'character' || kind === 'prop' || kind === 'scene'
    const isStoryboard = kind === 'storyboard'
    const allNodes = doc?.nodes || []
    const prompt = isAsset
      ? buildAssetImagePrompt({
          kind,
          title: node.data.title,
          body: node.data.body,
          styleId: assetStyleId,
        })
      : isStoryboard
        ? buildStoryboardImagePrompt({
            title: node.data.title,
            body: node.data.body,
            data: node.data,
            nodes: allNodes,
            styleId: assetStyleId,
          })
        : [node.data.title, node.data.body].filter(Boolean).join('\n')
    if (!prompt.trim()) {
      setError('请先填写名称和描述')
      return
    }
    const refImages = isStoryboard
      ? getStoryboardRefImages(node.data, allNodes).slice(0, 5)
      : []
    setBusyKey(node.id, '生成图片中…')
    setError('')
    try {
      const { url } = await generateCanvasImage({
        prompt,
        ratio: isAsset ? '16:9' : '9:16',
        images: refImages.length ? refImages : undefined,
      })
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, ...pushImageHistory(n.data, url) } }
            : n,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片生成失败')
    } finally {
      setBusyKey(node.id, '')
    }
  }

  const onRestoreImage = (node: Node<CanvasNodeData>, url: string) => {
    const patch = restoreImageFromHistory(node.data, url)
    if (!patch) return
    patchNode(node.id, patch)
  }

  const onGenerateAllImages = async (
    kind: 'character' | 'scene' | 'prop' | 'storyboard',
    list: Node<CanvasNodeData>[],
    batchKey = `gen-all-${kind}`,
  ) => {
    const targets = list.filter((n) => {
      const prompt = [n.data.title, n.data.body].filter(Boolean).join('\n').trim()
      return Boolean(prompt)
    })
    if (!targets.length) {
      setError(
        batchKey === 'gen-all-assets'
          ? '请先填写资产名称与描述'
          : `请先提取或填写${kindMeta(kind).label}名称与描述`,
      )
      return
    }
    const concurrency = 2
    const styleId = assetStyleId
    const snapshotNodes = doc?.nodes || []
    setError('')
    let done = 0
    let failed = 0
    setBusyKey(batchKey, `生成图片中 0/${targets.length}…`)
    for (const node of targets) {
      setBusyKey(node.id, '生成图片中…')
    }

    const runOne = async (node: Node<CanvasNodeData>) => {
      const nodeKind = node.data.kind
      const nodeIsAsset =
        nodeKind === 'character' || nodeKind === 'prop' || nodeKind === 'scene'
      const nodeIsStoryboard = nodeKind === 'storyboard'
      const prompt = nodeIsAsset
        ? buildAssetImagePrompt({
            kind: nodeKind,
            title: node.data.title,
            body: node.data.body,
            styleId,
          })
        : nodeIsStoryboard
          ? buildStoryboardImagePrompt({
              title: node.data.title,
              body: node.data.body,
              data: node.data,
              nodes: snapshotNodes,
              styleId,
            })
          : [node.data.title, node.data.body].filter(Boolean).join('\n')
      const refImages = nodeIsStoryboard
        ? getStoryboardRefImages(node.data, snapshotNodes).slice(0, 5)
        : []
      try {
        const { url } = await generateCanvasImage({
          prompt,
          ratio: nodeIsAsset ? '16:9' : '9:16',
          images: refImages.length ? refImages : undefined,
        })
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === node.id
              ? { ...n, data: { ...n.data, ...pushImageHistory(n.data, url) } }
              : n,
          ),
        )
        done += 1
      } catch {
        failed += 1
      } finally {
        setBusyKey(node.id, '')
        setBusyKey(batchKey, `生成图片中 ${done}/${targets.length}…`)
      }
    }

    try {
      let next = 0
      const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
        while (next < targets.length) {
          const index = next
          next += 1
          const node = targets[index]
          if (!node) continue
          if (index > 0) await sleep(1500)
          await runOne(node)
        }
      })
      await Promise.all(workers)
      if (failed > 0) {
        const label = batchKey === 'gen-all-assets' ? '资产' : kindMeta(kind).label
        setError(`${label}图片：成功 ${done} 张，失败 ${failed} 张`)
      }
    } finally {
      setBusyKey(batchKey, '')
      for (const node of targets) {
        setBusyKey(node.id, '')
      }
    }
  }

  const onGenerateAllAssetImages = async () => {
    const list = [...characters, ...props, ...scenes]
    if (!list.length) {
      setError('请先提取或添加资产')
      return
    }
    setActiveStep('assets')
    await onGenerateAllImages('character', list, 'gen-all-assets')
  }

  const onGenerateAllStoryboardImages = async () => {
    if (!storyboards.length) {
      setError('请先生成或添加分镜')
      return
    }
    setActiveStep('storyboard')
    await onGenerateAllImages('storyboard', storyboards)
  }

  const videoBusyKey = (nodeId: string) => `video-${nodeId}`
  const videoPromptBusyKey = (nodeId: string) => `vprompt-${nodeId}`

  const buildVideoScriptAiInput = (node: Node<CanvasNodeData>, allNodes: Node<CanvasNodeData>[]) => {
    const linked = getStoryboardLinkedAssets(node.data, allNodes)
    const assetHint = [
      linked.scene ? `场景：${linked.scene.data.title}` : '',
      linked.characters.length
        ? `角色：${linked.characters.map((c) => c.data.title).join('、')}`
        : '',
      linked.props.length ? `道具：${linked.props.map((p) => p.data.title).join('、')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    return {
      prompt: `请根据以下分镜，写一段可直接用于短剧生视频的中文镜头脚本（视频提示词）。
要求：40~160 字；含景别、运镜、动作、表情、对白/旁白要点与气氛；竖屏 9:16；不要列表、不要 Markdown、不要解释。

分镜标题：${node.data.title}
分镜内容：${node.data.body}
${assetHint ? `\n关联资产：\n${assetHint}` : ''}`,
      kind: 'video' as const,
      title: node.data.title,
      context: node.data.body,
    }
  }

  const onGenerateVideoPrompt = async (node: Node<CanvasNodeData>) => {
    if (node.data.kind !== 'storyboard') return
    if (![node.data.title, node.data.body].some((s) => s?.trim())) {
      setError('请先填写分镜标题或内容')
      return
    }
    const key = videoPromptBusyKey(node.id)
    setBusyKey(key, '生成脚本中…')
    setError('')
    try {
      const { text } = await generateCanvasText(
        buildVideoScriptAiInput(node, doc?.nodes || []),
      )
      const cleaned = text
        .replace(/^```(?:\w+)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      if (!cleaned) throw new Error('未返回视频脚本')
      patchNode(node.id, { videoPrompt: cleaned })
    } catch (err) {
      setError(err instanceof Error ? err.message : '视频脚本生成失败')
    } finally {
      setBusyKey(key, '')
    }
  }

  const onGenerateAllStoryboardVideoPrompts = async () => {
    if (!storyboards.length) {
      setError('请先生成或添加分镜')
      return
    }
    setActiveStep('storyboard')
    const snapshotNodes = doc?.nodes || []
    const targets = storyboards.filter((n) =>
      Boolean([n.data.title, n.data.body].some((s) => s?.trim())),
    )
    if (!targets.length) {
      setError('请先填写分镜标题或内容')
      return
    }
    const batchKey = 'gen-all-storyboard-vprompt'
    const concurrency = 1
    setError('')
    let done = 0
    let failed = 0
    setBusyKey(batchKey, `生成脚本中 0/${targets.length}…`)
    for (const node of targets) {
      setBusyKey(videoPromptBusyKey(node.id), '生成脚本中…')
    }

    const runOne = async (node: Node<CanvasNodeData>) => {
      const key = videoPromptBusyKey(node.id)
      try {
        const { text } = await generateCanvasText(
          buildVideoScriptAiInput(node, snapshotNodes),
        )
        const cleaned = text
          .replace(/^```(?:\w+)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()
        if (!cleaned) throw new Error('empty')
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, videoPrompt: cleaned } } : n,
          ),
        )
        done += 1
      } catch {
        failed += 1
      } finally {
        setBusyKey(key, '')
        setBusyKey(batchKey, `生成脚本中 ${done}/${targets.length}…`)
      }
    }

    try {
      let next = 0
      const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
        while (next < targets.length) {
          const index = next
          next += 1
          const node = targets[index]
          if (!node) continue
          if (index > 0) {
            setBusyKey(videoPromptBusyKey(node.id), '冷却 2s…')
            await sleep(2000)
          }
          await runOne(node)
        }
      })
      await Promise.all(workers)
      if (failed > 0) {
        setError(`分镜视频脚本：成功 ${done} 条，失败 ${failed} 条`)
      }
    } finally {
      setBusyKey(batchKey, '')
      for (const node of targets) {
        setBusyKey(videoPromptBusyKey(node.id), '')
      }
    }
  }

  const onGenerateVideo = async (node: Node<CanvasNodeData>) => {
    if (node.data.kind !== 'storyboard') return
    if (batchVideoProgress.running) {
      setError('批量生成进行中，请稍后再试单条生成')
      return
    }
    const allNodes = doc?.nodes || []
    const prompt = buildStoryboardVideoPrompt({
      title: node.data.title,
      body: node.data.body,
      videoPrompt: node.data.videoPrompt,
      data: node.data,
      nodes: allNodes,
      styleId: assetStyleId,
    })
    if (!prompt.trim()) {
      setError('请先填写分镜内容或视频提示词')
      return
    }
    const key = videoBusyKey(node.id)
    setError('')
    let lastErr: unknown
    for (let attempt = 1; attempt <= VIDEO_MAX_RETRIES; attempt++) {
      try {
        setBusyKey(
          key,
          attempt > 1 ? `第 ${attempt} 次重试·提交中…` : '提交视频任务…',
        )
        const firstFrame = node.data.imageUrl?.trim()
        const refs = getStoryboardRefImages(node.data, allNodes).slice(0, 5)
        const mode = firstFrame ? 'keyframe' : refs.length ? 'reference' : 'text'
        const created = await createCanvasVideo({
          prompt,
          mode,
          seconds: '5',
          aspectRatio: '9:16',
          firstFrame: mode === 'keyframe' ? firstFrame : undefined,
          images: mode === 'reference' ? refs : undefined,
        })
        if (!created.keyId) throw new Error('未返回 keyId，无法查询视频结果')
        patchNode(node.id, { videoId: created.videoId, videoKeyId: created.keyId })
        setBusyKey(key, attempt > 1 ? `第 ${attempt} 次重试·生成中…` : '视频生成中…')
        const done = await waitCanvasVideo(created.videoId, created.keyId, {
          intervalMs: VIDEO_POLL_INTERVAL_MS,
          onProgress: (status) => {
            if (typeof status.progress === 'number' && Number.isFinite(status.progress)) {
              const pct = Math.max(0, Math.min(100, Math.round(status.progress)))
              setBusyKey(
                key,
                attempt > 1 ? `第 ${attempt} 次重试·${pct}%` : `视频生成中 ${pct}%`,
              )
            }
          },
        })
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    videoId: created.videoId,
                    videoKeyId: created.keyId,
                    videoUrl: done.url,
                    videoPrompt: n.data.videoPrompt?.trim()
                      ? n.data.videoPrompt
                      : prompt,
                  },
                }
              : n,
          ),
        )
        setBusyKey(key, '')
        return
      } catch (err) {
        lastErr = err
        if (attempt < VIDEO_MAX_RETRIES) {
          const msg = err instanceof Error ? err.message : ''
          const waitMs = retryDelayForError(msg)
          setBusyKey(
            key,
            `失败，${waitMs / 1000}s 后重试（${attempt}/${VIDEO_MAX_RETRIES}）…`,
          )
          await sleep(waitMs)
          continue
        }
      }
    }
    setBusyKey(key, '')
    setError(lastErr instanceof Error ? lastErr.message : '视频生成失败')
  }

  const onGenerateAllStoryboardVideos = async (onlyIds?: string[]) => {
    if (batchVideoProgress.running) return
    if (!storyboards.length) {
      setError('请先生成或添加分镜')
      return
    }
    setActiveStep('storyboard')
    const snapshotNodes = doc?.nodes || []
    const indexMap = new Map(storyboards.map((n, i) => [n.id, i + 1]))
    const pool = onlyIds?.length
      ? storyboards.filter((n) => onlyIds.includes(n.id))
      : storyboards
    // 默认跳过已有成片；「重试失败项」强制再跑
    const targets = pool.filter((n) => {
      if (!onlyIds?.length && n.data.videoUrl?.trim()) return false
      const prompt = buildStoryboardVideoPrompt({
        title: n.data.title,
        body: n.data.body,
        videoPrompt: n.data.videoPrompt,
        data: n.data,
        nodes: snapshotNodes,
        styleId: assetStyleId,
      })
      return Boolean(prompt.trim())
    })
    if (!targets.length) {
      setError(
        onlyIds?.length
          ? '没有可重试的分镜'
          : '没有需要生成的分镜（缺少脚本/提示词，或视频已全部生成）',
      )
      return
    }

    const batchKey = 'gen-all-storyboard-video'
    const concurrency = VIDEO_BATCH_CONCURRENCY
    batchVideoStopRef.current = false
    setError('')
    setBatchVideoErrors([])
    setBatchVideoFailedIds([])
    setBatchVideoProgress({
      current: 0,
      total: targets.length,
      failed: 0,
      running: true,
      stopping: false,
    })
    setBusyKey(batchKey, `生成视频中 0/${targets.length}…`)
    for (const node of targets) {
      setBusyKey(videoBusyKey(node.id), '排队中…')
    }

    let done = 0
    let failed = 0
    const errors: string[] = []
    const failedIds: string[] = []

    const bumpProgress = () => {
      setBatchVideoProgress({
        current: done,
        total: targets.length,
        failed,
        running: true,
        stopping: batchVideoStopRef.current,
      })
      setBusyKey(
        batchKey,
        batchVideoStopRef.current
          ? `正在停止…${done}/${targets.length}`
          : `生成视频中 ${done}/${targets.length}${failed ? ` ·失败 ${failed}` : ''}…`,
      )
    }

    const runOneAttempt = async (node: Node<CanvasNodeData>, attempt: number) => {
      const key = videoBusyKey(node.id)
      setBusyKey(
        key,
        attempt > 1 ? `第 ${attempt} 次重试·提交中…` : '提交视频任务…',
      )
      const prompt = buildStoryboardVideoPrompt({
        title: node.data.title,
        body: node.data.body,
        videoPrompt: node.data.videoPrompt,
        data: node.data,
        nodes: snapshotNodes,
        styleId: assetStyleId,
      })
      const firstFrame = node.data.imageUrl?.trim()
      const refs = getStoryboardRefImages(node.data, snapshotNodes).slice(0, 5)
      const mode = firstFrame ? 'keyframe' : refs.length ? 'reference' : 'text'
      const created = await createCanvasVideo({
        prompt,
        mode,
        seconds: '5',
        aspectRatio: '9:16',
        firstFrame: mode === 'keyframe' ? firstFrame : undefined,
        images: mode === 'reference' ? refs : undefined,
      })
      if (!created.keyId) throw new Error('未返回 keyId，无法查询视频结果')
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  videoId: created.videoId,
                  videoKeyId: created.keyId,
                },
              }
            : n,
        ),
      )
      setBusyKey(key, attempt > 1 ? `第 ${attempt} 次重试·生成中…` : '视频生成中…')
      const result = await waitCanvasVideo(created.videoId, created.keyId, {
        intervalMs: VIDEO_POLL_INTERVAL_MS,
        onProgress: (status) => {
          if (typeof status.progress === 'number' && Number.isFinite(status.progress)) {
            const pct = Math.max(0, Math.min(100, Math.round(status.progress)))
            setBusyKey(
              key,
              attempt > 1
                ? `第 ${attempt} 次重试·${pct}%`
                : `视频生成中 ${pct}%`,
            )
          }
        },
      })
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  videoId: created.videoId,
                  videoKeyId: created.keyId,
                  videoUrl: result.url,
                  videoPrompt: n.data.videoPrompt?.trim() ? n.data.videoPrompt : prompt,
                },
              }
            : n,
        ),
      )
    }

    const runOne = async (node: Node<CanvasNodeData>) => {
      const key = videoBusyKey(node.id)
      const shotNo = indexMap.get(node.id) || '?'
      try {
        for (let attempt = 1; attempt <= VIDEO_MAX_RETRIES; attempt++) {
          if (batchVideoStopRef.current) throw new Error('已停止')
          try {
            await runOneAttempt(node, attempt)
            return
          } catch (err) {
            const msg = err instanceof Error ? err.message : '生成失败'
            if (batchVideoStopRef.current || msg === '已停止' || msg === '已取消') {
              throw err
            }
            if (attempt < VIDEO_MAX_RETRIES) {
              const waitMs = retryDelayForError(msg)
              setBusyKey(
                key,
                `失败，${waitMs / 1000}s 后重试（${attempt}/${VIDEO_MAX_RETRIES}）…`,
              )
              await sleep(waitMs)
              continue
            }
            throw err
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '生成失败'
        if (msg !== '已停止' && msg !== '已取消') {
          failed += 1
          failedIds.push(node.id)
          errors.push(`#${shotNo} ${node.data.title || ''}：${msg}`.trim())
          setBatchVideoErrors([...errors])
          setBatchVideoFailedIds([...failedIds])
        }
      } finally {
        setBusyKey(key, '')
        done += 1
        bumpProgress()
      }
    }

    try {
      let next = 0
      const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
        while (next < targets.length) {
          if (batchVideoStopRef.current) break
          const index = next
          next += 1
          const node = targets[index]
          if (!node) continue
          if (index > 0) {
            setBusyKey(videoBusyKey(node.id), `冷却 ${VIDEO_BATCH_GAP_MS / 1000}s…`)
            await sleep(VIDEO_BATCH_GAP_MS)
            if (batchVideoStopRef.current) break
          }
          await runOne(node)
        }
      })
      await Promise.allSettled(workers)

      // 未跑到的排队项清掉 busy
      for (const node of targets) {
        setBusyKey(videoBusyKey(node.id), '')
      }

      if (batchVideoStopRef.current) {
        setError(`批量生成已停止：完成 ${done - failed}/${targets.length}，失败 ${failed}`)
      } else if (failed > 0) {
        setError(
          `分镜视频：成功 ${targets.length - failed} 个，失败 ${failed} 个（可点「重试失败项」）`,
        )
      } else {
        setError('')
      }
    } finally {
      setBusyKey(batchKey, '')
      setBatchVideoProgress((prev) => ({
        ...prev,
        current: done,
        failed,
        running: false,
        stopping: false,
      }))
      batchVideoStopRef.current = false
    }
  }

  const onStopBatchStoryboardVideos = () => {
    if (!batchVideoProgress.running) return
    batchVideoStopRef.current = true
    setBatchVideoProgress((prev) => ({ ...prev, stopping: true }))
    setBusyKey('gen-all-storyboard-video', '正在停止…')
  }

  const renderAssetSection = (
    kind: 'character' | 'scene' | 'prop',
    anchor: string,
    title: string,
    list: Node<CanvasNodeData>[],
  ) => (
    <section id={anchor} className="section card">
      <div className="section-head">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-desc">
            可从剧本自动提取，也可手动新增后补图。生图为三视图，风格：{assetStyle.label}。
          </p>
        </div>
        <div className="section-actions">
          <button type="button" className="btn" onClick={() => addAsset(kind)}>
            添加{kindMeta(kind).label}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="empty-tip">暂无{kindMeta(kind).label}，请先提取或手动添加。</p>
      ) : (
        <div className="asset-grid">
          {list.map((node) => {
            const history = node.data.imageHistory || []
            return (
              <article key={node.id} id={`item-${node.id}`} className="asset-card">
                <div className="asset-cover">
                  {node.data.imageUrl ? (
                    <button
                      type="button"
                      className="cover-preview"
                      onClick={() => setPreviewUrl(node.data.imageUrl || '')}
                      title="点击预览"
                    >
                      <img src={node.data.imageUrl} alt="" />
                      <span className="cover-hint">预览</span>
                    </button>
                  ) : (
                    <span>暂无图</span>
                  )}
                </div>
                <div className="asset-body">
                  <input
                    className="asset-title"
                    value={node.data.title}
                    onChange={(e) => patchNode(node.id, { title: e.target.value })}
                    aria-label={`${kindMeta(kind).label}名称`}
                  />
                  <textarea
                    className="asset-desc"
                    rows={3}
                    value={node.data.body}
                    onChange={(e) => patchNode(node.id, { body: e.target.value })}
                    aria-label={`${kindMeta(kind).label}描述`}
                  />
                  {history.length > 0 ? (
                    <div className="history-row">
                      <span className="history-label">历史</span>
                      <div className="history-thumbs">
                        {history.map((url) => (
                          <button
                            key={url}
                            type="button"
                            className="history-thumb"
                            title="点击恢复；双击预览"
                            onClick={() => onRestoreImage(node, url)}
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              setPreviewUrl(url)
                            }}
                          >
                            <img src={url} alt="" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="asset-ops">
                    <button
                      type="button"
                      className="btn tiny primary"
                      disabled={Boolean(busy[node.id] || busy['gen-all-assets'])}
                      onClick={() => void onGenerateImage(node)}
                    >
                      {busy[node.id] || (node.data.imageUrl ? '再生成' : 'AI 生成图')}
                    </button>
                    <button
                      type="button"
                      className="btn tiny danger"
                      disabled={Boolean(busy['gen-all-assets'])}
                      onClick={() => removeNode(node.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <Style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
      />

      <header className="header">
        <div className="header-inner">
          <Link to="/canvas/history" className="logo" aria-label="铭AI短剧 无限画布">
            <span className="logo-mark" aria-hidden="true">
              剧
            </span>
            <span className="logo-text">
              <span className="logo-main">铭AI短剧</span>
              <span className="logo-sub">列表模式</span>
            </span>
          </Link>

          <span className="crumb">/</span>

          <input
            ref={titleRef}
            className="title-input"
            key={item?.id || 'loading'}
            defaultValue={item?.title || (loading ? '加载中…' : '未命名短剧')}
            disabled={!item}
            onBlur={onTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            aria-label="项目标题"
          />

          {saveState === 'saving' ? <span className="status saving">保存中…</span> : null}
          {saveState === 'saved' ? <span className="status saved">已保存</span> : null}
          {saveState === 'error' ? <span className="status error">保存失败</span> : null}

          <div className="header-actions">
            <button
              type="button"
              className="canvas-btn"
              disabled={!item}
              onClick={() => navigate(`/canvas/edit/${id}/canvas`)}
            >
              画布模式
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="page-state">正在加载项目…</div>
      ) : !doc ? (
        <div className="page-state">
          <p>{error || '项目不存在或已删除'}</p>
          <Link to="/canvas/history">返回历史列表</Link>
        </div>
      ) : (
        <div className="shell">
          <nav className="steps" aria-label="制作步骤">
            <div className="steps-title">制作步骤</div>
            {topNavSteps.map((step, idx) => {
              const flowKey =
                step.key === 'script'
                  ? 'script'
                  : step.key === 'assets'
                    ? 'assets'
                    : step.key === 'sb'
                      ? 'storyboard'
                      : null
              const flow = flowKey
                ? flowSteps.find((s) => s.key === flowKey)
                : null
              const isActive = flowKey === activeStep
              const locked = Boolean(flow && !flow.unlocked)
              const assetsExpanded = activeStep === 'assets'
              return (
                <div key={step.key} className="step-block">
                  <button
                    type="button"
                    className={`step status-${step.status}${
                      isActive ? ' active' : ''
                    }${locked ? ' locked' : ''}`}
                    disabled={locked}
                    title={
                      locked
                        ? '请先完成上一步'
                        : flow?.desc || step.label
                    }
                    onClick={() => {
                      if (!flowKey || locked) return
                      goStep(flowKey)
                    }}
                  >
                    <span className="step-index">
                      {step.status === 'done' ? '✓' : idx + 1}
                    </span>
                    <span className="step-label">{step.label}</span>
                    {step.count > 0 ? (
                      <span className="step-count">{step.count}</span>
                    ) : null}
                    {step.key === 'assets' ? (
                      <span
                        className={`step-fold ${assetsExpanded ? 'open' : ''}`}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    ) : null}
                  </button>

                  {step.key === 'assets' && assetsExpanded ? (
                    <div className="step-children">
                      {assetNavSteps.map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          className={`step child status-${child.status}`}
                          onClick={() => scrollToAnchor(child.anchor)}
                        >
                          <span className="step-index">
                            {child.status === 'done' ? '✓' : '·'}
                          </span>
                          <span className="step-label">{child.label}</span>
                          {child.count > 0 ? (
                            <span className="step-count">{child.count}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {activeStep === 'storyboard' && storyboards.length > 0 ? (
              <div className="sub-list">
                <div className="sub-title">分镜列表</div>
                {storyboards.map((sb, i) => (
                  <button
                    key={sb.id}
                    type="button"
                    className="sub-item"
                    onClick={() => scrollToAnchor(`item-${sb.id}`)}
                  >
                    {i + 1}. {sb.data.title || '分镜'}
                  </button>
                ))}
              </div>
            ) : null}
          </nav>

          <main className="main">
            {error ? <p className="banner-error">{error}</p> : null}

            {activeStep === 'script' ? (
            <section id="anchor-script" className="fold-group open">
              <div className="fold-group-bar">
                <div className="fold-group-titles">
                  <h2 className="section-title">1. 故事剧本</h2>
                  <p className="section-desc">
                    先写梗概，再生成完整剧本，作为后续素材与分镜的起点。
                  </p>
                </div>
                <div className="section-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={Boolean(busy.script)}
                    onClick={() => void onGenerateScript()}
                  >
                    {busy.script || 'AI 生成剧本'}
                  </button>
                </div>
              </div>

              <div className="fold-group-body plain">
                <label className="field">
                  <span>故事梗概</span>
                  <textarea
                    rows={3}
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    placeholder="例如：雨夜巷口，女主撑伞停步，霓虹在水洼里碎成光点…"
                  />
                </label>

                <label className="field">
                  <span>剧本正文</span>
                  <textarea
                    rows={12}
                    value={scriptText}
                    onChange={(e) => {
                      const node = ensureScriptNode()
                      patchNode(node.id, { body: e.target.value })
                    }}
                    placeholder="剧本内容会显示在这里，也可直接手写编辑。"
                  />
                </label>
              </div>

              <div className="step-nav">
                <span />
                <button
                  type="button"
                  className="btn primary"
                  disabled={!nextFlow?.unlocked}
                  title={
                    !nextFlow?.unlocked
                      ? '请先完成当前步骤（剧本正文需足够完整）'
                      : undefined
                  }
                  onClick={() => nextFlow?.unlocked && goStep(nextFlow.key)}
                >
                  下一步：资产情况 →
                </button>
              </div>
            </section>
            ) : null}

            {activeStep === 'assets' ? (
            <section id="anchor-assets" className="fold-group open">
              <div className="fold-group-bar">
                <div className="fold-group-titles">
                  <h2 className="section-title">2. 资产情况</h2>
                  <p className="section-desc">
                    角色、道具与场景，可从剧本提取后批量补图。
                    {assetTotal > 0 ? ` 共 ${assetTotal} 项` : ''}
                  </p>
                </div>
                <div className="section-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={Boolean(
                      busy['extract-all'] ||
                        busy['extract-character'] ||
                        busy['extract-prop'] ||
                        busy['extract-scene'],
                    )}
                    onClick={() => void onExtractAllAssets()}
                  >
                    {busy['extract-all'] || '一键提取所有资产'}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={assetTotal === 0 || Boolean(busy['gen-all-assets'])}
                    onClick={() => void onGenerateAllAssetImages()}
                  >
                    {busy['gen-all-assets'] || '一键生成所有图片'}
                  </button>
                </div>
              </div>

              <div className="fold-group-body">
                <div className="style-panel">
                  <div className="style-panel-head">
                    <div>
                      <div className="style-panel-title">统一视觉风格</div>
                      <p className="style-panel-desc">
                        下方角色 / 道具 / 场景生图都会追加该风格提示词，并输出三视图设定。
                      </p>
                    </div>
                    <span className="style-current">{assetStyle.label}</span>
                  </div>
                  <div className="style-chips" role="listbox" aria-label="资产风格">
                    {ASSET_STYLES.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        role="option"
                        aria-selected={style.id === assetStyleId}
                        className={`style-chip ${style.id === assetStyleId ? 'active' : ''}`}
                        onClick={() => setAssetStyle(style.id)}
                        title={style.prompt}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
                {renderAssetSection('character', 'anchor-characters', '角色', characters)}
                {renderAssetSection('prop', 'anchor-props', '道具', props)}
                {renderAssetSection('scene', 'anchor-scenes', '场景', scenes)}
              </div>

              <div className="step-nav">
                <button type="button" className="btn" onClick={() => goStep('script')}>
                  ← 上一步
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!nextFlow?.unlocked}
                  title={
                    !nextFlow?.unlocked
                      ? '请先完成当前步骤（所有资产需生成图片）'
                      : undefined
                  }
                  onClick={() => nextFlow?.unlocked && goStep(nextFlow.key)}
                >
                  下一步：分镜脚本 →
                </button>
              </div>
            </section>
            ) : null}

            {activeStep === 'storyboard' ? (
            <section id="anchor-storyboard" className="fold-group open">
              <div className="fold-group-bar">
                <div className="fold-group-titles">
                  <h2 className="section-title">3. 分镜脚本</h2>
                  <p className="section-desc">
                    按镜头拆解剧本，并为每镜关联角色 / 场景 / 道具；生成分镜图时会带入资产参考图。
                    {storyboards.length > 0 ? ` 共 ${storyboards.length} 镜` : ''}
                  </p>
                </div>
                <div className="section-actions">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={Boolean(busy.storyboard)}
                      onClick={() => void onGenerateStoryboards()}
                    >
                      {busy.storyboard ||
                        (storyboards.length > 0 ? '重新生成分镜' : 'AI 生成分镜')}
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={
                        storyboards.length === 0 || Boolean(busy['gen-all-storyboard'])
                      }
                      onClick={() => void onGenerateAllStoryboardImages()}
                    >
                      {busy['gen-all-storyboard'] || '一键生成所有分镜图'}
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={
                        storyboards.length === 0 ||
                        Boolean(busy['gen-all-storyboard-vprompt'])
                      }
                      onClick={() => void onGenerateAllStoryboardVideoPrompts()}
                    >
                      {busy['gen-all-storyboard-vprompt'] || '一键生成分镜视频脚本'}
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={
                        storyboards.length === 0 || batchVideoProgress.running
                      }
                      onClick={() => void onGenerateAllStoryboardVideos()}
                    >
                      {batchVideoProgress.running
                        ? busy['gen-all-storyboard-video'] || '生成视频中…'
                        : '一键生成分镜视频'}
                    </button>
                    {batchVideoProgress.running ? (
                      <button
                        type="button"
                        className="btn danger"
                        onClick={onStopBatchStoryboardVideos}
                        disabled={batchVideoProgress.stopping}
                      >
                        {batchVideoProgress.stopping ? '正在停止…' : '停止视频'}
                      </button>
                    ) : null}
                    {!batchVideoProgress.running && batchVideoFailedIds.length > 0 ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void onGenerateAllStoryboardVideos(batchVideoFailedIds)}
                      >
                        重试失败项（{batchVideoFailedIds.length}）
                      </button>
                    ) : null}
                    <button type="button" className="btn" onClick={() => addAsset('storyboard')}>
                      添加分镜
                    </button>
                  </div>
              </div>

              {batchVideoProgress.running || batchVideoErrors.length > 0 ? (
                <div className="batch-status">
                  {batchVideoProgress.running || batchVideoProgress.total > 0 ? (
                    <div className="batch-progress">
                      <span>
                        批量生成分镜视频：{batchVideoProgress.current}/
                        {batchVideoProgress.total}
                      </span>
                      {batchVideoProgress.failed > 0 ? (
                        <span className="batch-failed">
                          {batchVideoProgress.failed} 条失败
                        </span>
                      ) : null}
                      {batchVideoProgress.stopping ? (
                        <span className="batch-stopping">（正在停止…）</span>
                      ) : null}
                      {batchVideoProgress.running ? (
                        <span className="batch-concurrency">串行 · 查询间隔 {VIDEO_POLL_INTERVAL_MS / 1000}s</span>
                      ) : null}
                    </div>
                  ) : null}
                  {batchVideoProgress.running && batchVideoProgress.total > 0 ? (
                    <div className="batch-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (batchVideoProgress.current / Math.max(1, batchVideoProgress.total)) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}
                  {batchVideoErrors.length > 0 ? (
                    <div className="batch-error-log">
                      <div className="batch-error-title">分镜视频生成失败记录：</div>
                      {batchVideoErrors.map((line) => (
                        <div key={line} className="batch-error-line">
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="fold-group-body plain">
                  {storyboards.length === 0 ? (
                    <p className="empty-tip">暂无分镜，请先生成或手动添加。</p>
                  ) : (
                    <div className="sb-list">
                      {storyboards.map((node, index) => {
                        const linked = getStoryboardLinkedAssets(node.data, doc?.nodes || [])
                        const charIds = normalizeIdList(node.data.characterIds)
                        const propIds = normalizeIdList(node.data.propIds)
                        return (
                        <article key={node.id} id={`item-${node.id}`} className="sb-card">
                          <header className="sb-head">
                            <span className="sb-index">#{index + 1}</span>
                            <input
                              className="asset-title"
                              value={node.data.title}
                              onChange={(e) => patchNode(node.id, { title: e.target.value })}
                              aria-label="分镜标题"
                            />
                            <div className="asset-ops">
                              <button
                                type="button"
                                className="btn tiny primary"
                                disabled={Boolean(
                                  busy[node.id] ||
                                    busy['gen-all-storyboard'] ||
                                    batchVideoProgress.running ||
                                    busy[videoBusyKey(node.id)],
                                )}
                                onClick={() => void onGenerateImage(node)}
                              >
                                {busy[node.id] || (node.data.imageUrl ? '再生成图' : 'AI 生成分镜图')}
                              </button>
                              <button
                                type="button"
                                className="btn tiny primary"
                                disabled={Boolean(
                                  busy[videoBusyKey(node.id)] ||
                                    batchVideoProgress.running ||
                                    busy[node.id],
                                )}
                                onClick={() => void onGenerateVideo(node)}
                              >
                                {busy[videoBusyKey(node.id)] ||
                                  (node.data.videoUrl ? '再生成视频' : 'AI 生成分镜视频')}
                              </button>
                              <button
                                type="button"
                                className="btn tiny danger"
                                disabled={Boolean(
                                  busy['gen-all-storyboard'] ||
                                    batchVideoProgress.running ||
                                    busy[videoBusyKey(node.id)],
                                )}
                                onClick={() => removeNode(node.id)}
                              >
                                删除
                              </button>
                            </div>
                          </header>

                          <div className="sb-link-row">
                            <div className="sb-link-field">
                              <span>角色</span>
                              <div className="sb-chip-list">
                                {characters.length === 0 ? (
                                  <span className="sb-chip-empty">请先添加角色</span>
                                ) : (
                                  characters.map((c) => {
                                    const on = charIds.includes(c.id)
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className={`sb-chip ${on ? 'on' : ''}`}
                                        onClick={() => toggleStoryboardCharacter(node.id, c.id)}
                                      >
                                        {c.data.title || '未命名'}
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                            <label className="sb-link-field">
                              <span>场景</span>
                              <select
                                className="sb-select single"
                                value={node.data.sceneId || ''}
                                onChange={(e) =>
                                  patchStoryboardLinks(node.id, {
                                    sceneId: e.target.value || null,
                                  })
                                }
                                aria-label="关联场景"
                              >
                                <option value="">未选择</option>
                                {scenes.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.data.title || '未命名场景'}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="sb-link-field">
                              <span>道具</span>
                              <div className="sb-chip-list">
                                {props.length === 0 ? (
                                  <span className="sb-chip-empty">请先添加道具</span>
                                ) : (
                                  props.map((p) => {
                                    const on = propIds.includes(p.id)
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        className={`sb-chip ${on ? 'on' : ''}`}
                                        onClick={() => toggleStoryboardProp(node.id, p.id)}
                                      >
                                        {p.data.title || '未命名'}
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          {(linked.scene ||
                            linked.characters.length > 0 ||
                            linked.props.length > 0) && (
                            <div className="sb-thumbs">
                              {linked.scene ? (
                                <div className="sb-thumb-row">
                                  <span className="sb-thumb-label">场景</span>
                                  <div className="sb-thumb-list">
                                    <button
                                      type="button"
                                      className={`sb-thumb ${linked.scene.data.imageUrl ? 'has-img' : ''}`}
                                      title={linked.scene.data.title}
                                      onClick={() =>
                                        linked.scene?.data.imageUrl &&
                                        setPreviewUrl(linked.scene.data.imageUrl)
                                      }
                                    >
                                      {linked.scene.data.imageUrl ? (
                                        <img src={linked.scene.data.imageUrl} alt="" />
                                      ) : (
                                        <span>{(linked.scene.data.title || '?')[0]}</span>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {linked.characters.length > 0 ? (
                                <div className="sb-thumb-row">
                                  <span className="sb-thumb-label">角色</span>
                                  <div className="sb-thumb-list">
                                    {linked.characters.map((c) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className={`sb-thumb ${c.data.imageUrl ? 'has-img' : ''}`}
                                        title={`${c.data.title}（点击取消关联）`}
                                        onClick={() => toggleStoryboardCharacter(node.id, c.id)}
                                        onDoubleClick={(e) => {
                                          e.preventDefault()
                                          if (c.data.imageUrl) setPreviewUrl(c.data.imageUrl)
                                        }}
                                      >
                                        {c.data.imageUrl ? (
                                          <img src={c.data.imageUrl} alt="" />
                                        ) : (
                                          <span>{(c.data.title || '?')[0]}</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {linked.props.length > 0 ? (
                                <div className="sb-thumb-row">
                                  <span className="sb-thumb-label">道具</span>
                                  <div className="sb-thumb-list">
                                    {linked.props.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        className={`sb-thumb ${p.data.imageUrl ? 'has-img' : ''}`}
                                        title={`${p.data.title}（点击取消关联）`}
                                        onClick={() => toggleStoryboardProp(node.id, p.id)}
                                        onDoubleClick={(e) => {
                                          e.preventDefault()
                                          if (p.data.imageUrl) setPreviewUrl(p.data.imageUrl)
                                        }}
                                      >
                                        {p.data.imageUrl ? (
                                          <img src={p.data.imageUrl} alt="" />
                                        ) : (
                                          <span>{(p.data.title || '?')[0]}</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="sb-media-row">
                            <section className="sb-panel sb-panel-script">
                              <div className="sb-panel-head">
                                <span className="sb-media-label">分镜脚本</span>
                              </div>
                              <textarea
                                className="sb-panel-text"
                                rows={8}
                                value={node.data.body}
                                onChange={(e) => patchNode(node.id, { body: e.target.value })}
                                aria-label="分镜内容"
                              />
                            </section>

                            <section className="sb-panel sb-panel-image">
                              <div className="sb-panel-head">
                                <span className="sb-media-label">分镜图</span>
                              </div>
                              <div className="sb-frame-wrap">
                                <div className="sb-frame">
                                  {node.data.imageUrl ? (
                                    <button
                                      type="button"
                                      className="cover-preview"
                                      onClick={() => setPreviewUrl(node.data.imageUrl || '')}
                                      title="点击预览"
                                    >
                                      <img src={node.data.imageUrl} alt="" />
                                      <span className="cover-hint">预览</span>
                                    </button>
                                  ) : (
                                    <span className="sb-media-empty">暂无分镜图</span>
                                  )}
                                </div>
                              </div>
                              {(node.data.imageHistory || []).length > 0 ? (
                                <div className="history-row">
                                  <span className="history-label">历史图</span>
                                  <div className="history-thumbs">
                                    {(node.data.imageHistory || []).map((url) => (
                                      <button
                                        key={url}
                                        type="button"
                                        className="history-thumb"
                                        title="点击恢复；双击预览"
                                        onClick={() => onRestoreImage(node, url)}
                                        onDoubleClick={(e) => {
                                          e.preventDefault()
                                          setPreviewUrl(url)
                                        }}
                                      >
                                        <img src={url} alt="" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </section>

                            <section className="sb-panel sb-panel-vprompt">
                              <div className="sb-panel-head">
                                <span className="sb-media-label">视频脚本</span>
                                <button
                                  type="button"
                                  className="btn tiny"
                                  disabled={Boolean(
                                    busy[videoPromptBusyKey(node.id)] ||
                                      busy['gen-all-storyboard-vprompt'] ||
                                      batchVideoProgress.running ||
                                      busy[videoBusyKey(node.id)],
                                  )}
                                  onClick={() => void onGenerateVideoPrompt(node)}
                                >
                                  {busy[videoPromptBusyKey(node.id)] ||
                                    (node.data.videoPrompt ? '再生成' : 'AI 生成')}
                                </button>
                              </div>
                              <textarea
                                className="sb-panel-text"
                                rows={8}
                                value={node.data.videoPrompt || ''}
                                placeholder="视频提示词（可点上方生成，或手动填写）"
                                onChange={(e) =>
                                  patchNode(node.id, { videoPrompt: e.target.value })
                                }
                                aria-label="分镜视频提示词"
                              />
                            </section>

                            <section className="sb-panel sb-panel-video">
                              <div className="sb-panel-head">
                                <span className="sb-media-label">视频</span>
                              </div>
                              <div className="sb-frame-wrap">
                                <div className="sb-frame sb-video-player">
                                  {node.data.videoUrl ? (
                                    <video
                                      src={node.data.videoUrl}
                                      controls
                                      playsInline
                                      preload="metadata"
                                    />
                                  ) : (
                                    <span className="sb-media-empty">
                                      {busy[videoBusyKey(node.id)] || '暂无视频'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </section>
                          </div>
                        </article>
                        )
                      })}
                    </div>
                  )}
                </div>

              <div className="step-nav">
                <button type="button" className="btn" onClick={() => goStep('assets')}>
                  ← 上一步
                </button>
                <button
                  type="button"
                  className="canvas-btn"
                  onClick={() => navigate(`/canvas/edit/${id}/canvas`)}
                >
                  进入画布模式
                </button>
              </div>
            </section>
            ) : null}

            <div className="footer-switch">
              <p>列表步骤完成后，可切换到画布自由编排节点与连线。</p>
              <button
                type="button"
                className="canvas-btn"
                onClick={() => navigate(`/canvas/edit/${id}/canvas`)}
              >
                进入画布模式
              </button>
            </div>
          </main>
        </div>
      )}

      {previewUrl ? (
        <div
          className="preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setPreviewUrl('')}
        >
          <button
            type="button"
            className="preview-close"
            onClick={() => setPreviewUrl('')}
            aria-label="关闭预览"
          >
            关闭
          </button>
          <img
            className="preview-image"
            src={previewUrl}
            alt="预览"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.div`
  --bg: #0f0f12;
  --card: #18181b;
  --ink: #e4e4e7;
  --muted: #a1a1aa;
  --faint: #71717a;
  --line: #27272a;
  --accent: #3dd6c6;
  --display: 'Syne', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

  min-height: 100dvh;
  height: 100dvh;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  display: flex;
  flex-direction: column;

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .header {
    position: relative;
    z-index: 30;
    flex: none;
    border-bottom: 1px solid var(--line);
    background: rgba(18, 18, 20, 0.92);
    backdrop-filter: blur(10px);
  }

  .header-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    min-height: 52px;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    flex: none;
  }

  .logo-mark {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-family: var(--display);
    font-weight: 800;
    font-size: 0.82rem;
    color: #061018;
    background: linear-gradient(135deg, var(--accent), #7ef0df 70%);
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  .logo-main {
    font-size: 13px;
    font-weight: 700;
  }

  .logo-sub {
    font-size: 10px;
    color: #5eead4;
  }

  .crumb {
    color: var(--faint);
  }

  .title-input {
    min-width: 0;
    max-width: 260px;
    flex: 1;
    height: 32px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 14px;
    outline: none;

    &:hover:not(:disabled),
    &:focus {
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.03);
      color: #fafafa;
    }
  }

  .status {
    font-size: 12px;
  }
  .status.saving {
    color: #60a5fa;
  }
  .status.saved {
    color: #34d399;
  }
  .status.error {
    color: #f87171;
  }

  .header-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .canvas-btn {
    border: 1px solid rgba(61, 214, 198, 0.4);
    background: rgba(61, 214, 198, 0.12);
    color: #5eead4;
    border-radius: 8px;
    padding: 7px 12px;
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgba(61, 214, 198, 0.2);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-state {
    padding: 4rem 1rem;
    text-align: center;
    color: var(--muted);

    a {
      color: var(--accent);
    }
  }

  .shell {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .steps {
    align-self: stretch;
    height: 100%;
    min-height: 0;
    overflow: auto;
    border-right: 1px solid var(--line);
    background: #121214;
    padding: 14px 10px;
  }

  .steps-title {
    font-size: 12px;
    color: var(--faint);
    margin: 0 8px 10px;
  }

  .step-block {
    margin-bottom: 4px;
  }

  .step {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 0;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    text-align: left;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.04);
    }

    &.active {
      background: rgba(61, 214, 198, 0.1);
    }

    &.locked {
      opacity: 0.42;
      cursor: not-allowed;
    }

    &.child {
      padding: 6px 8px 6px 18px;
      margin-bottom: 2px;

      .step-label {
        font-size: 12px;
      }

      .step-index {
        width: 18px;
        height: 18px;
        font-size: 10px;
      }
    }
  }

  .step-children {
    padding: 2px 0 4px;
  }

  .step-fold {
    font-size: 12px;
    color: var(--faint);
    transition: transform 0.18s ease;
    flex: none;

    &.open {
      transform: rotate(0deg);
    }

    &:not(.open) {
      transform: rotate(-90deg);
    }
  }

  .step-index {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 11px;
    border: 1px solid var(--line);
    color: var(--muted);
    flex: none;
  }

  .step.status-done .step-index {
    background: rgba(61, 214, 198, 0.18);
    border-color: rgba(61, 214, 198, 0.45);
    color: #5eead4;
  }

  .step.status-partial .step-index {
    border-color: rgba(251, 191, 36, 0.5);
    color: #fbbf24;
  }

  .step-label {
    flex: 1;
    font-size: 13px;
  }

  .step-count {
    font-size: 11px;
    color: var(--faint);
  }

  .sub-list {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .sub-title {
    font-size: 11px;
    color: var(--faint);
    margin: 0 8px 8px;
  }

  .sub-item {
    width: 100%;
    display: block;
    border: none;
    background: transparent;
    color: var(--muted);
    text-align: left;
    font: inherit;
    font-size: 12px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.04);
    }
  }

  .step-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }

  .main {
    min-width: 0;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 18px 20px 48px;
  }

  .banner-error {
    margin: 0 0 12px;
    padding: 0.7rem 0.9rem;
    border-radius: 10px;
    border: 1px solid rgba(253, 164, 164, 0.35);
    background: rgba(253, 164, 164, 0.08);
    color: #fda4a4;
    font-size: 0.875rem;
  }

  .section.card {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--card);
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  .fold-group {
    margin-bottom: 16px;
    border-radius: 14px;
    border: 1px solid rgba(61, 214, 198, 0.22);
    background: linear-gradient(180deg, rgba(61, 214, 198, 0.06), rgba(24, 24, 27, 0.4));
    overflow: hidden;
  }

  .fold-group-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
  }

  .fold-group-head {
    flex: 1;
    min-width: 200px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;

    &:hover .section-title {
      color: var(--accent);
    }
  }

  .fold-group-titles {
    flex: 1;
    min-width: 200px;
  }

  .fold-group-chevron {
    flex: none;
    width: 28px;
    height: 28px;
    margin-top: 2px;
    border-radius: 8px;
    border: 1px solid var(--line);
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 14px;
    transition: transform 0.18s ease;

    &:not(.open) {
      transform: rotate(-90deg);
    }
  }

  .fold-group-body {
    padding: 0 12px 12px;
    display: grid;
    gap: 12px;

    &.plain {
      padding: 0 16px 16px;
    }

    .section.card {
      margin-bottom: 0;
      background: rgba(24, 24, 27, 0.92);
    }

    .sb-list {
      display: grid;
      gap: 12px;
    }
  }

  .section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 14px;
    min-width: 0;

    > div:first-child {
      flex: 1;
      min-width: 0;
    }
  }

  .section-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
  }

  .section-desc {
    margin: 6px 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .section-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex: none;
    max-width: 100%;
  }

  .btn {
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
    color: var(--ink);
    border-radius: 8px;
    padding: 7px 12px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: rgba(61, 214, 198, 0.4);
      color: var(--accent);
    }

    &:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    &.primary {
      border-color: rgba(61, 214, 198, 0.4);
      background: rgba(61, 214, 198, 0.12);
      color: #5eead4;
    }

    &.danger {
      border-color: rgba(253, 164, 164, 0.45);
      background: rgba(253, 164, 164, 0.1);
      color: #fda4a4;
    }

    &.danger:hover:not(:disabled) {
      color: #fecaca;
      border-color: rgba(253, 164, 164, 0.65);
    }

    &.tiny {
      padding: 5px 8px;
      font-size: 11px;
    }
  }

  .batch-status {
    margin: 0 16px 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(61, 214, 198, 0.25);
    background: rgba(61, 214, 198, 0.06);
    display: grid;
    gap: 8px;
  }

  .batch-progress {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--ink);
  }

  .batch-failed {
    color: #fda4a4;
  }

  .batch-stopping {
    color: #fbbf24;
  }

  .batch-concurrency {
    color: var(--faint);
  }

  .batch-bar {
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2dd4bf, #5eead4);
      transition: width 0.25s ease;
    }
  }

  .batch-error-log {
    display: grid;
    gap: 4px;
    max-height: 140px;
    overflow: auto;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .batch-error-title {
    font-size: 12px;
    font-weight: 650;
    color: #fda4a4;
  }

  .batch-error-line {
    font-size: 11px;
    line-height: 1.45;
    color: var(--muted);
    word-break: break-word;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--muted);
    min-width: 0;
    max-width: 100%;

    textarea {
      width: 100%;
      max-width: 100%;
      resize: vertical;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.25);
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      line-height: 1.6;
      padding: 10px 12px;
      outline: none;

      &:focus {
        border-color: rgba(61, 214, 198, 0.45);
      }
    }
  }

  .empty-tip {
    margin: 0;
    padding: 18px;
    border-radius: 10px;
    border: 1px dashed var(--line);
    color: var(--muted);
    font-size: 0.9rem;
    text-align: center;
  }

  .asset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .asset-card,
  .sb-card {
    gap: 10px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.02);
  }

  .asset-card {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
  }

  .sb-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
  }

  .sb-head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

    .asset-title {
      flex: 1;
      min-width: 0;
      margin-bottom: 0;
    }

    .asset-ops {
      flex: none;
      margin-top: 0;
    }
  }

  .sb-media-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    align-items: stretch;
  }

  .sb-panel-text {
    width: 100%;
    flex: 1;
    min-height: 160px;
    margin: 0;
    resize: vertical;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.28);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    line-height: 1.65;
    padding: 10px 12px;
    outline: none;

    &:focus {
      border-color: rgba(61, 214, 198, 0.45);
    }
  }

  .sb-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.22);
  }

  .sb-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .asset-cover,
  .sb-cover,
  .sb-video {
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.28);
    overflow: hidden;
    color: var(--faint);
    font-size: 12px;
  }

  .asset-cover {
    aspect-ratio: 16 / 10;
    display: grid;
    place-items: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .sb-media-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  .sb-video-head {
    .btn.tiny {
      flex: none;
    }
  }

  .sb-media-empty {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 120px;
    padding: 12px;
    text-align: center;
    color: var(--faint);
    font-size: 12px;
  }

  .sb-frame-wrap {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    flex: 1;
  }

  .sb-frame {
    position: relative;
    width: min(100%, 200px);
    aspect-ratio: 9 / 16;
    max-height: 380px;
    border-radius: 12px;
    overflow: hidden;
    background: #0a0a0c;
    border: 1px solid var(--line);
    display: grid;
    place-items: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);

    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #000;
    }
  }

  .sb-video-prompt {
    width: 100%;
    resize: vertical;
    min-height: 72px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.35);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    line-height: 1.55;
    padding: 8px 10px;
    outline: none;

    &:focus {
      border-color: rgba(61, 214, 198, 0.45);
    }

    &::placeholder {
      color: var(--faint);
    }
  }

  .cover-preview {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    cursor: zoom-in;
    display: block;

    img {
      display: block;
    }

    .cover-hint {
      position: absolute;
      right: 6px;
      bottom: 6px;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.55);
      color: #e4e4e7;
      font-size: 10px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    &:hover .cover-hint {
      opacity: 1;
    }
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    min-width: 0;
  }

  .history-label {
    flex: none;
    font-size: 11px;
    color: var(--faint);
  }

  .history-thumbs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .history-thumb {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 6px;
    border: 1px solid var(--line);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    &:hover {
      border-color: rgba(61, 214, 198, 0.55);
    }
  }

  .style-panel {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(24, 24, 27, 0.92);
  }

  .style-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .style-panel-title {
    font-size: 13px;
    font-weight: 650;
  }

  .style-panel-desc {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }

  .style-current {
    flex: none;
    font-size: 11px;
    color: #5eead4;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(61, 214, 198, 0.35);
    background: rgba(61, 214, 198, 0.1);
  }

  .style-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .style-chip {
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.03);
    color: var(--muted);
    border-radius: 999px;
    padding: 6px 12px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;

    &:hover {
      color: var(--ink);
      border-color: rgba(61, 214, 198, 0.35);
    }

    &.active {
      color: #5eead4;
      border-color: rgba(61, 214, 198, 0.5);
      background: rgba(61, 214, 198, 0.14);
    }
  }

  .preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(0, 0, 0, 0.82);
    display: grid;
    place-items: center;
    padding: 24px;
    cursor: zoom-out;
  }

  .preview-image {
    max-width: min(96vw, 1200px);
    max-height: 90vh;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    cursor: default;
  }

  .preview-close {
    position: absolute;
    top: 16px;
    right: 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.45);
    color: #fafafa;
    border-radius: 8px;
    padding: 8px 12px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .sb-index {
    flex: none;
    font-size: 13px;
    color: var(--accent);
    font-weight: 800;
    font-family: var(--display);
    letter-spacing: 0.02em;
  }

  .sb-link-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }

  .sb-link-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    font-size: 11px;
    color: var(--muted);

    > span {
      font-weight: 600;
    }
  }

  .sb-select.single {
    width: 100%;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.28);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    padding: 6px 8px;
  }

  .sb-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 28px;
    align-items: flex-start;
  }

  .sb-chip {
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
    color: var(--muted);
    border-radius: 999px;
    padding: 3px 8px;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      border-color: rgba(61, 214, 198, 0.35);
      color: var(--ink);
    }

    &.on {
      border-color: rgba(61, 214, 198, 0.55);
      background: rgba(61, 214, 198, 0.14);
      color: #5eead4;
    }
  }

  .sb-chip-empty {
    font-size: 11px;
    color: var(--faint);
    padding: 4px 0;
  }

  .sb-thumbs {
    display: grid;
    gap: 6px;
    margin: 0 0 8px;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.18);
  }

  .sb-thumb-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .sb-thumb-label {
    flex: none;
    width: 32px;
    font-size: 11px;
    color: var(--faint);
  }

  .sb-thumb-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  .sb-thumb {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.06);
    color: var(--ink);
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    &.has-img {
      cursor: zoom-in;
    }
  }

  .asset-title {
    width: 100%;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 14px;
    font-weight: 650;
    padding: 4px 6px;
    outline: none;
    margin-bottom: 6px;

    &:focus {
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.03);
    }
  }

  .asset-desc {
    width: 100%;
    resize: vertical;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.2);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px;
    outline: none;
    margin-bottom: 8px;

    &:focus {
      border-color: rgba(61, 214, 198, 0.4);
    }
  }

  .asset-ops {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .footer-switch {
    margin-top: 8px;
    padding: 18px;
    border-radius: 14px;
    border: 1px dashed rgba(61, 214, 198, 0.35);
    background: rgba(61, 214, 198, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    min-width: 0;
    max-width: 100%;

    p {
      margin: 0;
      color: var(--muted);
      font-size: 0.9rem;
      min-width: 0;
      flex: 1;
    }
  }

  @media (max-width: 900px) {
    height: auto;
    min-height: 100dvh;
    overflow: auto;

    .shell {
      grid-template-columns: 1fr;
      flex: none;
      min-height: auto;
      overflow: visible;
    }

    .steps {
      position: sticky;
      top: 0;
      z-index: 20;
      height: auto;
      max-height: none;
      border-right: none;
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 6px;
      overflow: auto;
      padding: 10px;

      .steps-title,
      .sub-list,
      .step-children,
      .step-fold {
        display: none;
      }

      .step {
        flex: none;
        margin: 0;
      }
    }

    .sb-media-row {
      grid-template-columns: 1fr 1fr;
    }

    .main {
      height: auto;
      overflow: visible;
    }

    .sb-head {
      flex-wrap: wrap;

      .asset-ops {
        width: 100%;
      }
    }

    .sb-link-row {
      grid-template-columns: 1fr;
    }

    .sb-media-row {
      grid-template-columns: 1fr;
    }

    .footer-switch {
      flex-direction: column;
      align-items: stretch;
    }
  }

  @media (max-width: 640px) {
    .sb-frame {
      width: min(100%, 200px);
      max-height: 360px;
    }
  }
`

