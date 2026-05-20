import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardNode, type BoardWire } from '../shared/KitBoard'

type NodeId =
  | 'POWER' | 'VCC_SRC'
  | 'RA_TOP' | 'RA_BOT'
  | 'RB_TOP' | 'RB_BOT'
  | 'PIN7' | 'PIN2_6'
  | 'CAP_TOP' | 'PIN4_RST'
  | 'OUT' | 'GND' | 'METER'

const NODES: BoardNode<NodeId>[] = [
  { id: 'POWER',    kind: 'power',  label: 'POWER',      x: 0.915, y: 0.20 },
  { id: 'VCC_SRC',  kind: 'source', label: 'VCC SRC',    x: 0.08,  y: 0.32 },
  { id: 'PIN4_RST', kind: 'socket', label: 'Pin4 RST',   x: 0.26,  y: 0.32 },
  { id: 'RA_TOP',   kind: 'socket', label: 'Ra top',     x: 0.38,  y: 0.32 },
  { id: 'RA_BOT',   kind: 'socket', label: 'Ra bot',     x: 0.50,  y: 0.32 },
  { id: 'PIN7',     kind: 'socket', label: 'Pin7 DISCH', x: 0.50,  y: 0.48 },
  { id: 'RB_TOP',   kind: 'socket', label: 'Rb top',     x: 0.50,  y: 0.48 },
  { id: 'RB_BOT',   kind: 'socket', label: 'Rb bot',     x: 0.50,  y: 0.62 },
  { id: 'PIN2_6',   kind: 'socket', label: 'Pin2/6',     x: 0.60,  y: 0.62 },
  { id: 'CAP_TOP',  kind: 'socket', label: 'C top',      x: 0.72,  y: 0.62 },
  { id: 'OUT',      kind: 'output', label: 'OUT (Pin3)', x: 0.84,  y: 0.48 },
  { id: 'GND',      kind: 'ground', label: 'GND',        x: 0.72,  y: 0.76 },
  { id: 'METER',    kind: 'meter',  label: 'METER',      x: 0.88,  y: 0.80 },
]

const STEPS = [
  { id: 'power',  title: 'Power ON',                    description: 'Turn the trainer power ON.',                                                                    requiredWires: [] as { a: NodeId; b: NodeId }[] },
  { id: 'rst',    title: 'Connect Reset (Pin 4) to VCC', description: 'Connect VCC SRC to Pin4 RST (to keep 555 enabled).',                                           requiredWires: [{ a: 'VCC_SRC', b: 'PIN4_RST' }] as { a: NodeId; b: NodeId }[] },
  { id: 'ra',     title: 'Connect Ra (VCC → Ra → Pin7)', description: 'Connect VCC SRC to Ra top, then Ra bot to Pin7 (discharge).',                                  requiredWires: [{ a: 'VCC_SRC', b: 'RA_TOP' }, { a: 'RA_BOT', b: 'PIN7' }] as { a: NodeId; b: NodeId }[] },
  { id: 'rb',     title: 'Connect Rb (Pin7 → Rb → Pin2/6)', description: 'Connect Rb top to Pin7, Rb bot to Pin2/6 (threshold/trigger junction).',                    requiredWires: [{ a: 'RB_BOT', b: 'PIN2_6' }] as { a: NodeId; b: NodeId }[] },
  { id: 'cap',    title: 'Connect timing capacitor',    description: 'Connect C top to Pin2/6, and Pin2/6 to GND through C.',                                          requiredWires: [{ a: 'CAP_TOP', b: 'PIN2_6' }] as { a: NodeId; b: NodeId }[] },
  { id: 'measure',title: 'Measure frequency & duty',   description: 'Adjust Ra, Rb and C. Read frequency, period, and duty cycle from the meters.',                   requiredWires: [] as { a: NodeId; b: NodeId }[] },
] as const

function norm(a: NodeId, b: NodeId) { return a < b ? `${a}__${b}` : `${b}__${a}` }
function hasW(wires: { a: NodeId; b: NodeId }[], a: NodeId, b: NodeId) {
  const k = norm(a, b); return wires.some((w) => norm(w.a, w.b) === k)
}

function solve555(Ra: number, Rb: number, C_nF: number, _VCC: number, connected: boolean) {
  if (!connected) return { f: 0, T: 0, tH: 0, tL: 0, duty: 0 }
  const Ra_r = Math.max(1, Ra)
  const Rb_r = Math.max(1, Rb)
  const C = Math.max(0.1e-9, C_nF * 1e-9)
  const tH = 0.693 * (Ra_r + Rb_r) * C
  const tL = 0.693 * Rb_r * C
  const T = tH + tL
  const f = 1 / T
  const duty = (tH / T) * 100
  return { f, T, tH, tL, duty }
}

