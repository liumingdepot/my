import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import styled from 'styled-components'
import {
  createNodeAt,
  autoLayoutDocument,
  syncStoryboardVideoFields,
  type CanvasNodeData,
  type CanvasNodeKind,
} from '../utils/canvasContent'
import ContextMenu, { type ContextMenuState } from './ContextMenu'
import AssetNode from './nodes/AssetNode'
import ComposeNode from './nodes/ComposeNode'
import ImageFlowNode from './nodes/ImageFlowNode'
import ScriptNode from './nodes/ScriptNode'
import StoryboardNode from './nodes/StoryboardNode'
import TextFlowNode from './nodes/TextFlowNode'
import VideoFlowNode from './nodes/VideoFlowNode'

const nodeTypes = {
  canvasText: TextFlowNode,
  canvasImage: ImageFlowNode,
  canvasVideo: VideoFlowNode,
  canvasScript: ScriptNode,
  canvasAsset: AssetNode,
  canvasStoryboard: StoryboardNode,
  canvasCompose: ComposeNode,
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#5eead4', strokeWidth: 1.6 },
}

type DocSlice = {
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  viewport: Viewport
}

type Props = {
  initialNodes: Node<CanvasNodeData>[]
  initialEdges: Edge[]
  initialViewport: Viewport
  selectedId: string | null
  onSelectNode: (id: string | null) => void
  onDocumentChange: (doc: DocSlice) => void
  updateNodeRef?: MutableRefObject<
    ((nodeId: string, patch: Partial<CanvasNodeData>) => void) | null
  >
  autoLayoutRef?: MutableRefObject<(() => void) | null>
}

