import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'
import { and, or, not, xor, type Bit } from '../shared/digitalLogic'

type NodeId =
  | 'POWER' | 'A_SRC' | 'B_SRC'
  | 'A_IN' | 'B_IN'
  | 'AND_OUT' | 'OR_OUT' | 'XOR_OUT' | 'NAND_OUT' | 'NOR_OUT'
  | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',    kind: 'power',  label: 'POWER',   x: 0.915, y: 0.20 },
  { id: 'A_SRC',   kind: 'source', label: 'A SRC',   x: 0.08,  y: 0.35 },
  { id: 'B_SRC',   kind: 'source', label: 'B SRC',   x: 0.08,  y: 0.55 },
  { id: 'A_IN',    kind: 'socket', label: 'A IN',    x: 0.40,  y: 0.35 },
  { id: 'B_IN',    kind: 'socket', label: 'B IN',    x: 0.40,  y: 0.55 },
  { id: 'AND_OUT', kind: 'output', label: 'AND',     x: 0.76,  y: 0.25 },
  { id: 'OR_OUT',  kind: 'output', label: 'OR',      x: 0.76,  y: 0.38 },
  { id: 'XOR_OUT', kind: 'output', label: 'XOR',     x: 0.76,  y: 0.50 },
  { id: 'NAND_OUT',kind: 'output', label: 'NAND',    x: 0.76,  y: 0.62 },
  { id: 'NOR_OUT', kind: 'output', label: 'NOR',     x: 0.76,  y: 0.74 },
  { id: 'GND',     kind: 'ground', label: 'GND',     x: 0.88,  y: 0.74 },
  { id: 'METER',   kind: 'meter',  label: 'METER',   x: 0.88,  y: 0.85 },
]

const STEPS = [
  { id: 'power',   title: 'Power ON',                  description: 'Turn the trainer power ON.',                                         requiredWires: [] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-a', title: 'Patch A source to A input',  description: 'Connect A SRC to A IN.',                                             requiredWires: [{ a: 'A_SRC', b: 'A_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-b', title: 'Patch B source to B input',  description: 'Connect B SRC to B IN.',                                             requiredWires: [{ a: 'B_SRC', b: 'B_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'meter-gnd', title: 'Connect METER to GND',     description: 'Connect METER to GND (multimeter reference).',                       requiredWires: [{ a: 'METER', b: 'GND' }] as { a: NodeId; b: NodeId }[] },
  { id: 'measure', title: 'Toggle A & B, measure gates', description: 'Toggle A and B. Connect METER to each output. Verify all 4 rows.', requiredWires: [] as { a: NodeId; b: NodeId }[] },
] as const

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  const k = norm(a, b); return wires.some((w) => norm(w.a, w.b) === k)
}

const nand = (a: Bit, b: Bit): Bit => not(and(a, b))
const nor = (a: Bit, b: Bit): Bit => not(or(a, b))
const xnor = (a: Bit, b: Bit): Bit => not(xor(a, b))

function gatesUnderlay(opts: {
  powerOn: boolean; A: Bit; B: Bit; connected: boolean
  andOut: Bit; orOut: Bit; xorOut: Bit; nandOut: Bit; norOut: Bit
}) {
  const { powerOn, A, B, connected, andOut, orOut, xorOut, nandOut, norOut } = opts
  const bit = (v: Bit) => v ? '1' : '0'
  const col = (v: Bit) => v ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)'
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">TTL LOGIC GATES — TRUTH TABLE VERIFICATION</text>
      {/* power */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* Input indicators */}
      <g>
        <rect x="60" y="120" width="200" height="110" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" />
        <text x="160" y="146" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">INPUTS</text>
        <circle cx="100" cy="185" r="24" fill={connected && A ? 'rgba(34,211,238,0.35)' : 'rgba(0,0,0,0.3)'} stroke={connected && A ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
        <text x="100" y="191" textAnchor="middle" fontSize="18" fill="rgba(255,255,255,0.9)" fontWeight="800">{connected ? bit(A) : '?'}</text>
        <text x="100" y="216" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.6)">A</text>
        <circle cx="220" cy="185" r="24" fill={connected && B ? 'rgba(34,211,238,0.35)' : 'rgba(0,0,0,0.3)'} stroke={connected && B ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
        <text x="220" y="191" textAnchor="middle" fontSize="18" fill="rgba(255,255,255,0.9)" fontWeight="800">{connected ? bit(B) : '?'}</text>
        <text x="220" y="216" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.6)">B</text>
      </g>
      {/* Gate outputs */}
      {[
        ['AND', andOut, 300],
        ['OR', orOut, 390],
        ['XOR', xorOut, 480],
        ['NAND', nandOut, 570],
        ['NOR', norOut, 660],
      ].map(([label, val, x]) => (
        <g key={label as string}>
          <rect x={(x as number) - 60} y="120" width="120" height="110" rx="10" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.12)" />
          <text x={x as number} y="146" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.6)" fontWeight="700">{label as string}</text>
          <circle cx={x as number} cy="185" r="24" fill={connected && val ? 'rgba(34,211,238,0.35)' : 'rgba(0,0,0,0.3)'} stroke={connected && val ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
          <text x={x as number} y="191" textAnchor="middle" fontSize="18" fill={col(val as Bit)} fontWeight="800">{connected ? bit(val as Bit) : '?'}</text>
        </g>
      ))}
      {/* Truth table on board */}
      {connected ? (
        <g>
          <text x="500" y="310" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">CURRENT STATE</text>
          <text x="500" y="340" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.55)" fontFamily="ui-monospace,Consolas,monospace">
            A={bit(A)} B={bit(B)} → AND={bit(andOut)} OR={bit(orOut)} XOR={bit(xorOut)} NAND={bit(nandOut)} NOR={bit(norOut)}
          </text>
        </g>
      ) : null}
    </>
  )
}

