import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'
import { solveCeOperatingPoint } from '../npn/npnModel'

type NodeId =
  | 'POWER' | 'VBB_SRC' | 'VCC_SRC'
  | 'RB_TOP' | 'RB_BOT' | 'RC_TOP' | 'RC_BOT'
  | 'B' | 'C' | 'E' | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',   kind: 'power',  label: 'POWER',     x: 0.915, y: 0.235 },
  { id: 'VBB_SRC', kind: 'source', label: 'VBB (+)',   x: 0.12,  y: 0.42 },
  { id: 'VCC_SRC', kind: 'source', label: 'VCC (+)',   x: 0.70,  y: 0.42 },
  { id: 'RB_TOP',  kind: 'socket', label: 'RB top',    x: 0.20,  y: 0.42 },
  { id: 'RB_BOT',  kind: 'socket', label: 'RB bot',    x: 0.30,  y: 0.42 },
  { id: 'RC_TOP',  kind: 'socket', label: 'RC top',    x: 0.62,  y: 0.42 },
  { id: 'RC_BOT',  kind: 'socket', label: 'RC bot',    x: 0.52,  y: 0.42 },
  { id: 'B',       kind: 'socket', label: 'B',         x: 0.39,  y: 0.42 },
  { id: 'C',       kind: 'socket', label: 'C',         x: 0.46,  y: 0.34 },
  { id: 'E',       kind: 'socket', label: 'E',         x: 0.46,  y: 0.62 },
  { id: 'GND',     kind: 'ground', label: 'GND',       x: 0.50,  y: 0.68 },
  { id: 'METER',   kind: 'meter',  label: 'METER',     x: 0.86,  y: 0.80 },
]

const STEPS = [
  { id: 'power',    title: 'Power ON',                  description: 'Turn the trainer power ON.',                                        requiredWires: [] as { a: NodeId; b: NodeId }[] },
  { id: 'emitter',  title: 'Connect E to GND',           description: 'Connect emitter (E) to GND.',                                       requiredWires: [{ a: 'E', b: 'GND' }] as { a: NodeId; b: NodeId }[] },
  { id: 'base',     title: 'Base bias: VBB → RB → B',    description: 'Connect VBB(+) to RB top, then RB bot to Base (B).',                requiredWires: [{ a: 'VBB_SRC', b: 'RB_TOP' }, { a: 'RB_BOT', b: 'B' }] as { a: NodeId; b: NodeId }[] },
  { id: 'collector',title: 'Collector: VCC → RC → C',    description: 'Connect VCC(+) to RC top, then RC bot to Collector (C).',           requiredWires: [{ a: 'VCC_SRC', b: 'RC_TOP' }, { a: 'RC_BOT', b: 'C' }] as { a: NodeId; b: NodeId }[] },
  { id: 'observe',  title: 'Observe switch states',       description: 'Vary VBB from 0 → 5V. Watch the LED and VCE change. Record results.', requiredWires: [] as { a: NodeId; b: NodeId }[] },
] as const

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  const k = norm(a, b); return wires.some((w) => norm(w.a, w.b) === k)
}