function ic555Underlay(opts: {
  powerOn: boolean; f: number; T: number; duty: number; tH: number; tL: number; Ra: number; Rb: number; C_nF: number
}) {
  const { powerOn, f, T, duty, tH, tL } = opts
  const fStr = f >= 1000 ? (f / 1000).toFixed(2) + ' kHz' : f.toFixed(1) + ' Hz'
  const TStr = T < 1e-3 ? (T * 1e6).toFixed(1) + ' µs' : T < 1 ? (T * 1e3).toFixed(2) + ' ms' : T.toFixed(3) + ' s'
  const tHStr = tH < 1e-3 ? (tH * 1e6).toFixed(1) + ' µs' : (tH * 1e3).toFixed(2) + ' ms'
  const tLStr = tL < 1e-3 ? (tL * 1e6).toFixed(1) + ' µs' : (tL * 1e3).toFixed(2) + ' ms'
  return (
    <>
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="52" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.85)" fontWeight="800">IC 555 — ASTABLE MULTIVIBRATOR</text>
      {/* power */}
      <g>
        <rect x="872" y="82" width="86" height="106" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="108" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.75)" fontWeight="700">POWER</text>
        <rect x="895" y="116" width="40" height="56" rx="8" fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'} stroke="rgba(255,255,255,0.18)" />
        <circle cx="915" cy={powerOn ? 135 : 156} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="196" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)">{powerOn ? 'ON' : 'OFF'}</text>
      </g>
      {/* IC 555 chip */}
      <g>
        <rect x="380" y="220" width="180" height="200" rx="10" fill="rgba(0,0,0,0.50)" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        <text x="470" y="250" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.8)" fontWeight="700">IC 555</text>
        <text x="380" y="290" fontSize="10" fill="rgba(255,255,255,0.5)">1-GND</text>
        <text x="380" y="310" fontSize="10" fill="rgba(255,255,255,0.5)">2-TRIG</text>
        <text x="380" y="330" fontSize="10" fill="rgba(255,255,255,0.5)">3-OUT</text>
        <text x="380" y="350" fontSize="10" fill="rgba(255,255,255,0.5)">4-RST</text>
        <text x="525" y="290" fontSize="10" fill="rgba(255,255,255,0.5)">8-VCC</text>
        <text x="525" y="310" fontSize="10" fill="rgba(255,255,255,0.5)">7-DISCH</text>
        <text x="525" y="330" fontSize="10" fill="rgba(255,255,255,0.5)">6-THRES</text>
        <text x="525" y="350" fontSize="10" fill="rgba(255,255,255,0.5)">5-CV</text>
      </g>
      {/* Waveform sketch */}
      {powerOn && f > 0 ? (
        <g>
          <rect x="60" y="240" width="280" height="140" rx="10" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" />
          <text x="200" y="265" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.6)">OUTPUT WAVEFORM</text>
          {/* simple square wave */}
          <polyline points="80,350 80,280 160,280 160,350 240,350 240,280 320,280 320,350" fill="none" stroke="rgba(34,211,238,0.85)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="80" y1="315" x2="320" y2="315" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
        </g>
      ) : null}
      {/* Frequency display */}
      <g>
        <rect x="60" y="460" width="200" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="160" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">Frequency</text>
        <text x="160" y="522" textAnchor="middle" fontSize="28" fill="rgba(248,113,113,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{f > 0 ? fStr : '—'}</text>
      </g>
      {/* Period display */}
      <g>
        <rect x="290" y="460" width="200" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="390" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">Period (T)</text>
        <text x="390" y="522" textAnchor="middle" fontSize="28" fill="rgba(124,58,237,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{f > 0 ? TStr : '—'}</text>
      </g>
      {/* Duty display */}
      <g>
        <rect x="520" y="460" width="200" height="76" rx="12" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
        <text x="620" y="484" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.72)" fontWeight="700">Duty Cycle</text>
        <text x="620" y="522" textAnchor="middle" fontSize="28" fill="rgba(34,211,238,0.95)" fontFamily="ui-monospace,Consolas,monospace" fontWeight="800">{f > 0 ? duty.toFixed(1) + '%' : '—'}</text>
      </g>
      {/* tH / tL display */}
      <g>
        <rect x="750" y="460" width="200" height="76" rx="12" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.12)" />
        <text x="850" y="480" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.6)">tH = {f > 0 ? tHStr : '—'}</text>
        <text x="850" y="500" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.6)">tL = {f > 0 ? tLStr : '—'}</text>
        <text x="850" y="522" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.4)">f = 1.44 / ((Ra+2Rb)·C)</text>
      </g>
    </>
  )
}

