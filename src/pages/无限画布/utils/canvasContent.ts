import type { Edge, Node, Viewport } from '@xyflow/react'

export type CanvasNodeKind =
  | 'text'
  | 'image'
  | 'video'
  | 'script'
  | 'character'
  | 'scene'
  | 'prop'
  | 'storyboard'
  | 'compose'

export type CanvasNodeData = {
  kind: CanvasNodeKind
  title: string
  body: string
  label?: string
  /** AI / 上传的图片 */
  imageUrl?: string
  /** 历次生成图片（最新在前，不含当前 imageUrl） */
  imageHistory?: string[]
  /** AI 生成的视频 */
  videoUrl?: string
  /** 最近一次生视频任务 id，便于轮询 */
  videoId?: string
  /** 创建该视频任务时使用的 AGNES 密钥 id（查询结果必须用同一把） */
  videoKeyId?: string
  /** 分镜视频提示词（可单独编辑） */
  videoPrompt?: string
  /** 分镜关联角色节点 id（多选） */
  characterIds?: string[]
  /** 分镜关联场景节点 id（单选） */
  sceneId?: string | null
  /** 分镜关联道具节点 id（多选） */
  propIds?: string[]
  /** 分镜视频节点关联的分镜 id */
  linkedStoryboardId?: string
}

export type AssetStyleOption = {
  id: string
  label: string
  prompt: string
}

/** 资产统一视觉风格，生成时追加到提示词 */
export const ASSET_STYLES: AssetStyleOption[] = [
  {
    id: 'cinematic',
    label: '电影写实',
    prompt: '电影级写实摄影风格，自然光影，高细节材质，短剧质感，统一色调',
  },
  {
    id: 'guoman',
    label: '国漫厚涂',
    prompt: '国漫厚涂插画风格，清晰轮廓，鲜明配色，二次元角色设定质感，统一画风',
  },
  {
    id: 'anime',
    label: '日系动漫',
    prompt: '日系动漫赛璐璐风格，干净线条，柔和光影，统一画风',
  },
  {
    id: '3d',
    label: '三维渲染',
    prompt: '高质量三维渲染风格，PBR材质，柔和棚拍光，统一建模风格',
  },
  {
    id: 'ink',
    label: '水墨国风',
    prompt: '水墨国风插画，留白意境，东方美学配色，统一笔触',
  },
  {
    id: 'cyber',
    label: '赛博霓虹',
    prompt: '赛博朋克霓虹风格，冷暖对比，未来感材质，统一视觉',
  },
]

export const DEFAULT_ASSET_STYLE = ASSET_STYLES[0]!.id

export function resolveAssetStyle(styleId?: string | null): AssetStyleOption {
  return ASSET_STYLES.find((s) => s.id === styleId) || ASSET_STYLES[0]!
}

/** 角色/道具/场景生图：三视图 + 品类限制 */
export function buildAssetImagePrompt(input: {
  kind: 'character' | 'scene' | 'prop'
  title: string
  body: string
  styleId?: string | null
}): string {
  const style = resolveAssetStyle(input.styleId)
  const base = [input.title, input.body].filter(Boolean).join('\n')
  const shared = [
    '同一张图内输出三视图设定（正面、侧面、背面并排）',
    '构图整齐，标注清晰，统一光照与比例',
    `视觉风格：${style.prompt}`,
  ]

  if (input.kind === 'character') {
    return [
      `短剧角色三视图设定：${base}`,
      ...shared,
      '全身角色设计，纯色/浅灰干净背景',
      '同一人物三种视角，外貌服装一致',
    ].join('\n')
  }

  if (input.kind === 'prop') {
    return [
      `短剧道具三视图设定：${base}`,
      ...shared,
      '纯道具特写，绝对不能出现人物、手、手臂或任何生物',
      '纯白或浅灰干净背景，无场景、无杂物、无文字水印',
      '只展示该道具本身的外观与材质',
    ].join('\n')
  }

  return [
    `短剧场景环境三视图设定：${base}`,
    ...shared,
    '环境空间设定（正面全景、侧面透视、俯视布局）',
    '绝对不能出现人物、角色、行人、剪影或任何生物',
    '只表现空间、建筑、光线与气氛，干净无杂乱道具堆砌',
  ].join('\n')
}

const MAX_IMAGE_HISTORY = 8

/** 新图替换当前图时，把旧图推进历史 */
export function pushImageHistory(
  data: CanvasNodeData,
  nextUrl: string,
): Pick<CanvasNodeData, 'imageUrl' | 'imageHistory'> {
  const prev = data.imageUrl?.trim()
  const history = Array.isArray(data.imageHistory)
    ? data.imageHistory.filter((u) => typeof u === 'string' && u.trim())
    : []
  const nextHistory =
    prev && prev !== nextUrl ? [prev, ...history.filter((u) => u !== nextUrl)] : history
  return {
    imageUrl: nextUrl,
    imageHistory: nextHistory.slice(0, MAX_IMAGE_HISTORY),
  }
}

/** 从历史恢复某张图为当前，当前图退回历史 */
export function restoreImageFromHistory(
  data: CanvasNodeData,
  url: string,
): Pick<CanvasNodeData, 'imageUrl' | 'imageHistory'> | null {
  const target = url.trim()
  if (!target) return null
  const history = Array.isArray(data.imageHistory) ? [...data.imageHistory] : []
  if (!history.includes(target) && data.imageUrl !== target) return null
  const current = data.imageUrl?.trim()
  const rest = history.filter((u) => u !== target)
  const nextHistory =
    current && current !== target ? [current, ...rest.filter((u) => u !== current)] : rest
  return {
    imageUrl: target,
    imageHistory: nextHistory.slice(0, MAX_IMAGE_HISTORY),
  }
}

export type CanvasDocument = {
  version: 1
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  viewport: Viewport
  /** 资产统一风格 id */
  assetStyle?: string
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.75 }

/** 右键菜单「添加节点」里已实现的类型 */
export const WORKFLOW_NODE_KINDS = ['text', 'image', 'video'] as const

