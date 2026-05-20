import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'

type NodeId =
  | 'POWER' | 'VIN_SRC' | 'RIN_A' | 'RIN_B'
  | 'INV_IN' | 'NINV_IN' | 'RF_A' | 'RF_B'
  | 'OUT' | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',   kind: 'power',  label: 'POWER',      x: 0.915, y: 0.20 },
  { id: 'VIN_SRC', kind: 'source', label: 'Vin SRC',    x: 0.08,  y: 0.38 },
  { id: 'RIN_A',   kind: 'socket', label: 'Rin/R1 top', x: 0.26,  y: 0.38 },
  { id: 'RIN_B',   kind: 'socket', label: 'Rin/R1 bot', x: 0.40,  y: 0.38 },
  { id: 'INV_IN',  kind: 'socket', label: 'INV (−)',    x: 0.52,  y: 0.38 },
  { id: 'NINV_IN', kind: 'socket', label: 'NINV (+)',   x: 0.52,  y: 0.58 },
  { id: 'RF_A',    kind: 'socket', label: 'Rf top',     x: 0.62,  y: 0.24 },
  { id: 'RF_B',    kind: 'socket', label: 'Rf bot',     x: 0.72,  y: 0.38 },
  { id: 'OUT',     kind: 'output', label: 'VOUT',       x: 0.84,  y: 0.38 },
  { id: 'GND',     kind: 'ground', label: 'GND',        x: 0.52,  y: 0.76 },
  { id: 'METER',   kind: 'meter',  label: 'METER',      x: 0.88,  y: 0.80 },
]

type StepDef = { id: string; title: string; description: string; requiredWires: { a: NodeId; b: NodeId }[] }

const INV_STEPS: StepDef[] = [
  { id: 'power',   title: 'Power ON',               description: 'Turn the trainer power ON.',                                                             requiredWires: [] },
  { id: 'gnd-ni',  title: 'Ground NINV(+)',          description: 'Connect NINV(+) to GND — pin 3 goes to ground in inverting config.',                    requiredWires: [{ a: 'NINV_IN', b: 'GND' }] },
  { id: 'rin',     title: 'Vin → Rin → INV(−)',      description: 'Connect Vin SRC to Rin/R1 top, then Rin/R1 bot to INV(−).',                            requiredWires: [{ a: 'VIN_SRC', b: 'RIN_A' }, { a: 'RIN_B', b: 'INV_IN' }] },
  { id: 'rf',      title: 'INV(−) → Rf → VOUT',     description: 'Connect INV(−) to Rf top, then Rf bot to VOUT.',                                        requiredWires: [{ a: 'INV_IN', b: 'RF_A' }, { a: 'RF_B', b: 'OUT' }] },
  { id: 'measure', title: 'Measure & record',        description: 'Sweep Vin and record Vin vs Vout. Verify gain = −Rf/Rin.',                              requiredWires: [] },
]

const NINV_STEPS: StepDef[] = [
  { id: 'power',   title: 'Power ON',               description: 'Turn the trainer power ON.',                                                             requiredWires: [] },
  { id: 'vin-ni',  title: 'Vin → NINV(+)',           description: 'Connect Vin SRC to NINV(+) — pin 3 receives the signal.',                              requiredWires: [{ a: 'VIN_SRC', b: 'NINV_IN' }] },
  { id: 'r1',      title: 'INV(−) → R1 → GND',      description: 'Connect INV(−) to Rin/R1 top, then Rin/R1 bot to GND.',                                requiredWires: [{ a: 'INV_IN', b: 'RIN_A' }, { a: 'RIN_B', b: 'GND' }] },
  { id: 'rf',      title: 'INV(−) → Rf → VOUT',     description: 'Connect INV(−) to Rf top, then Rf bot to VOUT.',                                        requiredWires: [{ a: 'INV_IN', b: 'RF_A' }, { a: 'RF_B', b: 'OUT' }] },
  { id: 'measure', title: 'Measure & record',        description: 'Sweep Vin and record Vin vs Vout. Verify gain = 1 + Rf/R1.',                            requiredWires: [] },
]

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  const k = norm(a, b); return wires.some((w) => norm(w.a, w.b) === k)
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function solveInverting(Vin: number, Rf: number, Rin: number, VCC: number, connected: boolean) {
  if (!connected) return { Vout: 0, gain: 0, saturated: false }
  const gain = -(Rf / Math.max(1, Rin))
  const ideal = gain * Vin
  const limit = VCC - 1.5
  return { Vout: clamp(ideal, -limit, limit), gain, saturated: Math.abs(ideal) > limit }
}