export function VirtualIc555Lab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<{ a: NodeId; b: NodeId }[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [Ra, setRa] = useState(10000)
  const [Rb, setRb] = useState(10000)
  const [C_nF, setC_nF] = useState(100)
  const [VCC, setVCC] = useState(9)
  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string }>(null)
  const [samples, setSamples] = useState<{ Ra: number; Rb: number; C: number; f: number; duty: number }[]>([])

  const normW = (w: { a: NodeId; b: NodeId }) => norm(w.a, w.b)
  const step = STEPS[stepIdx]

  const connected = useMemo(() => {
    const h = (a: NodeId, b: NodeId) => hasW(wires, a, b)
    return powerOn && h('VCC_SRC', 'PIN4_RST') && h('VCC_SRC', 'RA_TOP') && h('RA_BOT', 'PIN7') && h('RB_BOT', 'PIN2_6') && h('CAP_TOP', 'PIN2_6')
  }, [powerOn, wires])

  const timing = useMemo(() => solve555(Ra, Rb, C_nF, VCC, connected), [Ra, Rb, C_nF, VCC, connected])

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
        underlay={ic555Underlay({ powerOn, f: timing.f, T: timing.T, duty: timing.duty, tH: timing.tH, tL: timing.tL, Ra, Rb, C_nF })}
      />
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 24, margin: 0 }}>Practical #{practical.srNo} — IC 555 Astable Multivibrator</h2>
        <p className="p" style={{ marginTop: 8 }}>Wire the astable circuit. Adjust Ra, Rb, and C to change frequency and duty cycle.</p>

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
          <p className="card-title">Component values</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <label className="row">
              <span className="pill">Ra (Ω)</span>
              <input type="range" min={1000} max={100000} step={1000} value={Ra} onChange={(e) => setRa(parseInt(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{(Ra / 1000).toFixed(0)} kΩ</span>
            </label>
            <label className="row">
              <span className="pill">Rb (Ω)</span>
              <input type="range" min={1000} max={100000} step={1000} value={Rb} onChange={(e) => setRb(parseInt(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{(Rb / 1000).toFixed(0)} kΩ</span>
            </label>
            <label className="row">
              <span className="pill">C (nF)</span>
              <input type="range" min={10} max={10000} step={10} value={C_nF} onChange={(e) => setC_nF(parseInt(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{C_nF >= 1000 ? (C_nF / 1000).toFixed(1) + ' µF' : C_nF + ' nF'}</span>
            </label>
            <label className="row">
              <span className="pill">VCC</span>
              <input type="range" min={5} max={15} step={1} value={VCC} onChange={(e) => setVCC(parseInt(e.target.value))} disabled={!powerOn} style={{ width: 200 }} />
              <span className="pill">{VCC} V</span>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <p className="card-title">Calculated values (live)</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {[
              ['Frequency', timing.f > 0 ? (timing.f >= 1000 ? (timing.f / 1000).toFixed(2) + ' kHz' : timing.f.toFixed(1) + ' Hz') : '—'],
              ['Period (T)', timing.T > 0 ? (timing.T < 1e-3 ? (timing.T * 1e6).toFixed(1) + ' µs' : (timing.T * 1e3).toFixed(2) + ' ms') : '—'],
              ['tHigh', timing.tH > 0 ? (timing.tH < 1e-3 ? (timing.tH * 1e6).toFixed(1) + ' µs' : (timing.tH * 1e3).toFixed(2) + ' ms') : '—'],
              ['tLow', timing.tL > 0 ? (timing.tL < 1e-3 ? (timing.tL * 1e6).toFixed(1) + ' µs' : (timing.tL * 1e3).toFixed(2) + ' ms') : '—'],
              ['Duty Cycle', timing.duty > 0 ? timing.duty.toFixed(1) + ' %' : '—'],
            ].map(([label, val]) => (
              <div key={label} className="row">
                <span className="pill">{label}</span>
                <span className="pill"><b>{val}</b></span>
              </div>
            ))}
          </div>
          <p className="p" style={{ marginTop: 8, fontSize: 12 }}>Formula: f = 1.44 / ((Ra + 2·Rb) · C)</p>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Observation table</p>
            <button className="btn primary" disabled={!connected} onClick={() => setSamples((prev) => [...prev, { Ra, Rb, C: C_nF, f: timing.f, duty: timing.duty }])}>Add reading</button>
            <button className="btn" disabled={samples.length === 0} onClick={() => setSamples([])}>Clear</button>
          </div>
          {samples.length === 0
            ? <p className="p" style={{ marginTop: 10 }}>Change Ra, Rb, C and record each combination to verify the frequency formula.</p>
            : <div style={{ marginTop: 10, display: 'grid', gap: 5 }}>
                <div className="row" style={{ fontSize: 11, opacity: 0.6 }}><span className="pill">Ra(kΩ)</span><span className="pill">Rb(kΩ)</span><span className="pill">C(nF)</span><span className="pill">f</span><span className="pill">Duty%</span></div>
                {samples.slice(-6).map((s, i) => (
                  <div key={i} className="row">
                    <span className="pill">{(s.Ra / 1000).toFixed(0)}</span>
                    <span className="pill">{(s.Rb / 1000).toFixed(0)}</span>
                    <span className="pill">{s.C}</span>
                    <span className="pill">{s.f >= 1000 ? (s.f / 1000).toFixed(1) + 'k' : s.f.toFixed(0)}</span>
                    <span className="pill">{s.duty.toFixed(1)}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="card-title">3D components</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'IC 555 Timer', description: 'Versatile timer IC. In astable mode it continuously oscillates, generating a square wave.' })}>IC 555</button>
            <button className="btn" onClick={() => setHotspotOpen({ label: 'Timing Capacitor', description: 'The capacitor charges through Ra+Rb and discharges through Rb, setting tH and tL.' })}>Capacitor</button>
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
