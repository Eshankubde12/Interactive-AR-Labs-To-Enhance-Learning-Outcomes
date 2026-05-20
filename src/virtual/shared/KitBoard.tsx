import { useMemo, useState } from 'react'

export type BoardNodeKind = 'power' | 'source' | 'socket' | 'output' | 'ground' | 'meter'

export type BoardNode<TId extends string> = {
  id: TId
  kind: BoardNodeKind
  label: string
  x: number // 0..1
  y: number // 0..1
  group?: string
}

export type BoardWire<TId extends string> = { a: TId; b: TId; status?: 'ok' | 'wrong' | 'hint' }

function norm(a: string, b: string) {
  return a < b ? `${a}__${b}` : `${b}__${a}`
}

export function VirtualKitBoard<TId extends string>({
  title,
  nodes,
  wires,
  selectedStart,
  highlighted,
  onNodeClick,
  onWireRemove,
  underlay,
}: {
  title: string
  nodes: BoardNode<TId>[]
  wires: BoardWire<TId>[]
  selectedStart: TId | null
  highlighted?: { from?: TId; to?: TId; nodes?: TId[] }
  onNodeClick: (id: TId) => void
  onWireRemove?: (wire: BoardWire<TId>) => void
  underlay?: React.ReactNode
}) {
  const nodesById = useMemo(() => {
    const m = new Map<TId, BoardNode<TId>>()
    for (const n of nodes) m.set(n.id, n)
    return m
  }, [nodes])

  const hintNodeSet = useMemo(() => new Set(highlighted?.nodes ?? []), [highlighted?.nodes])
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const selectedNode = selectedStart ? nodesById.get(selectedStart) ?? null : null

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: 12,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <p className="card-title">{title}</p>
        <span className="pill">Tap terminals to connect</span>
      </div>

      <div style={{ padding: 12 }}>
        <svg
          viewBox="0 0 1000 650"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 16,
            border: '1px solid var(--border)',
            background:
              'radial-gradient(700px 420px at 15% 20%, rgba(124,58,237,0.20), transparent 55%), radial-gradient(600px 380px at 90% 30%, rgba(34,211,238,0.16), transparent 60%), rgba(0,0,0,0.25)',
          }}
          onPointerMove={(e) => {
            const svg = e.currentTarget
            const rect = svg.getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * 1000
            const y = ((e.clientY - rect.top) / rect.height) * 650
            setPointer({ x, y })
          }}
          onPointerLeave={() => setPointer(null)}
        >
          {/* custom underlay (kit faceplate) */}
          {underlay ?? (
            <>
              {/* board frame */}
              <rect
                x="18"
                y="18"
                width="964"
                height="614"
                rx="26"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.12)"
              />

              {/* groups labels */}
              {renderGroup('INPUT SOURCES', 60, 90)}
              {renderGroup('KIT INPUT SOCKETS', 410, 90)}
              {renderGroup('OUTPUTS', 760, 120)}
              {renderGroup('METER / GND', 720, 505)}
            </>
          )}

          {/* wires */}
          {wires.map((w) => {
            const a = nodesById.get(w.a)
            const b = nodesById.get(w.b)
            if (!a || !b) return null
            const key = norm(String(w.a), String(w.b))
            const sx = a.x * 1000
            const sy = a.y * 650
            const tx = b.x * 1000
            const ty = b.y * 650
            const dx = Math.abs(tx - sx)
            const c1x = sx + (tx > sx ? 1 : -1) * Math.max(80, dx * 0.35)
            const c2x = tx - (tx > sx ? 1 : -1) * Math.max(80, dx * 0.35)
            const path = `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`
            const okColor = (() => {
              const kinds = [a.kind, b.kind]
              if (kinds.includes('power'))  return 'rgba(34,211,238,0.85)'
              if (kinds.includes('source')) return 'rgba(34,211,238,0.85)'
              if (kinds.includes('output')) return 'rgba(168,85,247,0.85)'
              if (kinds.includes('ground')) return 'rgba(107,114,128,0.85)'
              if (kinds.includes('meter'))  return 'rgba(245,158,11,0.85)'
              return 'rgba(255,255,255,0.78)'
            })()
            const stroke =
              w.status === 'wrong'
                ? 'rgba(239,68,68,0.95)'
                : w.status === 'hint'
                  ? 'rgba(245,158,11,0.95)'
                  : okColor
            const width = w.status === 'wrong' ? 7 : w.status === 'hint' ? 6 : 5
            return (
              <g key={key}>
                <path d={path} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />
                {onWireRemove ? (
                  <circle
                    cx={(sx + tx) / 2}
                    cy={(sy + ty) / 2}
                    r="14"
                    fill="rgba(0,0,0,0.40)"
                    stroke="rgba(255,255,255,0.18)"
                    onClick={() => onWireRemove(w)}
                    style={{ cursor: 'pointer' }}
                  />
                ) : null}
                {onWireRemove ? (
                  <text
                    x={(sx + tx) / 2}
                    y={(sy + ty) / 2 + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fill="rgba(255,255,255,0.8)"
                    style={{ pointerEvents: 'none' }}
                  >
                    ✕
                  </text>
                ) : null}
              </g>
            )
          })}

          {/* ghost wire while connecting */}
          {selectedNode && pointer ? (
            (() => {
              const sx = selectedNode.x * 1000
              const sy = selectedNode.y * 650
              const tx = pointer.x
              const ty = pointer.y
              const dx = Math.abs(tx - sx)
              const c1x = sx + (tx > sx ? 1 : -1) * Math.max(80, dx * 0.35)
              const c2x = tx - (tx > sx ? 1 : -1) * Math.max(80, dx * 0.35)
              const path = `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`
              return (
                <path
                  d={path}
                  fill="none"
                  stroke="rgba(34,211,238,0.85)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray="12 10"
                />
              )
            })()
          ) : null}

          {/* guide hint wire */}
          {highlighted?.from && highlighted?.to ? (
            (() => {
              const a = nodesById.get(highlighted.from)
              const b = nodesById.get(highlighted.to)
              if (!a || !b) return null
              const sx = a.x * 1000
              const sy = a.y * 650
              const tx = b.x * 1000
              const ty = b.y * 650
              const dx = Math.abs(tx - sx)
              const c1x = sx + (tx > sx ? 1 : -1) * Math.max(80, dx * 0.35)
              const c2x = tx - (tx > sx ? 1 : -1) * Math.max(80, dx * 0.35)
              const path = `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`
              return (
                <path
                  d={path}
                  fill="none"
                  stroke="rgba(245,158,11,0.95)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray="10 10"
                />
              )
            })()
          ) : null}

          {/* nodes */}
          {nodes.map((n) => {
            const cx = n.x * 1000
            const cy = n.y * 650
            const selected = selectedStart === n.id
            const hinted = hintNodeSet.has(n.id) || highlighted?.from === n.id || highlighted?.to === n.id
            const fill =
              n.kind === 'power'
                ? 'rgba(34,211,238,0.22)'
                : n.kind === 'output'
                  ? 'rgba(124,58,237,0.22)'
                  : n.kind === 'ground'
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(255,255,255,0.10)'
            const stroke =
              selected
                ? 'rgba(34,211,238,0.9)'
                : hinted
                  ? 'rgba(245,158,11,0.9)'
                  : 'rgba(255,255,255,0.22)'

            return (
              <g
                key={n.id}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  onNodeClick(n.id)
                }}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={cx} cy={cy} r="22" fill="rgba(0,0,0,0.35)" />
                <circle cx={cx} cy={cy} r="18" fill={fill} stroke={stroke} strokeWidth="3" />
                <circle cx={cx} cy={cy} r="6" fill="rgba(255,255,255,0.75)" />
                <text x={cx} y={cy - 30} textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.82)">
                  {n.label}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="p" style={{ marginTop: 10 }}>
          Tip: tap (or press) a terminal, then tap another to connect. While connecting, a ghost wire follows your finger/mouse.
        </p>
      </div>
    </div>
  )
}

function renderGroup(label: string, x: number, y: number) {
  return (
    <g>
      <text x={x} y={y} fontSize="16" fill="rgba(255,255,255,0.75)" fontWeight="700">
        {label}
      </text>
    </g>
  )
}

