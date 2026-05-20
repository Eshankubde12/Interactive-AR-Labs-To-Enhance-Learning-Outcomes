import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'
import { halfSubtractor, type Bit } from '../shared/digitalLogic'

type NodeId =
  | 'POWER' | 'A_SRC' | 'B_SRC'
  | 'A_IN' | 'B_IN'
  | 'HS_DIFF' | 'HS_BORROW'
  | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',     kind: 'power',  label: 'POWER',      x: 0.915, y: 0.20 },
  { id: 'A_SRC',     kind: 'source', label: 'A SRC',      x: 0.08,  y: 0.35 },
  { id: 'B_SRC',     kind: 'source', label: 'B SRC',      x: 0.08,  y: 0.55 },
  { id: 'A_IN',      kind: 'socket', label: 'A IN',       x: 0.40,  y: 0.35 },
  { id: 'B_IN',      kind: 'socket', label: 'B IN',       x: 0.40,  y: 0.55 },
  { id: 'HS_DIFF',   kind: 'output', label: 'DIFF',       x: 0.76,  y: 0.40 },
  { id: 'HS_BORROW', kind: 'output', label: 'BORROW',     x: 0.76,  y: 0.58 },
  { id: 'GND',       kind: 'ground', label: 'GND',        x: 0.88,  y: 0.72 },
  { id: 'METER',     kind: 'meter',  label: 'METER',      x: 0.88,  y: 0.84 },
]

const STEPS = [
  { id: 'power',     title: 'Power ON',                    description: 'Turn the trainer power ON.',                              requiredWires: [] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-a',   title: 'Patch A source to A input',   description: 'Connect A SRC to A IN.',                                 requiredWires: [{ a: 'A_SRC', b: 'A_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-b',   title: 'Patch B source to B input',   description: 'Connect B SRC to B IN.',                                 requiredWires: [{ a: 'B_SRC', b: 'B_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'meter-gnd', title: 'Connect METER to GND',        description: 'Connect METER to GND as the reference.',                  requiredWires: [{ a: 'METER', b: 'GND' }] as { a: NodeId; b: NodeId }[] },
  { id: 'observe',   title: 'Toggle inputs, verify outputs', description: 'Toggle A and B through all 4 combinations. Verify DIFF and BORROW.', requiredWires: [] as { a: NodeId; b: NodeId }[] },
] as const

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  return wires.some((w) => norm(w.a, w.b) === norm(a, b))
}

function hsUnderlay(opts: {
  powerOn: boolean; A: Bit; B: Bit; connected: boolean
  hsDiff: Bit; hsBorrow: Bit
}) {
  const { powerOn, A, B, connected, hsDiff, hsBorrow } = opts
  const bit = (v: Bit) => v ? '1' : '0'
  const col = (v: Bit) => v ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)'
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">HALF SUBTRACTOR</text>
      {/* power */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* Input display */}
      <g>
        <rect x="60" y="120" width="200" height="110" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" />
        <text x="160" y="146" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">INPUTS</text>
        {[A, B].map((v, i) => (
          <g key={i}>
            <circle cx={100 + i * 120} cy="185" r="24" fill={connected && v ? 'rgba(34,211,238,0.35)' : 'rgba(0,0,0,0.3)'} stroke={connected && v ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
            <text x={100 + i * 120} y="191" textAnchor="middle" fontSize="18" fill="rgba(255,255,255,0.9)" fontWeight="800">{connected ? bit(v) : '?'}</text>
            <text x={100 + i * 120} y="216" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.6)">{i === 0 ? 'A' : 'B'}</text>
          </g>
        ))}
      </g>
      {/* Half Subtractor block */}
      <g>
        <rect x="300" y="200" width="260" height="200" rx="12" fill="rgba(34,211,238,0.08)" stroke="rgba(34,211,238,0.35)" strokeWidth="2" />
        <text x="430" y="232" textAnchor="middle" fontSize="15" fill="rgba(34,211,238,0.9)" fontWeight="700">HALF SUBTRACTOR</text>
        <text x="430" y="254" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)">DIFF = A⊕B   BORROW = A'·B</text>
        <g>
          <text x="340" y="310" fontSize="13" fill="rgba(255,255,255,0.65)">DIFF</text>
          <circle cx="418" cy="304" r="20" fill={connected && hsDiff ? 'rgba(34,211,238,0.3)' : 'rgba(0,0,0,0.3)'} stroke={connected && hsDiff ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
          <text x="418" y="310" textAnchor="middle" fontSize="16" fill={col(hsDiff)} fontWeight="800">{connected ? bit(hsDiff) : '?'}</text>
          <text x="468" y="310" fontSize="13" fill="rgba(255,255,255,0.65)">BORROW</text>
          <circle cx="556" cy="304" r="20" fill={connected && hsBorrow ? 'rgba(34,211,238,0.3)' : 'rgba(0,0,0,0.3)'} stroke={connected && hsBorrow ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
          <text x="556" y="310" textAnchor="middle" fontSize="16" fill={col(hsBorrow)} fontWeight="800">{connected ? bit(hsBorrow) : '?'}</text>
        </g>
      </g>
    </>
  )
}

const COMBOS: [Bit, Bit][] = [[0, 0], [0, 1], [1, 0], [1, 1]]