export type WorkflowMenuAction =
  | CanvasNodeKind
  | 'audio'
  | 'compose'
  | 'director'
  | 'upload'
  | 'library'

const KIND_META: Record<
  CanvasNodeKind,
  { label: string; title: string; body: string; flowType: string }
> = {
  text: {
    label: '文本',
    title: '文本节点',
    body: '输入提示词或剧本内容，作为下游图片/视频的输入。',
    flowType: 'canvasText',
  },
  image: {
    label: '图片',
    title: '图片节点',
    body: '根据上游文本生成画面，可输出给视频节点。',
    flowType: 'canvasImage',
  },
  video: {
    label: '视频',
    title: '视频节点',
    body: '根据上游文本/图片生成镜头视频。',
    flowType: 'canvasVideo',
  },
  script: {
    label: '剧本',
    title: '第 1 集剧本',
    body: '在这里写下故事大纲与对白，作为后续分镜与素材的起点。',
    flowType: 'canvasScript',
  },
  character: {
    label: '角色',
    title: '未命名角色',
    body: '外貌、性格与关系设定。',
    flowType: 'canvasAsset',
  },
  scene: {
    label: '场景',
    title: '未命名场景',
    body: '时间、地点与气氛描述。',
    flowType: 'canvasAsset',
  },
  prop: {
    label: '道具',
    title: '未命名道具',
    body: '关键道具外观与用途。',
    flowType: 'canvasAsset',
  },
  storyboard: {
    label: '分镜',
    title: '分镜 01',
    body: '镜头运动、对白与画面要点。',
    flowType: 'canvasStoryboard',
  },
  compose: {
    label: '成片合成',
    title: '合成所有分镜视频',
    body: '按分镜顺序拼接全部镜头视频，预览成片。',
    flowType: 'canvasCompose',
  },
}

export function kindMeta(kind: CanvasNodeKind) {
  return KIND_META[kind]
}

export function flowTypeForKind(kind: CanvasNodeKind) {
  return KIND_META[kind].flowType
}

export function createDefaultDocument(projectTitle?: string): CanvasDocument {
  const title = projectTitle?.trim() || '未命名短剧'
  return {
    version: 1,
    viewport: { ...DEFAULT_VIEWPORT, x: 40, y: 40 },
    assetStyle: DEFAULT_ASSET_STYLE,
    nodes: [
      {
        id: 'script-1',
        type: 'canvasScript',
        position: { x: 60, y: 120 },
        data: {
          kind: 'script',
          label: '剧本',
          title: `${title} · 剧本`,
          body: '在这里写下故事大纲与对白，作为后续角色、场景与分镜的起点。',
        },
      },
    ],
    edges: [],
  }
}

function isNode(value: unknown): value is Node<CanvasNodeData> {
  if (!value || typeof value !== 'object') return false
  const n = value as Partial<Node>
  return Boolean(n.id && n.position && n.data)
}

function normalizeImageHistory(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length ? list.slice(0, MAX_IMAGE_HISTORY) : undefined
}

export function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const list: string[] = []
  for (const item of value) {
    const id = typeof item === 'string' ? item.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    list.push(id)
  }
  return list
}

function normalizeSceneId(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  return id || null
}

export function parseCanvasDocument(
  raw: string | undefined | null,
  projectTitle?: string,
): CanvasDocument {
  if (!raw?.trim()) return createDefaultDocument(projectTitle)
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasDocument>
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.nodes)) {
      return createDefaultDocument(projectTitle)
    }
    const nodes = parsed.nodes.filter(isNode).map((node) => {
      const kind = (node.data?.kind || 'text') as CanvasNodeKind
      const meta = KIND_META[kind] || KIND_META.text
      const imageHistory = normalizeImageHistory(node.data?.imageHistory)
      const characterIds = normalizeIdList(node.data?.characterIds)
      const propIds = normalizeIdList(node.data?.propIds)
      const sceneId = normalizeSceneId(node.data?.sceneId)
      const linkedStoryboardId =
        typeof node.data?.linkedStoryboardId === 'string'
          ? node.data.linkedStoryboardId.trim()
          : ''
      return {
        ...node,
        type: node.type || meta.flowType,
        data: {
          ...node.data,
          kind: KIND_META[kind] ? kind : 'text',
          label: node.data?.label || meta.label,
          title: node.data?.title || meta.title,
          body: node.data?.body || meta.body,
          ...(imageHistory ? { imageHistory } : {}),
          ...(linkedStoryboardId ? { linkedStoryboardId } : {}),
          ...(kind === 'storyboard'
            ? {
                characterIds,
                propIds,
                sceneId: sceneId === undefined ? null : sceneId,
              }
            : {}),
        },
      }
    })
    const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : []
    return {
      version: 1,
      assetStyle:
        typeof parsed.assetStyle === 'string' && parsed.assetStyle
          ? parsed.assetStyle
          : DEFAULT_ASSET_STYLE,
      nodes,
      edges: syncAssetStoryboardEdges(nodes, rawEdges),
      viewport:
        parsed.viewport && typeof parsed.viewport === 'object'
          ? {
              x: Number(parsed.viewport.x) || 0,
              y: Number(parsed.viewport.y) || 0,
              zoom: Number(parsed.viewport.zoom) || 0.75,
            }
          : { ...DEFAULT_VIEWPORT },
    }
  } catch {
    return createDefaultDocument(projectTitle)
  }
}

export function serializeCanvasDocument(doc: CanvasDocument): string {
  return JSON.stringify({
    version: 1,
    assetStyle: doc.assetStyle || DEFAULT_ASSET_STYLE,
    nodes: doc.nodes.map(({ id, type, position, data, width, height }) => ({
      id,
      type,
      position,
      data,
      width,
      height,
    })),
    edges: doc.edges.map(
      ({ id, source, target, sourceHandle, targetHandle, animated, style }) => ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        animated,
        style,
      }),
    ),
    viewport: doc.viewport,
  })
}