function solveNonInverting(Vin: number, Rf: number, R1: number, VCC: number, connected: boolean) {
  if (!connected) return { Vout: 0, gain: 0, saturated: false }
  const gain = 1 + Rf / Math.max(1, R1)
  const ideal = gain * Vin
  const limit = VCC - 1.5
  return { Vout: clamp(ideal, -limit, limit), gain, saturated: Math.abs(ideal) > limit }
}

function ic741Underlay(opts: {
  powerOn: boolean; mode: 'inverting' | 'noninverting'
  vin: number; vout: number; gain: number; saturated: boolean
}) {
  const { powerOn, mode, vin, vout, gain, saturated } = opts
  const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">
        IC 741 — {mode === 'inverting' ? 'INVERTING AMPLIFIER' : 'NON-INVERTING AMPLIFIER'}
      </text>
      {/* power switch */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* IC 741 chip symbol */}
      <g>
        <rect x="380" y="220" width="240" height="190" rx="10" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        <text x="500" y="248" textAnchor="middle" fontSize="15" fill="rgba(255,255,255,0.8)" fontWeight="700">IC 741</text>
        <polygon points="420,268 420,378 520,323" fill="rgba(124,58,237,0.18)" stroke="rgba(124,58,237,0.6)" strokeWidth="2" />
        <text x="435" y="293" fontSize="14" fill="rgba(255,255,255,0.7)">−</text>
        <text x="435" y="368" fontSize="14" fill="rgba(255,255,255,0.7)">+</text>
        <text x="536" y="328" fontSize="13" fill="rgba(255,255,255,0.65)">OUT</text>
        <text x="420" y="410" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.5)">
          {mode === 'inverting' ? 'Av = −Rf/Rin' : 'Av = 1 + Rf/R1'}
        </text>
      </g>
      {/* Vin display */}
      <g>
        <rect x="60" y="460" width="190" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="155" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">Vin (V)</text>
        <text x="155" y="522" textAnchor="middle" fontSize="34" fill="rgba(248,113,113,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{fmt(vin)}</text>
      </g>
      {/* Vout display */}
      <g>
        <rect x="660" y="460" width="240" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="780" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">Vout (V)</text>
        <text x="780" y="522" textAnchor="middle" fontSize="34" fill={saturated ? 'rgba(239,68,68,0.95)' : 'rgba(34,211,238,0.95)'} fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{fmt(vout)}</text>
      </g>
      {/* Gain display */}
      <g>
        <rect x="350" y="468" width="300" height="60" rx="12" fill="rgba(0,0,0,0.30)" stroke="rgba(255,255,255,0.14)" />
        <text x="500" y="494" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">GAIN = {gain.toFixed(2)}{saturated ? '  ⚠ SAT' : ''}</text>
        <text x="500" y="516" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.50)">{mode === 'inverting' ? 'Av = −Rf/Rin' : 'Av = 1 + Rf/R1'}</text>
      </g>
    </>
  )
}