const COMBOS: [Bit, Bit][] = [[0, 0], [0, 1], [1, 0], [1, 1]]

export function VirtualLogicGatesLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [A, setA] = useState<Bit>(0)
  const [B, setB] = useState<Bit>(0)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ A: Bit; B: Bit; AND: Bit; OR: Bit; XOR: Bit; NAND: Bit; NOR: Bit }[]>([])

  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)
  const step = STEPS[stepIdx]

  const connected = useMemo(() => {
    const h = (a: NodeId, b: NodeId) => hasW(wires, a, b)
    return powerOn && h('A_SRC', 'A_IN') && h('B_SRC', 'B_IN')
  }, [powerOn, wires])

  const outputs = useMemo(() => ({
    AND: (connected ? and(A, B) : 0) as Bit,
    OR: (connected ? or(A, B) : 0) as Bit,
    XOR: (connected ? xor(A, B) : 0) as Bit,
    NAND: (connected ? nand(A, B) : 0) as Bit,
    NOR: (connected ? nor(A, B) : 0) as Bit,
    XNOR: (connected ? xnor(A, B) : 0) as Bit,
    NOT_A: (connected ? not(A) : 0) as Bit,
    NOT_B: (connected ? not(B) : 0) as Bit,
  }), [A, B, connected])

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
        underlay={gatesUnderlay({ powerOn, A, B, connected, andOut: outputs.AND, orOut: outputs.OR, xorOut: outputs.XOR, nandOut: outputs.NAND, norOut: outputs.NOR })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>Practical #{practical.srNo} — TTL Logic Gates</h2>
        <p className="p" style={{ marginTop: 8 }}>Toggle inputs A and B. Verify AND/OR/NOT/NAND/NOR/XOR outputs simultaneously.</p>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Guide</p>
            <span className="pill">Step {stepIdx + 1}/{STEPS.length}</span>
          </div>
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
            <button className="btn primary" disabled={!powerOn} onClick={() => setA((v) => (v ? 0 : 1) as Bit)}
              style={{ minWidth: 80, fontFamily: 'ui-monospace,monospace', fontSize: 20 }}>A = {bit(A)}</button>
            <button className="btn primary" disabled={!powerOn} onClick={() => setB((v) => (v ? 0 : 1) as Bit)}
              style={{ minWidth: 80, fontFamily: 'ui-monospace,monospace', fontSize: 20 }}>B = {bit(B)}</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Live gate outputs</p>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {[
              ['AND',  'A·B',   outputs.AND],
              ['OR',   'A+B',   outputs.OR],
              ['XOR',  'A⊕B',   outputs.XOR],
              ['NAND', '(A·B)\'', outputs.NAND],
              ['NOR',  '(A+B)\'', outputs.NOR],
              ['XNOR', '(A⊕B)\'', outputs.XNOR],
              ["NOT A", "A'",   outputs.NOT_A],
              ["NOT B", "B'",   outputs.NOT_B],
            ].map(([label, expr, val]) => (
              <div key={label as string} className="row">
                <span className="pill" style={{ minWidth: 60 }}>{label as string}</span>
                <span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, opacity: 0.7 }}>{expr as string}</span>
                <span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 18, fontWeight: 800, color: (val as Bit) ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>
                  {connected ? bit(val as Bit) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Full truth table (all combinations)</p>
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
              <thead>
                <tr>{['A','B','AND','OR','XOR','NAND','NOR','XNOR'].map((h) => (
                  <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {COMBOS.map(([a, b]) => {
                  const row = { AND: and(a,b), OR: or(a,b), XOR: xor(a,b), NAND: nand(a,b), NOR: nor(a,b), XNOR: xnor(a,b) }
                  const isCurrent = connected && A === a && B === b
                  return (
                    <tr key={`${a}${b}`} style={{ background: isCurrent ? 'rgba(34,211,238,0.08)' : undefined }}>
                      {[a, b, row.AND, row.OR, row.XOR, row.NAND, row.NOR, row.XNOR].map((v, i) => (
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
            <button className="btn primary" disabled={!connected} onClick={() => setSamples((prev) => [...prev, { A, B, ...outputs }])}>Add reading</button>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {samples.slice(-6).map((s, i) => (
                <div key={i} className="row" style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
                  <span className="pill">A={bit(s.A)} B={bit(s.B)}</span>
                  <span className="pill">AND={bit(s.AND)}</span>
                  <span className="pill">OR={bit(s.OR)}</span>
                  <span className="pill">XOR={bit(s.XOR)}</span>
                  <span className="pill">NAND={bit(s.NAND)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'TTL Logic IC', description: 'TTL ICs (74-series) implement AND, OR, NOT, NAND, NOR, XOR gates in a single DIP package.' })}>TTL IC</button>
          </div>
        </div>
      </div>
      {hotspotOpen && (
        <Modal3D title={hotspotOpen.label} onClose={() => setHotspotOpen(null)}>
          <p className="p" style={{ marginBottom: 10 }}>{hotspotOpen.description}</p>
          <ComponentViewer3D kind="ic" />
        </Modal3D>
      )}
    </div>
  )
}