export function makeNodeId(kind: CanvasNodeKind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 按标题中的数字排序（分镜 01 / 角色2），无数字则保持相对顺序 */
function sortNodesByTitle(a: Node<CanvasNodeData>, b: Node<CanvasNodeData>) {
  const num = (title: string) => {
    const m = title.match(/(\d+)/)
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY
  }
  const na = num(a.data.title)
  const nb = num(b.data.title)
  if (na !== nb) return na - nb
  return a.data.title.localeCompare(b.data.title, 'zh')
}

export const COMPOSE_NODE_ID = 'compose-final'

export function storyboardVideoNodeId(storyboardId: string) {
  return `sbv-${storyboardId}`
}

export function isStoryboardVideoNode(node: Node<CanvasNodeData>) {
  return (
    node.data.kind === 'video' &&
    Boolean(node.data.linkedStoryboardId || node.id.startsWith('sbv-'))
  )
}

const PIPE_SB_VIDEO_PREFIX = 'pipe-sb-video:'
const PIPE_VIDEO_COMPOSE_PREFIX = 'pipe-video-compose:'

function upsertEdge(edges: Edge[], edge: Edge): Edge[] {
  const idx = edges.findIndex((e) => e.id === edge.id)
  if (idx < 0) return [...edges, edge]
  const next = edges.slice()
  next[idx] = { ...next[idx], ...edge }
  return next
}

/**
 * 补齐：每个分镜 → 分镜视频节点 → 最终成片合成节点
 * 分镜上的 videoUrl 会同步到对应分镜视频节点
 */
export function ensureStoryboardVideoPipeline(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const storyboards = nodes
    .filter((n) => n.data.kind === 'storyboard')
    .sort(sortNodesByTitle)
  const sbIds = new Set(storyboards.map((n) => n.id))

  const byId = new Map(nodes.map((n) => [n.id, n]))
  let nextNodes = nodes.slice()
  let nextEdges = edges.filter((e) => {
    if (e.id.startsWith(PIPE_SB_VIDEO_PREFIX)) {
      const sbId = e.id.slice(PIPE_SB_VIDEO_PREFIX.length)
      return sbIds.has(sbId)
    }
    if (e.id.startsWith(PIPE_VIDEO_COMPOSE_PREFIX)) {
      const videoId = e.id.slice(PIPE_VIDEO_COMPOSE_PREFIX.length)
      return videoId.startsWith('sbv-') && sbIds.has(videoId.slice(4))
    }
    return true
  })

  const setNode = (node: Node<CanvasNodeData>) => {
    const idx = nextNodes.findIndex((n) => n.id === node.id)
    if (idx < 0) nextNodes = [...nextNodes, node]
    else {
      const copy = nextNodes.slice()
      copy[idx] = node
      nextNodes = copy
    }
    byId.set(node.id, node)
  }

  for (const sb of storyboards) {
    const videoId = storyboardVideoNodeId(sb.id)
    const existing =
      byId.get(videoId) ||
      nextNodes.find(
        (n) => n.data.kind === 'video' && n.data.linkedStoryboardId === sb.id,
      )
    const videoNode: Node<CanvasNodeData> = {
      id: videoId,
      type: 'canvasVideo',
      position: existing?.position || {
        x: sb.position.x + 280,
        y: sb.position.y,
      },
      data: {
        kind: 'video',
        label: '分镜视频',
        title: `${sb.data.title} · 视频`,
        body:
          sb.data.videoPrompt?.trim() ||
          sb.data.body ||
          '由分镜图生成镜头视频',
        linkedStoryboardId: sb.id,
        imageUrl: sb.data.imageUrl || existing?.data.imageUrl,
        videoUrl: sb.data.videoUrl || existing?.data.videoUrl,
        videoId: sb.data.videoId || existing?.data.videoId,
        videoKeyId: sb.data.videoKeyId || existing?.data.videoKeyId,
        videoPrompt: sb.data.videoPrompt || existing?.data.videoPrompt,
      },
    }
    setNode(videoNode)

    nextEdges = upsertEdge(nextEdges, {
      id: `${PIPE_SB_VIDEO_PREFIX}${sb.id}`,
      source: sb.id,
      target: videoId,
      sourceHandle: 'out',
      targetHandle: 'in',
      animated: true,
      style: { stroke: '#60a5fa', strokeWidth: 1.5 },
    })
  }

  // 清理已无对应分镜的分镜视频节点
  nextNodes = nextNodes.filter((n) => {
    if (!isStoryboardVideoNode(n)) return true
    const linked = n.data.linkedStoryboardId || n.id.replace(/^sbv-/, '')
    return sbIds.has(linked)
  })

  const composeMeta = KIND_META.compose
  const existingCompose =
    byId.get(COMPOSE_NODE_ID) ||
    nextNodes.find((n) => n.data.kind === 'compose')
  if (existingCompose && existingCompose.id !== COMPOSE_NODE_ID) {
    nextNodes = nextNodes.filter((n) => n.id !== existingCompose.id)
    byId.delete(existingCompose.id)
  }
  const composeNode: Node<CanvasNodeData> = {
    id: COMPOSE_NODE_ID,
    type: composeMeta.flowType,
    position: existingCompose?.position || { x: 1200, y: 60 },
    data: {
      kind: 'compose',
      label: composeMeta.label,
      title: existingCompose?.data.title || composeMeta.title,
      body: existingCompose?.data.body || composeMeta.body,
      videoUrl: existingCompose?.data.videoUrl,
    },
  }
  setNode(composeNode)

  for (const sb of storyboards) {
    const videoId = storyboardVideoNodeId(sb.id)
    nextEdges = upsertEdge(nextEdges, {
      id: `${PIPE_VIDEO_COMPOSE_PREFIX}${videoId}`,
      source: videoId,
      target: COMPOSE_NODE_ID,
      sourceHandle: 'out',
      targetHandle: 'in',
      animated: true,
      style: { stroke: '#fbbf24', strokeWidth: 1.5, strokeDasharray: '6 4' },
    })
  }

  return { nodes: nextNodes, edges: nextEdges }
}

/**
 * 一键对齐：剧本 | 资产竖排 | 分镜竖排 | 分镜视频竖排 | 成片合成
 * 同时补齐分镜视频与合成节点
 */
export function autoLayoutDocument(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const ensured = ensureStoryboardVideoPipeline(nodes, edges)
  const laidOut = autoLayoutNodes(ensured.nodes)
  return { nodes: laidOut, edges: ensured.edges }
}

/**
 * 列式竖排：资产 / 分镜 / 分镜视频各自从上到下，行距拉开避免重叠
 */
export function autoLayoutNodes(
  nodes: Node<CanvasNodeData>[],
): Node<CanvasNodeData>[] {
  const ORIGIN_X = 60
  const ORIGIN_Y = 60
  /** 剧本与后续列的间距 */
  const COL_GAP = 100
  /** 资产 / 分镜图 / 分镜视频 / 成片 类别之间加大左右间距 */
  const CATEGORY_GAP = 220
  const ROW_GAP = 48

  const SCRIPT_W = 220
  const SCRIPT_STEP = 240
  const ASSET_W = 176
  const ASSET_STEP = 220
  const SB_W = 210
  const SB_STEP = 320
  const VIDEO_W = 210
  const VIDEO_STEP = 340
  const COMPOSE_W = 240
  const FLOW_W = 200
  const FLOW_STEP = 200

  const scripts = nodes.filter((n) => n.data.kind === 'script').sort(sortNodesByTitle)
  const assets = [
    ...nodes.filter((n) => n.data.kind === 'character').sort(sortNodesByTitle),
    ...nodes.filter((n) => n.data.kind === 'prop').sort(sortNodesByTitle),
    ...nodes.filter((n) => n.data.kind === 'scene').sort(sortNodesByTitle),
  ]
  const storyboards = nodes
    .filter((n) => n.data.kind === 'storyboard')
    .sort(sortNodesByTitle)
  const storyboardVideos = storyboards
    .map((sb) => {
      const id = storyboardVideoNodeId(sb.id)
      return (
        nodes.find((n) => n.id === id) ||
        nodes.find(
          (n) => n.data.kind === 'video' && n.data.linkedStoryboardId === sb.id,
        ) ||
        null
      )
    })
    .filter((n): n is Node<CanvasNodeData> => Boolean(n))
  const composes = nodes.filter((n) => n.data.kind === 'compose')
  const storyboardVideoIds = new Set(storyboardVideos.map((n) => n.id))
  const others = nodes.filter(
    (n) =>
      (n.data.kind === 'text' ||
        n.data.kind === 'image' ||
        n.data.kind === 'video') &&
      !storyboardVideoIds.has(n.id),
  )

  const pos = new Map<string, { x: number; y: number }>()

  const stackColumn = (
    list: Node<CanvasNodeData>[],
    x: number,
    stepY: number,
  ) => {
    list.forEach((n, i) => {
      pos.set(n.id, { x, y: ORIGIN_Y + i * stepY })
    })
  }

  let x = ORIGIN_X
  stackColumn(scripts, x, SCRIPT_STEP + ROW_GAP)

  x += SCRIPT_W + COL_GAP
  stackColumn(assets, x, ASSET_STEP + ROW_GAP)

  x += ASSET_W + CATEGORY_GAP
  stackColumn(storyboards, x, SB_STEP + ROW_GAP)

  x += SB_W + CATEGORY_GAP
  stackColumn(storyboardVideos, x, VIDEO_STEP + ROW_GAP)

  x += VIDEO_W + CATEGORY_GAP
  stackColumn(composes, x, 280 + ROW_GAP)

  // 其它节点：放在最下方横排，避免挡住主链路
  const bottomY =
    ORIGIN_Y +
    Math.max(
      scripts.length * (SCRIPT_STEP + ROW_GAP),
      assets.length * (ASSET_STEP + ROW_GAP),
      storyboards.length * (SB_STEP + ROW_GAP),
      storyboardVideos.length * (VIDEO_STEP + ROW_GAP),
      1,
    ) +
    CATEGORY_GAP
  others.forEach((n, i) => {
    pos.set(n.id, {
      x: ORIGIN_X + (i % 4) * (FLOW_W + 40),
      y: bottomY + Math.floor(i / 4) * (FLOW_STEP + ROW_GAP),
    })
  })

  void COMPOSE_W

  return nodes.map((n) => {
    const next = pos.get(n.id)
    if (!next) return n
    return { ...n, position: next }
  })
}

/** 分镜 ↔ 分镜视频节点双向同步视频字段 */
export function syncStoryboardVideoFields(
  nodes: Node<CanvasNodeData>[],
  nodeId: string,
  patch: Partial<CanvasNodeData>,
): Node<CanvasNodeData>[] {
  const self = nodes.find((n) => n.id === nodeId)
  if (!self) return nodes

  const videoKeys: (keyof CanvasNodeData)[] = [
    'videoUrl',
    'videoId',
    'videoKeyId',
    'videoPrompt',
    'imageUrl',
  ]
  const hasVideoPatch = videoKeys.some((k) => patch[k] !== undefined)
  if (!hasVideoPatch && patch.title === undefined && patch.body === undefined) {
    return nodes
  }

  if (self.data.kind === 'storyboard') {
    const videoId = storyboardVideoNodeId(self.id)
    return nodes.map((n) => {
      if (n.id !== videoId && n.data.linkedStoryboardId !== self.id) return n
      return {
        ...n,
        data: {
          ...n.data,
          label: '分镜视频',
          linkedStoryboardId: self.id,
          title:
            patch.title !== undefined
              ? `${patch.title} · 视频`
              : `${self.data.title} · 视频`,
          body:
            patch.videoPrompt !== undefined
              ? patch.videoPrompt || n.data.body
              : patch.body !== undefined
                ? patch.body
                : n.data.body,
          imageUrl:
            patch.imageUrl !== undefined ? patch.imageUrl : n.data.imageUrl,
          videoUrl:
            patch.videoUrl !== undefined ? patch.videoUrl : n.data.videoUrl,
          videoId: patch.videoId !== undefined ? patch.videoId : n.data.videoId,
          videoKeyId:
            patch.videoKeyId !== undefined
              ? patch.videoKeyId
              : n.data.videoKeyId,
          videoPrompt:
            patch.videoPrompt !== undefined
              ? patch.videoPrompt
              : n.data.videoPrompt,
        },
      }
    })
  }

  if (isStoryboardVideoNode(self)) {
    const sbId = self.data.linkedStoryboardId || self.id.replace(/^sbv-/, '')
    return nodes.map((n) => {
      if (n.id !== sbId) return n
      return {
        ...n,
        data: {
          ...n.data,
          videoUrl:
            patch.videoUrl !== undefined ? patch.videoUrl : n.data.videoUrl,
          videoId: patch.videoId !== undefined ? patch.videoId : n.data.videoId,
          videoKeyId:
            patch.videoKeyId !== undefined
              ? patch.videoKeyId
              : n.data.videoKeyId,
          videoPrompt:
            patch.videoPrompt !== undefined
              ? patch.videoPrompt
              : n.data.videoPrompt,
          imageUrl:
            patch.imageUrl !== undefined ? patch.imageUrl : n.data.imageUrl,
        },
      }
    })
  }

  return nodes
}

export function createNodeAt(
  kind: CanvasNodeKind,
  position: { x: number; y: number },
  overrides?: Partial<CanvasNodeData>,
): Node<CanvasNodeData> {
  const meta = KIND_META[kind]
  const data: CanvasNodeData = {
    kind,
    label: meta.label,
    title: overrides?.title || meta.title,
    body: overrides?.body || meta.body,
    imageUrl: overrides?.imageUrl,
    imageHistory: overrides?.imageHistory,
    videoUrl: overrides?.videoUrl,
    videoId: overrides?.videoId,
    videoKeyId: overrides?.videoKeyId,
    videoPrompt: overrides?.videoPrompt,
  }
  if (kind === 'storyboard') {
    data.characterIds = normalizeIdList(overrides?.characterIds)
    data.propIds = normalizeIdList(overrides?.propIds)
    data.sceneId =
      overrides?.sceneId === undefined
        ? null
        : normalizeSceneId(overrides.sceneId) ?? null
    if (overrides?.videoPrompt !== undefined) {
      data.videoPrompt = overrides.videoPrompt
    }
  }
  if (overrides?.linkedStoryboardId) {
    data.linkedStoryboardId = overrides.linkedStoryboardId
  }
  return {
    id: kind === 'compose' ? COMPOSE_NODE_ID : makeNodeId(kind),
    type: meta.flowType,
    position,
    data,
  }
}

const ASSET_EDGE_PREFIX = 'asset-link:'

export const ASSET_EDGE_STYLE = {
  stroke: '#34d399',
  strokeWidth: 1.5,
  strokeDasharray: '6 4',
} as const

export type StoryboardLinkedAssets = {
  characters: Node<CanvasNodeData>[]
  scene: Node<CanvasNodeData> | null
  props: Node<CanvasNodeData>[]
}

/** 解析分镜上已关联的角色/场景/道具节点 */
export function getStoryboardLinkedAssets(
  data: CanvasNodeData,
  nodes: Node<CanvasNodeData>[],
): StoryboardLinkedAssets {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const characters = normalizeIdList(data.characterIds)
    .map((id) => byId.get(id))
    .filter((n): n is Node<CanvasNodeData> => Boolean(n && n.data.kind === 'character'))
  const sceneId = normalizeSceneId(data.sceneId)
  const sceneNode =
    sceneId && byId.get(sceneId)?.data.kind === 'scene' ? byId.get(sceneId)! : null
  const props = normalizeIdList(data.propIds)
    .map((id) => byId.get(id))
    .filter((n): n is Node<CanvasNodeData> => Boolean(n && n.data.kind === 'prop'))
  return { characters, scene: sceneNode, props }
}

/** 参考图顺序：场景 → 角色 → 道具（与 LocalMiniDrama Omni 槽位一致） */
export function getStoryboardRefImages(
  data: CanvasNodeData,
  nodes: Node<CanvasNodeData>[],
): string[] {
  const linked = getStoryboardLinkedAssets(data, nodes)
  const urls: string[] = []
  const push = (url?: string) => {
    const u = url?.trim()
    if (u && !urls.includes(u)) urls.push(u)
  }
  push(linked.scene?.data.imageUrl)
  for (const c of linked.characters) push(c.data.imageUrl)
  for (const p of linked.props) push(p.data.imageUrl)
  return urls
}

/** 分镜生图提示词：注入关联资产描述 */
export function buildStoryboardImagePrompt(input: {
  title: string
  body: string
  nodes: Node<CanvasNodeData>[]
  data: CanvasNodeData
  styleId?: string | null
}): string {
  const linked = getStoryboardLinkedAssets(input.data, input.nodes)
  const style = resolveAssetStyle(input.styleId)
  const parts = [
    `短剧分镜画面：${[input.title, input.body].filter(Boolean).join('\n')}`,
    `视觉风格：${style.prompt}`,
    '竖屏 9:16 单镜头完整画幅，禁止分屏宫格',
  ]
  if (linked.scene) {
    parts.push(
      `场景参考「${linked.scene.data.title}」：${linked.scene.data.body || '见参考图'}`,
    )
  }
  if (linked.characters.length) {
    parts.push(
      `出场角色：${linked.characters
        .map((c) => `「${c.data.title}」${c.data.body ? `（${c.data.body}）` : ''}`)
        .join('；')}`,
    )
  }
  if (linked.props.length) {
    parts.push(
      `关键道具：${linked.props
        .map((p) => `「${p.data.title}」${p.data.body ? `（${p.data.body}）` : ''}`)
        .join('；')}`,
    )
  }
  const refCount = getStoryboardRefImages(input.data, input.nodes).length
  if (refCount > 0) {
    parts.push(
      `已提供 ${refCount} 张参考图（顺序：场景→角色→道具），请严格保持人物外貌、场景空间与道具外观一致`,
    )
  }
  return parts.join('\n')
}

/** 分镜视频提示词：优先用手动填写，否则按脚本+资产拼装 */
export function buildStoryboardVideoPrompt(input: {
  title: string
  body: string
  videoPrompt?: string
  nodes: Node<CanvasNodeData>[]
  data: CanvasNodeData
  styleId?: string | null
}): string {
  const custom = input.videoPrompt?.trim()
  if (custom) return custom
  const linked = getStoryboardLinkedAssets(input.data, input.nodes)
  const style = resolveAssetStyle(input.styleId)
  const parts = [
    `短剧镜头：${[input.title, input.body].filter(Boolean).join('\n')}`,
    '竖屏 9:16，自然运动，电影感运镜，短剧质感',
    `视觉风格：${style.prompt}`,
  ]
  if (linked.scene) {
    parts.push(`场景：${linked.scene.data.title}`)
  }
  if (linked.characters.length) {
    parts.push(`角色：${linked.characters.map((c) => c.data.title).join('、')}`)
  }
  if (linked.props.length) {
    parts.push(`道具：${linked.props.map((p) => p.data.title).join('、')}`)
  }
  return parts.join('\n')
}

/** 从关联字段派生资产→分镜边，保留其他非关联边 */
export function syncAssetStoryboardEdges(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
): Edge[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const kept = edges.filter(
    (e) =>
      !String(e.id || '').startsWith(ASSET_EDGE_PREFIX) &&
      nodeIds.has(e.source) &&
      nodeIds.has(e.target),
  )
  const derived: Edge[] = []
  for (const sb of nodes.filter((n) => n.data.kind === 'storyboard')) {
    const linked = getStoryboardLinkedAssets(sb.data, nodes)
    if (linked.scene) {
      derived.push({
        id: `${ASSET_EDGE_PREFIX}scene-${linked.scene.id}-${sb.id}`,
        source: linked.scene.id,
        target: sb.id,
        animated: false,
        style: { ...ASSET_EDGE_STYLE },
      })
    }
    for (const c of linked.characters) {
      derived.push({
        id: `${ASSET_EDGE_PREFIX}char-${c.id}-${sb.id}`,
        source: c.id,
        target: sb.id,
        animated: false,
        style: { ...ASSET_EDGE_STYLE },
      })
    }
    for (const p of linked.props) {
      derived.push({
        id: `${ASSET_EDGE_PREFIX}prop-${p.id}-${sb.id}`,
        source: p.id,
        target: sb.id,
        animated: false,
        style: { ...ASSET_EDGE_STYLE },
      })
    }
  }
  return [...kept, ...derived]
}

/** 删除资产节点时，清理分镜上的关联 id */
export function pruneStoryboardAssetLinks(
  nodes: Node<CanvasNodeData>[],
  removedId: string,
): Node<CanvasNodeData>[] {
  return nodes.map((n) => {
    if (n.data.kind !== 'storyboard') return n
    const characterIds = normalizeIdList(n.data.characterIds).filter((id) => id !== removedId)
    const propIds = normalizeIdList(n.data.propIds).filter((id) => id !== removedId)
    const sceneId = n.data.sceneId === removedId ? null : n.data.sceneId ?? null
    if (
      characterIds.join() === normalizeIdList(n.data.characterIds).join() &&
      propIds.join() === normalizeIdList(n.data.propIds).join() &&
      sceneId === (n.data.sceneId ?? null)
    ) {
      return n
    }
    return {
      ...n,
      data: { ...n.data, characterIds, propIds, sceneId },
    }
  })
}

/** 把资产目录写成 AI 可引用的清单（序号+名称，禁止输出内部 id） */
export function formatAssetCatalog(nodes: Node<CanvasNodeData>[]): string {
  const lines: string[] = []
  const pushKind = (kind: 'character' | 'scene' | 'prop', label: string) => {
    const list = nodes.filter((n) => n.data.kind === kind)
    if (!list.length) {
      lines.push(`${label}：无`)
      return
    }
    lines.push(
      `${label}：\n` +
        list
          .map((n, i) => `${i + 1}. ${sanitizeDisplayText(n.data.title) || `${label}${i + 1}`}`)
          .join('\n'),
    )
  }
  pushKind('character', '角色')
  pushKind('scene', '场景')
  pushKind('prop', '道具')
  return lines.join('\n')
}

function sanitizeDisplayText(text: string | undefined | null): string {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[{}\[\]"`]/g, ' ')
    .replace(/\b(?:character|scene|prop)-[a-z0-9]+-[a-z0-9]+\b/gi, ' ')
    .replace(/\bid\s*=\s*\S+/gi, ' ')
    .replace(/[｜|]{2,}/g, '｜')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function resolveAssetByToken(
  token: string,
  kind: 'character' | 'scene' | 'prop',
  nodes: Node<CanvasNodeData>[],
): string | null {
  const pool = nodes.filter((n) => n.data.kind === kind)
  if (!pool.length) return null
  let bare = token.trim()
  if (!bare) return null

  // 序号：1 / #1 / 角色1 / 第1个
  const indexMatch = bare.match(/^(?:#|第)?\s*(\d+)\s*(?:个|号)?$/) || bare.match(/^(?:角色|场景|道具)\s*(\d+)$/)
  if (indexMatch) {
    const idx = Number(indexMatch[1]) - 1
    if (idx >= 0 && idx < pool.length) return pool[idx]!.id
  }

  bare = bare.replace(/^\d+[.、)\]]\s*/, '').trim()
  if (!bare || bare === '-' || bare === '无' || /^none$/i.test(bare)) return null

  const byId = pool.find((n) => n.id === bare)
  if (byId) return byId.id

  const exact = pool.find((n) => n.data.title === bare)
  if (exact) return exact.id

  // 较长名称优先，避免短名误伤
  const sorted = [...pool]
    .filter((n) => Boolean(n.data.title?.trim()))
    .sort((a, b) => (b.data.title.length || 0) - (a.data.title.length || 0))
  for (const n of sorted) {
    const name = n.data.title.trim()
    if (name.length < 2) continue
    if (bare.includes(name) || name.includes(bare)) return n.id
  }
  return null
}

function matchAssetTokens(
  raw: unknown,
  kind: 'character' | 'scene' | 'prop',
  nodes: Node<CanvasNodeData>[],
): string[] {
  if (raw == null) return []
  const tokens: string[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'number' && Number.isFinite(item)) tokens.push(String(item))
      else if (typeof item === 'string') tokens.push(item)
    }
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    tokens.push(String(raw))
  } else if (typeof raw === 'string') {
    const cleaned = raw
      .replace(/^\[|\]$/g, '')
      .replace(/^(角色|场景|道具|characters?|scenes?|props?)\s*[:：]/i, '')
      .trim()
    if (cleaned && cleaned !== '-' && cleaned !== '无' && !/^none$/i.test(cleaned)) {
      tokens.push(...cleaned.split(/[,，、;；|/]+/).map((t) => t.trim()).filter(Boolean))
    }
  }

  const ids: string[] = []
  for (const token of tokens) {
    const id = resolveAssetByToken(token, kind, nodes)
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

export type ParsedStoryboardLine = {
  title: string
  body: string
  characterIds: string[]
  sceneId: string | null
  propIds: string[]
}

function stripAssetIdNoise(text: string, nodes: Node<CanvasNodeData>[]): string {
  let next = sanitizeDisplayText(text)
  for (const n of nodes) {
    if (n.data.kind !== 'character' && n.data.kind !== 'scene' && n.data.kind !== 'prop') {
      continue
    }
    if (n.id && next.includes(n.id)) {
      next = next.split(n.id).join(' ')
    }
  }
  return next.replace(/\s{2,}/g, ' ').trim()
}

function inferAssetsFromText(
  text: string,
  nodes: Node<CanvasNodeData>[],
): Pick<ParsedStoryboardLine, 'characterIds' | 'sceneId' | 'propIds'> {
  const characterIds: string[] = []
  const propIds: string[] = []
  let sceneId: string | null = null
  const sorted = [...nodes]
    .filter((n) => ['character', 'scene', 'prop'].includes(n.data.kind))
    .filter((n) => (n.data.title?.trim().length || 0) >= 2)
    .sort((a, b) => (b.data.title.length || 0) - (a.data.title.length || 0))
  for (const n of sorted) {
    const name = n.data.title.trim()
    if (!text.includes(name)) continue
    if (n.data.kind === 'character' && !characterIds.includes(n.id)) characterIds.push(n.id)
    if (n.data.kind === 'prop' && !propIds.includes(n.id)) propIds.push(n.id)
    if (n.data.kind === 'scene' && !sceneId) sceneId = n.id
  }
  return { characterIds, sceneId, propIds }
}

function normalizeStoryboardFields(
  obj: Record<string, unknown>,
  nodes: Node<CanvasNodeData>[],
): ParsedStoryboardLine {
  const asText = (v: unknown) => {
    if (typeof v === 'string') return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (Array.isArray(v)) {
      return v
        .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item) : ''))
        .filter(Boolean)
        .join('，')
    }
    return ''
  }
  let title = stripAssetIdNoise(asText(obj.title || obj.name) || '分镜', nodes).slice(0, 40)
  let body = stripAssetIdNoise(
    asText(obj.body || obj.content || obj.description || obj.shot) || '',
    nodes,
  )
  // 拒绝把 JSON 碎片当成正文
  if (/^[{[]/.test(title) || /"title"\s*:/.test(title)) title = '分镜'
  if (/^[{[]/.test(body) || /"title"\s*:/.test(body)) body = ''

  let characterIds = matchAssetTokens(
    obj.characters ?? obj.character ?? obj.characterNames ?? obj.character_ids,
    'character',
    nodes,
  )
  let sceneIds = matchAssetTokens(
    obj.scene ?? obj.sceneName ?? obj.location ?? obj.scene_id,
    'scene',
    nodes,
  )
  let propIds = matchAssetTokens(
    obj.props ?? obj.prop ?? obj.propNames ?? obj.prop_ids,
    'prop',
    nodes,
  )
  if (!characterIds.length && !sceneIds.length && !propIds.length) {
    const inferred = inferAssetsFromText(`${title}\n${body}`, nodes)
    characterIds = inferred.characterIds
    sceneIds = inferred.sceneId ? [inferred.sceneId] : []
    propIds = inferred.propIds
  }
  return {
    title: title || '分镜',
    body: body || title,
    characterIds,
    sceneId: sceneIds[0] || null,
    propIds,
  }
}

/**
 * 解析 AI 分镜行。支持：
 * 1) JSON 对象
 * 2) 标题｜正文｜角色｜场景｜道具（名称或序号）
 */
export function parseStoryboardAssetLine(
  line: string,
  nodes: Node<CanvasNodeData>[],
): ParsedStoryboardLine {
  const trimmed = line.trim()
  if (!trimmed) {
    return { title: '分镜', body: '', characterIds: [], sceneId: null, propIds: [] }
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>
      return normalizeStoryboardFields(obj, nodes)
    } catch {
      /* fall through */
    }
  }

  // 明显是 JSON 残片，不要当成正文
  if (/^[{}\[\],"]/.test(trimmed) || /"(title|body|characters|scene|props)"\s*:/.test(trimmed)) {
    return { title: '', body: '', characterIds: [], sceneId: null, propIds: [] }
  }

  const segs = trimmed.split(/[｜|]/).map((p) => p.trim())

  let title = (segs[0] || '分镜').replace(/^\d+[.、)\]]\s*/, '').slice(0, 40)
  let body = ''
  let charPart = ''
  let scenePart = ''
  let propPart = ''

  if (segs.length >= 5) {
    body = segs[1] || ''
    charPart = segs[2] || ''
    scenePart = segs[3] || ''
    propPart = segs[4] || ''
    if (segs.length > 5) {
      propPart = segs[segs.length - 1] || ''
      scenePart = segs[segs.length - 2] || ''
      charPart = segs[segs.length - 3] || ''
      body = segs.slice(1, segs.length - 3).join('｜')
    }
  } else if (segs.length === 4) {
    body = segs[1] || ''
    charPart = segs[2] || ''
    scenePart = segs[3] || ''
  } else if (segs.length === 3) {
    body = segs[1] || ''
    charPart = segs[2] || ''
  } else if (segs.length === 2) {
    body = segs[1] || segs[0] || trimmed
  } else {
    body = trimmed
  }

  body = stripAssetIdNoise(body, nodes)
  title = stripAssetIdNoise(title, nodes).slice(0, 40) || '分镜'

  const characterIds = matchAssetTokens(charPart, 'character', nodes)
  const sceneIds = matchAssetTokens(scenePart, 'scene', nodes)
  const propIds = matchAssetTokens(propPart, 'prop', nodes)

  if (!characterIds.length && !sceneIds.length && !propIds.length) {
    return {
      title,
      body: body || title,
      ...inferAssetsFromText(`${title}\n${body}`, nodes),
    }
  }

  return {
    title,
    body: body || title,
    characterIds,
    sceneId: sceneIds[0] || null,
    propIds,
  }
}

function extractJsonArray(raw: string): unknown[] | null {
  let text = raw.trim()
  // 去掉 markdown 代码围栏
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) text = fence[1].trim()

  const tryParse = (s: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(s) as unknown
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        for (const key of ['storyboards', 'shots', 'items', 'data', 'list']) {
          if (Array.isArray(obj[key])) return obj[key] as unknown[]
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }

  const direct = tryParse(text)
  if (direct?.length) return direct

  // 截取最外层数组（括号配对）
  const start = text.indexOf('[')
  if (start >= 0) {
    let depth = 0
    let inStr = false
    let escape = false
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i]!
      if (inStr) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '[') depth += 1
      else if (ch === ']') {
        depth -= 1
        if (depth === 0) {
          const slice = text.slice(start, i + 1)
          const arr = tryParse(slice)
          if (arr?.length) return arr
          const repaired = slice.replace(/,\s*([}\]])/g, '$1')
          const arr2 = tryParse(repaired)
          if (arr2?.length) return arr2
          break
        }
      }
    }

    // 数组被截断：捞出其中完整的 {...} 对象
    const salvaged: unknown[] = []
    const body = text.slice(start)
    let objStart = -1
    depth = 0
    inStr = false
    escape = false
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i]!
      if (inStr) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '{') {
        if (depth === 0) objStart = i
        depth += 1
      } else if (ch === '}') {
        depth -= 1
        if (depth === 0 && objStart >= 0) {
          const slice = body.slice(objStart, i + 1)
          try {
            const obj = JSON.parse(slice) as unknown
            if (obj && typeof obj === 'object') salvaged.push(obj)
          } catch {
            /* skip */
          }
          objStart = -1
        }
      }
    }
    if (salvaged.length) return salvaged
  }
  return null
}