export function VirtualHalfAdderLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [A, setA] = useState<Bit>(0)
  const [B, setB] = useState<Bit>(0)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ A: Bit; B: Bit; diff: Bit; borrow: Bit }[]>([])

  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)
  const step = STEPS[stepIdx]

  const connected = useMemo(() => {
    return powerOn && hasW(wires, 'A_SRC', 'A_IN') && hasW(wires, 'B_SRC', 'B_IN')
  }, [powerOn, wires])

  const hs = useMemo(() => connected ? halfSubtractor(A, B) : { diff: 0 as Bit, borrow: 0 as Bit }, [A, B, connected])

  const stepDone = useMemo(() => {
    if (step.id === 'power') return powerOn
    return step.requiredWires.every((w) => hasW(wires, w.a, w.b))
  }, [powerOn, step, wires])

  const highlighted = useMemo(() => {
    const req = step.requiredWires[0]
    if (!req) return { nodes: ['POWER' as NodeId] }
    return { from: req.a, to: req.b, nodes: [req.a, req.b] as NodeId[] }
  }, [step])

  const boardWires: BoardWire<NodeId>[] = useMemo(() =>
    wires.map((w) => ({ a: w.a, b: w.b, status: 'ok' as const })), [wires])

  const onNodeClick = (id: NodeId) => {
    if (id === 'POWER') { setPowerOn((v) => !v); return }
    if (wireStart === null) { setWireStart(id); return }
    if (wireStart === id) { setWireStart(null); return }
    const w = { a: wireStart, b: id }
    const k = normW(w)
    setWires((prev) => (prev.some((x) => normW(x) === k) ? prev : [...prev, w]))
    setWireStart(null)
  }

  const bit = (v: Bit) => v ? '1' : '0'

  return (
    <div className="two-col">
      <VirtualKitBoard<NodeId>
        title={`Virtual Digital Lab — ${practical.title}`}
        nodes={NODES} wires={boardWires} selectedStart={wireStart}
        highlighted={highlighted} onNodeClick={onNodeClick}
        onWireRemove={(w) => setWires((prev) => prev.filter((x) => normW(x) !== normW({ a: w.a, b: w.b })))}
        underlay={hsUnderlay({ powerOn, A, B, connected, hsDiff: hs.diff, hsBorrow: hs.borrow })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>Practical #{practical.srNo} — Half Subtractor</h2>
        <p className="p" style={{ marginTop: 8 }}>Toggle A and B. Verify DIFF (A⊕B) and BORROW (A'·B) for all input combinations.</p>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row"><p className="card-title">Guide</p><span className="pill">Step {stepIdx + 1}/{STEPS.length}</span></div>
          <p className="p" style={{ marginTop: 8 }}><b>{step.title}</b>: {step.description}</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" disabled={stepIdx === 0} onClick={() => setStepIdx((v) => Math.max(0, v - 1))}>Previous</button>
            <button className="btn" disabled={!step.requiredWires[0] || stepDone} onClick={() => step.requiredWires[0] && setWireStart(step.requiredWires[0].a)}>Show connection</button>
            <button className="btn primary" disabled={!stepDone} onClick={() => setStepIdx((v) => Math.min(STEPS.length - 1, v + 1))}>Next</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Input toggles</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <button className="btn primary" disabled={!powerOn} onClick={() => setA((v) => (v ? 0 : 1) as Bit)} style={{ minWidth: 80, fontFamily: 'ui-monospace,monospace', fontSize: 20 }}>A = {bit(A)}</button>
            <button className="btn primary" disabled={!powerOn} onClick={() => setB((v) => (v ? 0 : 1) as Bit)} style={{ minWidth: 80, fontFamily: 'ui-monospace,monospace', fontSize: 20 }}>B = {bit(B)}</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Live outputs</p>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            <p className="card-title" style={{ fontSize: 12, opacity: 0.7 }}>Half Subtractor (A − B)</p>
            <div className="row"><span className="pill">DIFF = A⊕B</span><span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 18, fontWeight: 800, color: hs.diff ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>{connected ? bit(hs.diff) : '—'}</span></div>
            <div className="row"><span className="pill">BORROW = A'·B</span><span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 18, fontWeight: 800, color: hs.borrow ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>{connected ? bit(hs.borrow) : '—'}</span></div>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Full truth table</p>
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
              <thead>
                <tr>{['A','B','DIFF','BORROW'].map((h) => (
                  <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {COMBOS.map(([a, b]) => {
                  const rhs = halfSubtractor(a, b)
                  const isCurrent = connected && A === a && B === b
                  return (
                    <tr key={`${a}${b}`} style={{ background: isCurrent ? 'rgba(34,211,238,0.08)' : undefined }}>
                      {[a, b, rhs.diff, rhs.borrow].map((v, i) => (
                        <td key={i} style={{ padding: '4px 8px', textAlign: 'center', color: v ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.8)', fontWeight: 700 }}>{bit(v as Bit)}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Observation table</p>
            <button className="btn primary" disabled={!connected} onClick={() => setSamples((prev) => [...prev, { A, B, diff: hs.diff, borrow: hs.borrow }])}>Add reading</button>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {samples.slice(-6).map((s, i) => (
                <div key={i} className="row" style={{ fontSize: 12 }}>
                  <span className="pill">A={bit(s.A)} B={bit(s.B)}</span>
                  <span className="pill">DIFF={bit(s.diff)} BORROW={bit(s.borrow)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'XOR Gate', description: 'Half subtractor uses an XOR gate to compute DIFF = A⊕B.' })}>XOR Gate</button>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'AND / NOT Gates', description: 'BORROW = A\'·B uses a NOT gate on A and an AND gate.' })}>AND/NOT</button>
          </div>
        </div>
      </div>
      {hotspotOpen && (
        <Modal3D title={hotspotOpen.label} onClose={() => setHotspotOpen(null)}>
          <p className="p" style={{ marginBottom: 10 }}>{hotspotOpen.description}</p>
          <ComponentViewer3D kind="xor" />
        </Modal3D>
      )}
    </div>
  )
}