export function VirtualIc741Lab({ practical, mode }: { practical: Practical; mode: 'inverting' | 'noninverting' }) {
  const steps = mode === 'inverting' ? INV_STEPS : NINV_STEPS
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [Vin, setVin] = useState(0)
  const [VCC, setVCC] = useState(15)
  const [Rf, setRf] = useState(10000)
  const [Rin, setRin] = useState(1000)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ Vin: number; Vout: number; gainAct: number; gainThy: number }[]>([])

  const step = steps[stepIdx]
  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)

  const connected = useMemo(() => {
    const h = (a: NodeId, b: NodeId) => hasW(wires, a, b)
    const rfOk = h('INV_IN', 'RF_A') && h('RF_B', 'OUT')
    if (mode === 'inverting')
      return powerOn && h('NINV_IN', 'GND') && h('VIN_SRC', 'RIN_A') && h('RIN_B', 'INV_IN') && rfOk
    return powerOn && h('VIN_SRC', 'NINV_IN') && h('INV_IN', 'RIN_A') && h('RIN_B', 'GND') && rfOk
  }, [powerOn, wires, mode])

  const result = useMemo(() =>
    mode === 'inverting'
      ? solveInverting(Vin, Rf, Rin, VCC, connected)
      : solveNonInverting(Vin, Rf, Rin, VCC, connected),
    [Vin, Rf, Rin, VCC, connected, mode]
  )

  const gainTheory = mode === 'inverting' ? -(Rf / Math.max(1, Rin)) : 1 + Rf / Math.max(1, Rin)

  const stepDone = useMemo(() => {
    if (!step) return true
    if (step.id === 'power') return powerOn
    return step.requiredWires.every((w) => hasW(wires, w.a, w.b))
  }, [powerOn, step, wires])

  const highlighted = useMemo(() => {
    const req = step?.requiredWires?.[0]
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

  const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)

  return (
    <div className="two-col">
      <VirtualKitBoard<NodeId>
        title={`Virtual Analog Lab — ${practical.title}`}
        nodes={NODES} wires={boardWires} selectedStart={wireStart}
        highlighted={highlighted} onNodeClick={onNodeClick}
        onWireRemove={(w) => setWires((prev) => prev.filter((x) => normW(x) !== normW({ a: w.a, b: w.b })))}
        underlay={ic741Underlay({ powerOn, mode, vin: Vin, vout: result.Vout, gain: result.gain, saturated: result.saturated })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>
          Practical #{practical.srNo} — IC 741 {mode === 'inverting' ? 'Inverting' : 'Non-Inverting'} Amplifier
        </h2>
        <p className="p" style={{ marginTop: 8 }}>Wire the op-amp, adjust Vin and resistors, and verify the gain formula.</p>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Guide</p>
            <span className="pill">Step {stepIdx + 1}/{steps.length}</span>
          </div>
          <p className="p" style={{ marginTop: 8 }}><b>{step?.title}</b>: {step?.description}</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" disabled={stepIdx === 0} onClick={() => setStepIdx((v) => Math.max(0, v - 1))}>Previous</button>
            <button className="btn" disabled={!step?.requiredWires?.[0] || stepDone} onClick={() => step?.requiredWires?.[0] && setWireStart(step.requiredWires[0].a)}>Show connection</button>
            <button className="btn primary" disabled={!stepDone} onClick={() => setStepIdx((v) => Math.min(steps.length - 1, v + 1))}>Next</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Controls</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <label className="row">
              <span className="pill">Vin (−5…+5 V)</span>
              <input type="range" min={-5} max={5} step={0.1} value={Vin} onChange={(e) => setVin(parseFloat(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{fmt(Vin)} V</span>
            </label>
            <label className="row">
              <span className="pill">VCC (5–15 V)</span>
              <input type="range" min={5} max={15} step={0.5} value={VCC} onChange={(e) => setVCC(parseFloat(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{VCC.toFixed(1)} V</span>
            </label>
            <label className="row">
              <span className="pill">{mode === 'inverting' ? 'Rin' : 'R1'} (Ω)</span>
              <input type="number" min={100} step={100} value={Rin} onChange={(e) => setRin(clamp(parseInt(e.target.value || '0'), 100, 1000000))} disabled={!powerOn} style={{ width: 130 }} />
              <span className="pill">Ω</span>
            </label>
            <label className="row">
              <span className="pill">Rf (Ω)</span>
              <input type="number" min={100} step={100} value={Rf} onChange={(e) => setRf(clamp(parseInt(e.target.value || '0'), 100, 1000000))} disabled={!powerOn} style={{ width: 130 }} />
              <span className="pill">Ω</span>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Meters (live)</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div className="row"><span className="pill">Vin</span><span className="pill"><b>{fmt(Vin)}</b> V</span></div>
            <div className="row">
              <span className="pill">Vout</span>
              <span className="pill" style={{ color: result.saturated ? 'rgba(239,68,68,0.95)' : undefined }}>
                <b>{fmt(result.Vout)}</b> V{result.saturated ? ' ⚠ SAT' : ''}
              </span>
            </div>
            <div className="row"><span className="pill">Gain (actual)</span><span className="pill"><b>{connected && Vin !== 0 ? (result.Vout / Vin).toFixed(2) : '—'}</b></span></div>
            <div className="row"><span className="pill">Gain (theory)</span><span className="pill"><b>{gainTheory.toFixed(2)}</b></span></div>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Observation table</p>
            <button className="btn primary" disabled={!connected} onClick={() => setSamples((prev) => [...prev, { Vin, Vout: result.Vout, gainAct: Vin !== 0 ? result.Vout / Vin : 0, gainThy: gainTheory }])}>Add reading</button>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length === 0
            ? <p className="p" style={{ marginTop: 10 }}>Sweep Vin through negative and positive values. Add a reading at each value.</p>
            : <div style={{ marginTop: 10, display: 'grid', gap: 5 }}>
                <div className="row" style={{ fontSize: 11, opacity: 0.6 }}><span className="pill">Vin</span><span className="pill">Vout</span><span className="pill">Gain(act)</span><span className="pill">Gain(thy)</span></div>
                {samples.slice(-8).map((s, i) => (
                  <div key={i} className="row">
                    <span className="pill">{fmt(s.Vin)} V</span>
                    <span className="pill">{fmt(s.Vout)} V</span>
                    <span className="pill">{s.gainAct.toFixed(2)}</span>
                    <span className="pill">{s.gainThy.toFixed(2)}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'IC 741 Op-Amp', description: 'General-purpose op-amp. Inverting amp has 180° phase shift; non-inverting has 0°.' })}>IC 741</button>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'Resistors (Rin, Rf)', description: 'Input resistor sets impedance; feedback resistor determines gain.' })}>Resistors</button>
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