/** 从整段 AI 文本解析分镜列表（优先 JSON，失败再按行） */
export function parseStoryboardAiText(
  text: string,
  nodes: Node<CanvasNodeData>[],
): ParsedStoryboardLine[] {
  const raw = text.trim()
  if (!raw) return []

  const arr = extractJsonArray(raw)
  if (arr?.length) {
    return arr
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => normalizeStoryboardFields(item, nodes))
      .filter((item) => {
        const t = item.title.trim()
        const b = item.body.trim()
        if (!t && !b) return false
        if (/^[{[]/.test(t) || /"title"\s*:/.test(t)) return false
        return true
      })
      .slice(0, 12)
  }

  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*\d.、)）]+\s*/, '').trim())
    .filter((line) => {
      if (!line) return false
      if (/^(```|【|\]|\{|\})/.test(line)) return false
      if (/"(title|body|characters|scene|props)"\s*:/.test(line)) return false
      if (/^(分镜列表|输出|格式|说明)/.test(line)) return false
      return true
    })
    .slice(0, 12)
    .map((line) => parseStoryboardAssetLine(line, nodes))
    .filter((item) => item.title || item.body)
}

export type UpstreamPayload = {
  texts: string[]
  imageUrls: string[]
  videoUrls: string[]
}

/** 收集直接上游节点输出，供下游生成使用 */
export function getUpstreamPayload(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
): UpstreamPayload {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const texts: string[] = []
  const imageUrls: string[] = []
  const videoUrls: string[] = []
  const seenImages = new Set<string>()
  const seenVideos = new Set<string>()

  const pushText = (chunk: string) => {
    if (chunk && !texts.includes(chunk)) texts.push(chunk)
  }
  const pushImage = (url?: string) => {
    const u = url?.trim()
    if (u && !seenImages.has(u)) {
      seenImages.add(u)
      imageUrls.push(u)
    }
  }
  const pushVideo = (url?: string) => {
    const u = url?.trim()
    if (u && !seenVideos.has(u)) {
      seenVideos.add(u)
      videoUrls.push(u)
    }
  }

  const incoming = edges
    .filter((e) => e.target === nodeId)
    .map((e) => byId.get(e.source))
    .filter((n): n is Node<CanvasNodeData> => Boolean(n))
    .sort(sortNodesByTitle)

  for (const src of incoming) {
    const { kind, title, body, imageUrl, videoUrl } = src.data
    if (kind === 'text' || kind === 'script' || kind === 'storyboard') {
      pushText([title, body].filter(Boolean).join('\n'))
    } else if (body || title) {
      pushText([title, body].filter(Boolean).join('\n'))
    }
    pushImage(imageUrl)
    pushVideo(videoUrl)
  }

  // 分镜：即使尚未画边，也按关联字段注入资产参考（场景→角色→道具）
  const self = byId.get(nodeId)
  if (self?.data.kind === 'storyboard') {
    for (const url of getStoryboardRefImages(self.data, nodes)) {
      pushImage(url)
    }
    const linked = getStoryboardLinkedAssets(self.data, nodes)
    if (linked.scene) {
      pushText(
        `场景「${linked.scene.data.title}」：${linked.scene.data.body || ''}`.trim(),
      )
    }
    for (const c of linked.characters) {
      pushText(`角色「${c.data.title}」：${c.data.body || ''}`.trim())
    }
    for (const p of linked.props) {
      pushText(`道具「${p.data.title}」：${p.data.body || ''}`.trim())
    }
  }

  return { texts, imageUrls, videoUrls }
}
