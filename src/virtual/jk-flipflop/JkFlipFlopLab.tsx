import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'
import { jkOnRisingEdge, not, type Bit } from '../shared/digitalLogic'

type NodeId =
  | 'POWER' | 'J_SRC' | 'K_SRC' | 'CLK_SRC'
  | 'J_IN' | 'K_IN' | 'CLK_IN'
  | 'Q_OUT' | 'QB_OUT'
  | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',   kind: 'power',  label: 'POWER',   x: 0.915, y: 0.20 },
  { id: 'J_SRC',   kind: 'source', label: 'J SRC',   x: 0.08,  y: 0.30 },
  { id: 'K_SRC',   kind: 'source', label: 'K SRC',   x: 0.08,  y: 0.47 },
  { id: 'CLK_SRC', kind: 'source', label: 'CLK SRC', x: 0.08,  y: 0.64 },
  { id: 'J_IN',    kind: 'socket', label: 'J IN',    x: 0.40,  y: 0.30 },
  { id: 'K_IN',    kind: 'socket', label: 'K IN',    x: 0.40,  y: 0.47 },
  { id: 'CLK_IN',  kind: 'socket', label: 'CLK IN',  x: 0.40,  y: 0.64 },
  { id: 'Q_OUT',   kind: 'output', label: 'Q',       x: 0.76,  y: 0.35 },
  { id: 'QB_OUT',  kind: 'output', label: "Q'",      x: 0.76,  y: 0.55 },
  { id: 'GND',     kind: 'ground', label: 'GND',     x: 0.88,  y: 0.68 },
  { id: 'METER',   kind: 'meter',  label: 'METER',   x: 0.88,  y: 0.80 },
]

const STEPS = [
  { id: 'power',    title: 'Power ON',                   description: 'Turn the trainer power ON.',                                               requiredWires: [] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-j',  title: 'Patch J source to J input',  description: 'Connect J SRC to J IN.',                                                  requiredWires: [{ a: 'J_SRC', b: 'J_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-k',  title: 'Patch K source to K input',  description: 'Connect K SRC to K IN.',                                                  requiredWires: [{ a: 'K_SRC', b: 'K_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'patch-clk',title: 'Patch CLK source to CLK IN', description: 'Connect CLK SRC to CLK IN.',                                              requiredWires: [{ a: 'CLK_SRC', b: 'CLK_IN' }] as { a: NodeId; b: NodeId }[] },
  { id: 'meter-gnd',title: 'Connect METER to GND',       description: 'Connect METER to GND.',                                                   requiredWires: [{ a: 'METER', b: 'GND' }] as { a: NodeId; b: NodeId }[] },
  { id: 'observe',  title: 'Apply J, K then clock',      description: 'Set J and K, then press CLK (rising edge). Verify Q changes per the characteristic table.', requiredWires: [] as { a: NodeId; b: NodeId }[] },
] as const

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  return wires.some((w) => norm(w.a, w.b) === norm(a, b))
}

