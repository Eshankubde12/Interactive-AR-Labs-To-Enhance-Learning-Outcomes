import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'
import { srNandLatch, type Bit } from '../shared/digitalLogic'

type NodeId =
  | 'POWER' | 'S_SRC' | 'R_SRC'
  | 'S_IN' | 'R_IN'
  | 'Q_OUT' | 'QB_OUT'
  | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',  kind: 'power',  label: 'POWER',  x: 0.915, y: 0.20 },
  { id: 'S_SRC',  kind: 'source', label: "S' SRC", x: 0.08,  y: 0.35 },
  { id: 'R_SRC',  kind: 'source', label: "R' SRC", x: 0.08,  y: 0.55 },
  { id: 'S_IN',   kind: 'socket', label: "S' IN",  x: 0.40,  y: 0.35 },
  { id: 'R_IN',   kind: 'socket', label: "R' IN",  x: 0.40,  y: 0.55 },
  { id: 'Q_OUT',  kind: 'output', label: 'Q',      x: 0.76,  y: 0.35 },
  { id: 'QB_OUT', kind: 'output', label: "Q'",     x: 0.76,  y: 0.55 },
  { id: 'GND',    kind: 'ground', label: 'GND',    x: 0.88,  y: 0.68 },
  { id: 'METER',  kind: 'meter',  label: 'METER',  x: 0.88,  y: 0.80 },
]

const STEPS = [
  { id: 'power',    title: 'Power ON',                    description: 'Turn the trainer power ON.',                                                                  requiredWires: [] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-s',  title: "Patch S' source to S' input", description: "Connect S' SRC to S' IN.",                                                                   requiredWires: [{ a: 'S_SRC', b: 'S_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-r',  title: "Patch R' source to R' input", description: "Connect R' SRC to R' IN.",                                                                   requiredWires: [{ a: 'R_SRC', b: 'R_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'meter-gnd',title: 'Connect METER to GND',        description: 'Connect METER to GND.',                                                                      requiredWires: [{ a: 'METER', b: 'GND' }] as { a: NodeId; b: NodeId }[] },
  { id: 'observe',  title: 'Verify latch behavior',       description: "Toggle S' and R' to SET, RESET, and HOLD. Observe Q and Q'. Avoid S'=R'=0 (invalid).",       requiredWires: [] as { a: NodeId; b: NodeId }[] },
] as const

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  return wires.some((w) => norm(w.a, w.b) === norm(a, b))
}