function CanvasBoardInner({
  initialNodes,
  initialEdges,
  initialViewport,
  selectedId,
  onSelectNode,
  onDocumentChange,
  updateNodeRef,
  autoLayoutRef,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const viewportRef = useRef<Viewport>(initialViewport)
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { screenToFlowPosition, fitView, setCenter, getZoom } = useReactFlow()

  nodesRef.current = nodes
  edgesRef.current = edges

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<CanvasNodeData>) => {
      setNodes((prev) => {
        const patched = prev.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        )
        const next = syncStoryboardVideoFields(patched, nodeId, patch)
        nodesRef.current = next
        return next
      })
      queueMicrotask(() => {
        onDocumentChange({
          nodes: nodesRef.current,
          edges: edgesRef.current,
          viewport: viewportRef.current,
        })
      })
    },
    [onDocumentChange, setNodes],
  )

  useEffect(() => {
    if (!updateNodeRef) return
    updateNodeRef.current = updateNodeData
    return () => {
      updateNodeRef.current = null
    }
  }, [updateNodeData, updateNodeRef])

  const scheduleEmit = useCallback(() => {
    if (emitTimer.current) clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(() => {
      onDocumentChange({
        nodes: nodesRef.current,
        edges: edgesRef.current,
        viewport: viewportRef.current,
      })
    }, 700)
  }, [onDocumentChange])

  useEffect(() => {
    return () => {
      if (emitTimer.current) clearTimeout(emitTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const target = nodesRef.current.find((n) => n.id === selectedId)
    if (!target) return
    const zoom = Math.max(getZoom(), 0.85)
    void setCenter(target.position.x + 110, target.position.y + 60, {
      zoom,
      duration: 320,
    })
  }, [getZoom, selectedId, setCenter])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedId,
      })),
    [nodes, selectedId],
  )

  const flushEmit = useCallback(() => {
    onDocumentChange({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport: viewportRef.current,
    })
  }, [onDocumentChange])

  const runAutoLayout = useCallback(() => {
    const { nodes: nextNodes, edges: nextEdges } = autoLayoutDocument(
      nodesRef.current,
      edgesRef.current,
    )
    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setNodes(nextNodes)
    setEdges(nextEdges)
    queueMicrotask(flushEmit)
    window.setTimeout(() => {
      void fitView({ padding: 0.2, duration: 420 })
    }, 50)
  }, [fitView, flushEmit, setEdges, setNodes])

  useEffect(() => {
    if (!autoLayoutRef) return
    autoLayoutRef.current = runAutoLayout
    return () => {
      autoLayoutRef.current = null
    }
  }, [autoLayoutRef, runAutoLayout])

  const addNodeAt = useCallback(
    (kind: CanvasNodeKind, position: { x: number; y: number }) => {
      if (kind === 'compose') {
        const exists = nodesRef.current.find((n) => n.data.kind === 'compose')
        if (exists) {
          onSelectNode(exists.id)
          return
        }
      }
      const node = createNodeAt(kind, {
        x: position.x + (Math.random() * 24 - 12),
        y: position.y + (Math.random() * 24 - 12),
      })
      setNodes((prev) => {
        const next = [...prev, node]
        nodesRef.current = next
        return next
      })
      onSelectNode(node.id)
      queueMicrotask(flushEmit)
    },
    [flushEmit, onSelectNode, setNodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((prev) => {
        const next = addEdge(
          {
            ...connection,
            ...defaultEdgeOptions,
            id: `e-${connection.source}-${connection.target}-${Date.now().toString(36)}`,
          },
          prev,
        )
        edgesRef.current = next
        return next
      })
      queueMicrotask(flushEmit)
    },
    [flushEmit, setEdges],
  )

  const openMenu = useCallback(
    (clientX: number, clientY: number) => {
      const flow = screenToFlowPosition({ x: clientX, y: clientY })
      setMenu({
        x: clientX,
        y: clientY,
        flowX: flow.x,
        flowY: flow.y,
      })
    },
    [screenToFlowPosition],
  )

  return (
    <Board>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.08}
        maxZoom={2}
        nodesConnectable
        elementsSelectable
        edgesReconnectable
        selectionOnDrag={false}
        selectionMode={SelectionMode.Partial}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        connectionRadius={28}
        proOptions={{ hideAttribution: true }}
        onNodesChange={(changes) => {
          onNodesChange(changes)
          if (
            changes.some(
              (c) =>
                c.type === 'position' ||
                c.type === 'dimensions' ||
                c.type === 'remove' ||
                c.type === 'add',
            )
          ) {
            scheduleEmit()
          }
        }}
        onEdgesChange={(changes) => {
          onEdgesChange(changes)
          if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
            scheduleEmit()
          }
        }}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          setMenu(null)
          onSelectNode(node.id)
        }}
        onPaneClick={() => {
          setMenu(null)
          onSelectNode(null)
        }}
        onMoveEnd={(_, viewport) => {
          viewportRef.current = viewport
          scheduleEmit()
        }}
        onNodeDragStop={() => scheduleEmit()}
        onPaneContextMenu={(e) => {
          e.preventDefault()
          openMenu(e.clientX, e.clientY)
        }}
        onNodeContextMenu={(e) => {
          e.preventDefault()
          openMenu(e.clientX, e.clientY)
        }}
      >
        <Background color="#3f3f46" gap={20} />
        <Controls
          showInteractive={false}
          onFitView={() => {
            void fitView({ padding: 0.18, duration: 380 })
          }}
        />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {menu ? (
        <ContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onAddNode={addNodeAt}
        />
      ) : null}
    </Board>
  )
}

export default function CanvasBoard(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner {...props} />
    </ReactFlowProvider>
  )
}

const Board = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #0f0f12;

  .react-flow__edge-path {
    stroke: #5eead4;
  }

  .react-flow__connection-path {
    stroke: #5eead4;
  }

  .react-flow__controls {
    border: 1px solid #3f3f46;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .react-flow__controls-button {
    background: #18181b;
    border-bottom-color: #27272a;
    fill: #a1a1aa;

    &:hover {
      background: #27272a;
    }
  }

  .react-flow__minimap {
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 10px;
    overflow: hidden;
  }
`