function jkUnderlay(opts: {
  powerOn: boolean; J: Bit; K: Bit; CLK: Bit; Q: Bit; Qbar: Bit; connected: boolean; clkCount: number
}) {
  const { powerOn, J, K, CLK, Q, Qbar, connected, clkCount } = opts
  const bit = (v: Bit) => v ? '1' : '0'
  const opLabel = !connected ? 'IDLE' : J === 0 && K === 0 ? 'HOLD' : J === 0 && K === 1 ? 'RESET' : J === 1 && K === 0 ? 'SET' : 'TOGGLE'
  const opColor = opLabel === 'TOGGLE' ? 'rgba(245,158,11,0.95)' : opLabel === 'SET' ? 'rgba(34,211,238,0.95)' : opLabel === 'RESET' ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.6)'
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">JK FLIP-FLOP (EDGE TRIGGERED)</text>
      {/* power */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* JK FF symbol */}
      <g>
        <rect x="330" y="190" width="340" height="280" rx="14" fill="rgba(0,0,0,0.40)" stroke="rgba(124,58,237,0.5)" strokeWidth="2" />
        <text x="500" y="220" textAnchor="middle" fontSize="15" fill="rgba(124,58,237,0.9)" fontWeight="700">JK FLIP-FLOP</text>
        <text x="500" y="240" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.4)">Positive edge-triggered</text>
        {/* J, K, CLK labels */}
        <text x="355" y="275" fontSize="14" fill="rgba(255,255,255,0.65)">J =</text>
        <text x="395" y="275" fontSize="16" fill={connected && J ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.8)'} fontWeight="800" fontFamily="ui-monospace,Consolas,monospace">{connected ? bit(J) : '?'}</text>
        <text x="355" y="315" fontSize="14" fill="rgba(255,255,255,0.65)">K =</text>
        <text x="395" y="315" fontSize="16" fill={connected && K ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.8)'} fontWeight="800" fontFamily="ui-monospace,Consolas,monospace">{connected ? bit(K) : '?'}</text>
        <text x="355" y="355" fontSize="14" fill="rgba(255,255,255,0.65)">CLK=</text>
        <text x="400" y="355" fontSize="16" fill={connected && CLK ? 'rgba(34,211,238,0.9)' : 'rgba(255,255,255,0.4)'} fontWeight="800" fontFamily="ui-monospace,Consolas,monospace">{connected ? bit(CLK) : '?'}</text>
        {/* CLK edge symbol */}
        <polyline points="425,360 425,345 440,345 440,360 455,360" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2" />
        {/* Q output */}
        <circle cx="610" cy="280" r="28" fill={connected && Q ? 'rgba(34,211,238,0.25)' : 'rgba(0,0,0,0.3)'} stroke={connected && Q ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
        <text x="610" y="287" textAnchor="middle" fontSize="22" fill={connected && Q ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)'} fontWeight="800">{connected ? bit(Q) : '?'}</text>
        <text x="610" y="325" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">Q</text>
        <circle cx="610" cy="370" r="28" fill={connected && Qbar ? 'rgba(34,211,238,0.25)' : 'rgba(0,0,0,0.3)'} stroke={connected && Qbar ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
        <text x="610" y="377" textAnchor="middle" fontSize="22" fill={connected && Qbar ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)'} fontWeight="800">{connected ? bit(Qbar) : '?'}</text>
        <text x="610" y="415" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">Q'</text>
      </g>
      {/* Operation banner */}
      <g>
        <rect x="340" y="500" width="320" height="50" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" />
        <text x="500" y="530" textAnchor="middle" fontSize="16" fill={opColor} fontWeight="800">OPERATION: {opLabel}</text>
      </g>
      {/* CLK count */}
      <g>
        <rect x="700" y="500" width="180" height="50" rx="12" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.12)" />
        <text x="790" y="520" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.55)">CLK pulses</text>
        <text x="790" y="540" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.8)" fontWeight="700">{clkCount}</text>
      </g>
    </>
  )
}

const JK_TABLE: { J: Bit; K: Bit; Qnext: string; op: string }[] = [
  { J: 0, K: 0, Qnext: 'Q (no change)', op: 'HOLD' },
  { J: 0, K: 1, Qnext: '0', op: 'RESET' },
  { J: 1, K: 0, Qnext: '1', op: 'SET' },
  { J: 1, K: 1, Qnext: "Q' (toggle)", op: 'TOGGLE' },
]

export function VirtualJkFlipFlopLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [J, setJ] = useState<Bit>(0)
  const [K, setK] = useState<Bit>(0)
  const [CLK, setCLK] = useState<Bit>(0)
  const [Q, setQ] = useState<Bit>(0)
  const [clkCount, setClkCount] = useState(0)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ J: Bit; K: Bit; Qbefore: Bit; Qafter: Bit; op: string }[]>([])

  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)
  const step = STEPS[stepIdx]

  const connected = useMemo(() =>
    powerOn && hasW(wires, 'J_SRC', 'J_IN') && hasW(wires, 'K_SRC', 'K_IN') && hasW(wires, 'CLK_SRC', 'CLK_IN'),
    [powerOn, wires]
  )

  const Qbar = not(Q)

  const applyClockPulse = () => {
    if (!connected) return
    const Qbefore = Q
    const Qnext = jkOnRisingEdge(J, K, Q)
    setQ(Qnext)
    setCLK(1)
    setTimeout(() => setCLK(0), 300)
    setClkCount((v) => v + 1)
    const ops = J === 0 && K === 0 ? 'HOLD' : J === 0 && K === 1 ? 'RESET' : J === 1 && K === 0 ? 'SET' : 'TOGGLE'
    setSamples((prev) => [...prev, { J, K, Qbefore, Qafter: Qnext, op: ops }])
  }

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
  const opLabel = J === 0 && K === 0 ? 'HOLD' : J === 0 && K === 1 ? 'RESET' : J === 1 && K === 0 ? 'SET' : 'TOGGLE'

  return (
    <div className="two-col">
      <VirtualKitBoard<NodeId>
        title={`Virtual Digital Lab — ${practical.title}`}
        nodes={NODES} wires={boardWires} selectedStart={wireStart}
        highlighted={highlighted} onNodeClick={onNodeClick}
        onWireRemove={(w) => setWires((prev) => prev.filter((x) => normW(x) !== normW({ a: w.a, b: w.b })))}
        underlay={jkUnderlay({ powerOn, J, K, CLK, Q, Qbar, connected, clkCount })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>Practical #{practical.srNo} — JK Flip-Flop</h2>
        <p className="p" style={{ marginTop: 8 }}>Set J and K, then apply a clock pulse. Q updates on the rising edge. Verify all 4 conditions.</p>

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
          <p className="card-title">Controls</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={!powerOn} onClick={() => setJ((v) => (v ? 0 : 1) as Bit)} style={{ minWidth: 70, fontFamily: 'ui-monospace,monospace', fontSize: 18 }}>J = {bit(J)}</button>
            <button className="btn primary" disabled={!powerOn} onClick={() => setK((v) => (v ? 0 : 1) as Bit)} style={{ minWidth: 70, fontFamily: 'ui-monospace,monospace', fontSize: 18 }}>K = {bit(K)}</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              disabled={!connected}
              onClick={applyClockPulse}
              style={{ padding: '12px 24px', fontSize: 16, letterSpacing: 0.5 }}
            >
              ↑ CLK pulse (rising edge)
            </button>
          </div>
          {connected && (
            <p className="p" style={{ marginTop: 8, fontSize: 12 }}>
              Current operation: <b>{opLabel}</b> — {
                opLabel === 'HOLD' ? 'Q stays unchanged' :
                opLabel === 'SET' ? 'Q → 1 on next CLK' :
                opLabel === 'RESET' ? 'Q → 0 on next CLK' :
                "Q → Q' on next CLK"
              }
            </p>
          )}
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Live outputs</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div className="row"><span className="pill">Q</span><span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 20, fontWeight: 800, color: Q ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>{connected ? bit(Q) : '—'}</span></div>
            <div className="row"><span className="pill">Q'</span><span className="pill" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 20, fontWeight: 800, color: Qbar ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.85)' }}>{connected ? bit(Qbar) : '—'}</span></div>
            <div className="row"><span className="pill">CLK pulses</span><span className="pill"><b>{clkCount}</b></span></div>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Characteristic table</p>
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
              <thead>
                <tr>{['J','K','Q(next)','Operation'].map((h) => (
                  <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {JK_TABLE.map((row) => {
                  const isCurrent = connected && J === row.J && K === row.K
                  return (
                    <tr key={`${row.J}${row.K}`} style={{ background: isCurrent ? 'rgba(34,211,238,0.08)' : undefined }}>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: row.J ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.8)', fontWeight: 700 }}>{row.J}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: row.K ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.8)', fontWeight: 700 }}>{row.K}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--muted)' }}>{row.Qnext}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: row.op === 'TOGGLE' ? 'rgba(245,158,11,0.9)' : 'var(--muted)' }}>{row.op}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Clock log</p>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length === 0
            ? <p className="p" style={{ marginTop: 8 }}>Apply CLK pulses to build the log.</p>
            : <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {samples.slice(-8).map((s, i) => (
                  <div key={i} className="row" style={{ fontSize: 12 }}>
                    <span className="pill">J={bit(s.J)} K={bit(s.K)}</span>
                    <span className="pill">Q: {bit(s.Qbefore)}→{bit(s.Qafter)}</span>
                    <span className="pill">{s.op}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'JK Flip-Flop IC', description: 'JK flip-flop (e.g. IC 7476) eliminates the invalid state of SR latch by toggling on J=K=1.' })}>JK FF IC</button>
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