function srUnderlay(opts: {
  powerOn: boolean; S: Bit; R: Bit; Q: Bit; Qbar: Bit; invalid: boolean; connected: boolean
}) {
  const { powerOn, S, R, Q, Qbar, invalid, connected } = opts
  const bit = (v: Bit) => v ? '1' : '0'
  const stateLabel = !connected ? 'IDLE' : invalid ? 'INVALID' : S === 0 && R === 1 ? 'SET' : S === 1 && R === 0 ? 'RESET' : 'HOLD'
  const stateColor = invalid ? 'rgba(239,68,68,0.95)' : stateLabel === 'SET' ? 'rgba(34,211,238,0.95)' : stateLabel === 'RESET' ? 'rgba(245,158,11,0.95)' : 'rgba(255,255,255,0.6)'
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">SR FLIP-FLOP (NAND LATCH)</text>
      {/* power */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* NAND latch symbol */}
      <g>
        <rect x="340" y="200" width="320" height="260" rx="14" fill="rgba(0,0,0,0.40)" stroke="rgba(124,58,237,0.5)" strokeWidth="2" />
        <text x="500" y="230" textAnchor="middle" fontSize="15" fill="rgba(124,58,237,0.9)" fontWeight="700">NAND LATCH</text>
        {/* upper NAND */}
        <rect x="360" y="248" width="120" height="60" rx="8" fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.4)" />
        <text x="420" y="283" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)" fontWeight="700">NAND₁</text>
        {/* lower NAND */}
        <rect x="360" y="348" width="120" height="60" rx="8" fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.4)" />
        <text x="420" y="383" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)" fontWeight="700">NAND₂</text>
        {/* Q output */}
        <circle cx="600" cy="278" r="26" fill={connected && Q ? 'rgba(34,211,238,0.25)' : 'rgba(0,0,0,0.3)'} stroke={connected && Q ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
        <text x="600" y="284" textAnchor="middle" fontSize="20" fill={connected && Q ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)'} fontWeight="800">{connected ? bit(Q) : '?'}</text>
        <text x="600" y="320" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">Q</text>
        {/* Qbar output */}
        <circle cx="600" cy="378" r="26" fill={connected && Qbar ? 'rgba(34,211,238,0.25)' : 'rgba(0,0,0,0.3)'} stroke={connected && Qbar ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
        <text x="600" y="384" textAnchor="middle" fontSize="20" fill={connected && Qbar ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)'} fontWeight="800">{connected ? bit(Qbar) : '?'}</text>
        <text x="600" y="420" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">Q'</text>
      </g>
      {/* State banner */}
      <g>
        <rect x="350" y="490" width="300" height="50" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" />
        <text x="500" y="520" textAnchor="middle" fontSize="16" fill={stateColor} fontWeight="800">STATE: {stateLabel}</text>
      </g>
      {/* S, R indicators */}
      <g>
        <rect x="60" y="240" width="200" height="140" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" />
        <text x="160" y="265" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)" fontWeight="700">ACTIVE-LOW INPUTS</text>
        {[
          { label: "S'", val: S, cy: 310 },
          { label: "R'", val: R, cy: 350 },
        ].map(({ label, val, cy }) => (
          <g key={label}>
            <text x="90" y={cy + 5} fontSize="13" fill="rgba(255,255,255,0.65)">{label} =</text>
            <circle cx="170" cy={cy} r="22" fill={connected && !val ? 'rgba(34,211,238,0.3)' : 'rgba(0,0,0,0.3)'} stroke={connected && !val ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
            <text x="170" y={cy + 6} textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.9)" fontWeight="800">{connected ? bit(val) : '?'}</text>
          </g>
        ))}
      </g>
      {invalid && connected && (
        <text x="500" y="580" textAnchor="middle" fontSize="14" fill="rgba(239,68,68,0.95)" fontWeight="700">⚠ Invalid state: S'=R'=0 is not allowed in NAND latch</text>
      )}
    </>
  )
}

const SR_TABLE: { S: Bit; R: Bit; Q: string; state: string }[] = [
  { S: 0, R: 1, Q: '1', state: 'SET' },
  { S: 1, R: 0, Q: '0', state: 'RESET' },
  { S: 1, R: 1, Q: 'Q (hold)', state: 'HOLD (no change)' },
  { S: 0, R: 0, Q: '1,1 ⚠', state: 'INVALID' },
]

export function VirtualSrFlipFlopLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  // Active-low: default both HIGH (=1), meaning HOLD
  const [S, setS] = useState<Bit>(1)
  const [R, setR] = useState<Bit>(1)
  const [prevQ, setPrevQ] = useState<Bit>(0)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ S: Bit; R: Bit; Q: Bit; Qbar: Bit; state: string }[]>([])

  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)
  const step = STEPS[stepIdx]

  const connected = useMemo(() =>
    powerOn && hasW(wires, 'S_SRC', 'S_IN') && hasW(wires, 'R_SRC', 'R_IN'), [powerOn, wires])

  const latch = useMemo(() => {
    if (!connected) return { Q: 0 as Bit, Qbar: 1 as Bit, invalid: false }
    return srNandLatch(S, R, prevQ)
  }, [S, R, prevQ, connected])

  // Update prevQ when latch output changes (non-invalid)
  const applyInputs = (newS: Bit, newR: Bit) => {
    const result = srNandLatch(newS, newR, prevQ)
    if (!result.invalid) setPrevQ(result.Q)
    if (newS !== S) setS(newS)
    if (newR !== R) setR(newR)
  }

  const stateLabel = !connected ? 'IDLE' : latch.invalid ? 'INVALID' : S === 0 && R === 1 ? 'SET' : S === 1 && R === 0 ? 'RESET' : 'HOLD'

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
        underlay={srUnderlay({ powerOn, S, R, Q: latch.Q, Qbar: latch.Qbar, invalid: latch.invalid, connected })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>Practical #{practical.srNo} — SR Flip-Flop (NAND Latch)</h2>
        <p className="p" style={{ marginTop: 8 }}>Active-low inputs. Toggle S' and R' to SET, RESET, and HOLD. Verify latch memory.</p>

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
          <p className="card-title">Active-low input toggles</p>
          <p className="p" style={{ marginTop: 6, fontSize: 12 }}>0 = active (LOW), 1 = inactive (HIGH)</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={!powerOn} onClick={() => applyInputs(S === 0 ? 1 : 0, R)} style={{ minWidth: 80, fontFamily: 'ui-monospace,monospace', fontSize: 18 }}>S' = {bit(S)}</button>
            <button className="btn primary" disabled={!powerOn} onClick={() => applyInputs(S, R === 0 ? 1 : 0)} style={{ minWidth: 80, fontFamily: 'ui-monospace,monospace', fontSize: 18 }}>R' = {bit(R)}</button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" disabled={!powerOn} onClick={() => applyInputs(0, 1)}>SET (S'=0, R'=1)</button>
            <button className="btn" disabled={!powerOn} onClick={() => applyInputs(1, 0)}>RESET (S'=1, R'=0)</button>
            <button className="btn" disabled={!powerOn} onClick={() => applyInputs(1, 1)}>HOLD (S'=1, R'=1)</button>
          </div>
          {latch.invalid && connected && (
            <p style={{ color: 'rgba(239,68,68,0.95)', marginTop: 8, fontSize: 13 }}>⚠ Invalid: S'=R'=0 is not allowed in a NAND latch.</p>
          )}
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Live outputs</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div className="row"><span className="pill">Q</span><span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 20, fontWeight: 800, color: latch.Q ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>{connected ? bit(latch.Q) : '—'}</span></div>
            <div className="row"><span className="pill">Q'</span><span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 20, fontWeight: 800, color: latch.Qbar ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>{connected ? bit(latch.Qbar) : '—'}</span></div>
            <div className="row">
              <span className="pill">State</span>
              <span className="pill" style={{ color: latch.invalid ? 'rgba(239,68,68,0.95)' : 'rgba(34,211,238,0.9)', fontWeight: 700 }}>{stateLabel}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Characteristic table</p>
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
              <thead>
                <tr>{["S'","R'","Q(next)","State"].map((h) => (
                  <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {SR_TABLE.map((row) => {
                  const isCurrent = connected && S === row.S && R === row.R
                  return (
                    <tr key={`${row.S}${row.R}`} style={{ background: isCurrent ? 'rgba(34,211,238,0.08)' : undefined }}>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: row.S ? 'rgba(255,255,255,0.7)' : 'rgba(34,211,238,0.9)', fontWeight: 700 }}>{row.S}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: row.R ? 'rgba(255,255,255,0.7)' : 'rgba(34,211,238,0.9)', fontWeight: 700 }}>{row.R}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--muted)' }}>{row.Q}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: row.state === 'INVALID' ? 'rgba(239,68,68,0.9)' : 'var(--muted)' }}>{row.state}</td>
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
            <button className="btn primary" disabled={!connected} onClick={() => setSamples((prev) => [...prev, { S, R, Q: latch.Q, Qbar: latch.Qbar, state: stateLabel }])}>Add reading</button>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {samples.slice(-6).map((s, i) => (
                <div key={i} className="row" style={{ fontSize: 12 }}>
                  <span className="pill">S'={bit(s.S)} R'={bit(s.R)}</span>
                  <span className="pill">Q={bit(s.Q)} Q'={bit(s.Qbar)}</span>
                  <span className="pill">{s.state}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'NAND Gate (IC 7400)', description: 'SR latch built from two cross-coupled NAND gates. Uses active-low inputs.' })}>NAND IC</button>
          </div>
        </div>
      </div>
      {hotspotOpen && (
        <Modal3D title={hotspotOpen.label} onClose={() => setHotspotOpen(null)}>
          <p className="p" style={{ marginBottom: 10 }}>{hotspotOpen.description}</p>
          <ComponentViewer3D kind="and" />
        </Modal3D>
      )}
    </div>
  )
}