function switchUnderlay(opts: {
  powerOn: boolean; vbb: number; vcc: number
  ic_mA: number; vce: number; region: string
}) {
  const { powerOn, vbb, vcc, ic_mA, vce, region } = opts
  const ledOn = region === 'saturation'
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">
        TRANSISTOR AS A SWITCH
      </text>
      {/* power */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* LED indicator */}
      <g>
        <circle cx="800" cy="200" r="45" fill={ledOn ? 'rgba(34,211,238,0.18)' : 'rgba(0,0,0,0.30)'} stroke={ledOn ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.2)'} strokeWidth="3" />
        <circle cx="800" cy="200" r="28" fill={ledOn ? 'rgba(34,211,238,0.55)' : 'rgba(255,255,255,0.06)'} />
        <text x="800" y="268" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)" fontWeight="700">LED (LOAD)</text>
        <text x="800" y="288" textAnchor="middle" fontSize="13" fill={ledOn ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.8)'}>{ledOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* Region banner */}
      <g>
        <rect x="350" y="280" width="200" height="44" rx="12" fill="rgba(0,0,0,0.30)" stroke="rgba(255,255,255,0.14)" />
        <text x="450" y="308" textAnchor="middle" fontSize="15" fill="rgba(255,255,255,0.8)" fontWeight="700">REGION: {region.toUpperCase()}</text>
      </g>
      {/* VBB display */}
      <g>
        <rect x="60" y="460" width="190" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="155" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">VBB (V)</text>
        <text x="155" y="522" textAnchor="middle" fontSize="34" fill="rgba(248,113,113,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{vbb.toFixed(2)}</text>
      </g>
      {/* VCE display */}
      <g>
        <rect x="660" y="460" width="200" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="760" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">VCE (V)</text>
        <text x="760" y="522" textAnchor="middle" fontSize="34" fill="rgba(34,211,238,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{vce.toFixed(2)}</text>
      </g>
      {/* IC display */}
      <g>
        <rect x="350" y="460" width="200" height="76" rx="12" fill="rgba(0,0,0,0.30)" stroke="rgba(255,255,255,0.14)" />
        <text x="450" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">IC (mA)</text>
        <text x="450" y="522" textAnchor="middle" fontSize="34" fill="rgba(124,58,237,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{ic_mA.toFixed(2)}</text>
      </g>
      {/* knob VBB */}
      <g>
        <text x="95" y="250" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">VBB</text>
        <circle cx="95" cy="310" r="48" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" />
        <circle cx="95" cy="310" r="38" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
        <line x1="95" y1="310" x2={95 + Math.cos((-140 + (vbb / 5) * 280) * Math.PI / 180) * 28} y2={310 + Math.sin((-140 + (vbb / 5) * 280) * Math.PI / 180) * 28} stroke="rgba(255,255,255,0.65)" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* knob VCC */}
      <g>
        <text x="690" y="250" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">VCC</text>
        <circle cx="690" cy="310" r="48" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" />
        <circle cx="690" cy="310" r="38" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
        <line x1="690" y1="310" x2={690 + Math.cos((-140 + (vcc / 12) * 280) * Math.PI / 180) * 28} y2={310 + Math.sin((-140 + (vcc / 12) * 280) * Math.PI / 180) * 28} stroke="rgba(255,255,255,0.65)" strokeWidth="5" strokeLinecap="round" />
      </g>
    </>
  )
}

export function VirtualTransistorSwitchLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [VBB, setVBB] = useState(0)
  const [VCC, setVCC] = useState(5)
  const [RB, setRB] = useState(10000)
  const [RC, setRC] = useState(470)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ VBB: number; IC_mA: number; VCE: number; state: string }[]>([])

  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)
  const step = STEPS[stepIdx]

  const connected = useMemo(() => {
    const h = (a: NodeId, b: NodeId) => hasW(wires, a, b)
    return {
      powerOn,
      emitterToGnd: h('E', 'GND'),
      basePath: h('VBB_SRC', 'RB_TOP') && h('RB_BOT', 'B'),
      collectorPath: h('VCC_SRC', 'RC_TOP') && h('RC_BOT', 'C'),
    }
  }, [powerOn, wires])

  const op = useMemo(() =>
    solveCeOperatingPoint({ VBB, VCC, RB, RC }, { beta: 120, VbeOn: 0.7, VceSat: 0.2 }, connected),
    [VBB, VCC, RB, RC, connected]
  )

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

  return (
    <div className="two-col">
      <VirtualKitBoard<NodeId>
        title={`Virtual Analog Lab — ${practical.title}`}
        nodes={NODES} wires={boardWires} selectedStart={wireStart}
        highlighted={highlighted} onNodeClick={onNodeClick}
        onWireRemove={(w) => setWires((prev) => prev.filter((x) => normW(x) !== normW({ a: w.a, b: w.b })))}
        underlay={switchUnderlay({ powerOn, vbb: VBB, vcc: VCC, ic_mA: op.IC * 1e3, vce: op.VCE, region: op.region })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>Practical #{practical.srNo} — Transistor as a Switch</h2>
        <p className="p" style={{ marginTop: 8 }}>Verify cutoff and saturation. Watch the LED turn ON/OFF as you sweep VBB.</p>

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
          <p className="card-title">Controls</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <label className="row">
              <span className="pill">VBB (0–5 V)</span>
              <input type="range" min={0} max={5} step={0.05} value={VBB} onChange={(e) => setVBB(parseFloat(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{VBB.toFixed(2)} V</span>
            </label>
            <label className="row">
              <span className="pill">VCC (0–12 V)</span>
              <input type="range" min={0} max={12} step={0.1} value={VCC} onChange={(e) => setVCC(parseFloat(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{VCC.toFixed(2)} V</span>
            </label>
            <label className="row">
              <span className="pill">RB (Ω)</span>
              <input type="number" min={100} step={100} value={RB} onChange={(e) => setRB(Math.max(100, parseInt(e.target.value || '100')))} disabled={!powerOn} style={{ width: 130 }} />
              <span className="pill">Ω</span>
            </label>
            <label className="row">
              <span className="pill">RC / Load (Ω)</span>
              <input type="number" min={10} step={10} value={RC} onChange={(e) => setRC(Math.max(10, parseInt(e.target.value || '10')))} disabled={!powerOn} style={{ width: 130 }} />
              <span className="pill">Ω</span>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Meters (live)</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div className="row"><span className="pill">IB</span><span className="pill"><b>{(op.IB * 1e6).toFixed(1)}</b> µA</span></div>
            <div className="row"><span className="pill">IC</span><span className="pill"><b>{(op.IC * 1e3).toFixed(2)}</b> mA</span></div>
            <div className="row"><span className="pill">VCE</span><span className="pill"><b>{op.VCE.toFixed(2)}</b> V</span></div>
            <div className="row">
              <span className="pill">Region</span>
              <span className="pill" style={{ color: op.region === 'saturation' ? 'rgba(34,211,238,0.95)' : op.region === 'active' ? 'rgba(245,158,11,0.95)' : 'rgba(239,68,68,0.95)' }}>
                <b>{op.region.toUpperCase()}</b>
              </span>
            </div>
            <div className="row">
              <span className="pill">LED (Load)</span>
              <span className="pill" style={{ color: op.region === 'saturation' ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.8)' }}>
                <b>{op.region === 'saturation' ? 'ON' : 'OFF'}</b>
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Observation table</p>
            <button className="btn primary" disabled={!powerOn} onClick={() => setSamples((prev) => [...prev, { VBB, IC_mA: op.IC * 1e3, VCE: op.VCE, state: op.region }])}>Add reading</button>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length === 0
            ? <p className="p" style={{ marginTop: 10 }}>Set VBB=0 (cutoff), slowly increase to 5V. Record at each step to observe the transition.</p>
            : <div style={{ marginTop: 10, display: 'grid', gap: 5 }}>
                <div className="row" style={{ fontSize: 11, opacity: 0.6 }}><span className="pill">VBB</span><span className="pill">IC (mA)</span><span className="pill">VCE (V)</span><span className="pill">State</span></div>
                {samples.slice(-8).map((s, i) => (
                  <div key={i} className="row">
                    <span className="pill">{s.VBB.toFixed(2)} V</span>
                    <span className="pill">{s.IC_mA.toFixed(2)}</span>
                    <span className="pill">{s.VCE.toFixed(2)}</span>
                    <span className="pill">{s.state}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'NPN Transistor', description: 'Operates as a switch: cutoff (OFF) when VBE < 0.7V, saturation (ON) when base current is sufficient.' })}>NPN Transistor</button>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'Load Resistor (RC)', description: 'Collector resistor — also represents the LED load in the switch circuit.' })}>Resistors</button>
          </div>
        </div>
      </div>
      {hotspotOpen && (
        <Modal3D title={hotspotOpen.label} onClose={() => setHotspotOpen(null)}>
          <p className="p" style={{ marginBottom: 10 }}>{hotspotOpen.description}</p>
          <ComponentViewer3D kind="npn" />
        </Modal3D>
      )}
    </div>
  )
}
