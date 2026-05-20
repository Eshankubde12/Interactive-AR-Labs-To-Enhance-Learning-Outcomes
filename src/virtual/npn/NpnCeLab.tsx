import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { VirtualKitBoard, type BoardWire } from '../shared/KitBoard'
import { NPN_CE_NODES, NPN_CE_STEPS, type NpnNodeId } from './npnCeConfig'
import { solveCeOperatingPoint } from './npnModel'
import { npnCeKitUnderlay } from './npnCeKitUnderlay'

type StepId = (typeof NPN_CE_STEPS)[number]['id']

type Wire = { a: NpnNodeId; b: NpnNodeId }

function normWire(w: Wire) {
  return w.a < w.b ? `${w.a}__${w.b}` : `${w.b}__${w.a}`
}

function listWrongWires(wires: Wire[]) {
  // For this analog lab we only flag obvious shorts/mistakes.
  const wrong = new Set<string>()
  for (const w of wires) {
    const k = normWire(w)
    // shorting supplies
    if (
      (w.a === 'VBB_SRC' && w.b === 'VCC_SRC') ||
      (w.a === 'VCC_SRC' && w.b === 'GND') ||
      (w.a === 'VBB_SRC' && w.b === 'GND')
    ) {
      wrong.add(k)
    }
    // collector directly to ground (bypassing RC) or base directly to supply (bypassing RB)
    if ((w.a === 'C' && w.b === 'GND') || (w.b === 'C' && w.a === 'GND')) wrong.add(k)
    if ((w.a === 'B' && w.b === 'VBB_SRC') || (w.b === 'B' && w.a === 'VBB_SRC')) wrong.add(k)
  }
  return wrong
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function VirtualNpnCeLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<Wire[]>([])
  const [wireStart, setWireStart] = useState<NpnNodeId | null>(null)
  const [stepId, setStepId] = useState<StepId>('power')

  const [VBB, setVBB] = useState(0.0) // 0..5
  const [VCC, setVCC] = useState(0.0) // 0..12
  const [RB, setRB] = useState(10000) // ohm
  const [RC, setRC] = useState(1000) // ohm

  const [hotspotOpen, setHotspotOpen] = useState<null | {
    label: string
    description: string
    model: 'npn' | 'resistor' | 'meter'
  }>(null)

  const wrongWireKeys = useMemo(() => listWrongWires(wires), [wires])

  const connected = useMemo(() => {
    const has = (a: NpnNodeId, b: NpnNodeId) =>
      wires.some((w) => normWire(w) === normWire({ a, b }))

    return {
      powerOn,
      emitterToGnd: has('E', 'GND'),
      basePath: has('VBB_SRC', 'RB_TOP') && has('RB_BOT', 'B'),
      collectorPath: has('VCC_SRC', 'RC_TOP') && has('RC_BOT', 'C'),
    }
  }, [powerOn, wires])

  const op = useMemo(() => {
    return solveCeOperatingPoint(
      { VBB, VCC, RB, RC },
      { beta: 120, VbeOn: 0.7, VceSat: 0.2 },
      connected,
    )
  }, [RB, RC, VBB, VCC, connected])

  const step = useMemo(() => NPN_CE_STEPS.find((s) => s.id === stepId)!, [stepId])
  const stepDone = useMemo(() => {
    if (stepId === 'power') return powerOn
    return step.requiredWires.every((w) =>
      wires.some((x) => normWire(x) === normWire(w as Wire)),
    )
  }, [powerOn, step.requiredWires, stepId, wires])

  const canProceed = stepDone && wrongWireKeys.size === 0

  const highlighted = useMemo(() => {
    const req = step.requiredWires[0]
    if (!req) return { nodes: ['POWER'] as NpnNodeId[] }
    return { from: req.a, to: req.b, nodes: [req.a, req.b] as NpnNodeId[] }
  }, [step.requiredWires])

  const boardWires: BoardWire<NpnNodeId>[] = useMemo(() => {
    return (wires as unknown as { a: NpnNodeId; b: NpnNodeId }[]).map((w) => {
      const key = normWire({ a: w.a, b: w.b })
      return { a: w.a, b: w.b, status: wrongWireKeys.has(key) ? 'wrong' : 'ok' }
    })
  }, [wires, wrongWireKeys])

  const onTerminalClick = (id: NpnNodeId) => {
    if (id === 'POWER') {
      setPowerOn((v) => !v)
      if (!powerOn) setStepId('emitter')
      return
    }
    if (wireStart === null) {
      setWireStart(id)
      return
    }
    if (wireStart === id) {
      setWireStart(null)
      return
    }
    const w: Wire = { a: wireStart, b: id }
    const key = normWire(w)
    setWires((prev) => {
      if (prev.some((x) => normWire(x) === key)) return prev
      return [...prev, w]
    })
    setWireStart(null)
  }

  const nextStep = () => {
    const idx = NPN_CE_STEPS.findIndex((s) => s.id === stepId)
    const next = NPN_CE_STEPS[idx + 1]
    if (next) setStepId(next.id)
  }
  const prevStep = () => {
    const idx = NPN_CE_STEPS.findIndex((s) => s.id === stepId)
    const prev = NPN_CE_STEPS[idx - 1]
    if (prev) setStepId(prev.id)
  }

  const [samples, setSamples] = useState<
    { VCE: number; ICmA: number; IBuA: number; region: string }[]
  >([])

  return (
    <div className="two-col">
      <VirtualKitBoard<NpnNodeId>
        title={`Virtual Analog Lab — ${practical.title}`}
        nodes={NPN_CE_NODES}
        wires={boardWires}
        selectedStart={wireStart}
        highlighted={highlighted}
        onNodeClick={onTerminalClick}
        onWireRemove={(w) =>
          setWires((prev) =>
            prev.filter((x) => normWire(x) !== normWire({ a: w.a, b: w.b })),
          )
        }
        underlay={npnCeKitUnderlay({
          powerOn,
          vbb: VBB,
          vcc: VCC,
          ib_uA: op.IB * 1e6,
          ic_mA: op.IC * 1e3,
          vce: op.VCE,
          region: op.region,
        })}
      />

      <div className="panel">
        <h2 className="h1" style={{ fontSize: 26, margin: 0 }}>
          Practical #1 — CE Characteristics (interactive)
        </h2>
        <p className="p" style={{ marginTop: 8 }}>
          Wire the CE test circuit, vary <span className="kbd">VBB</span> and{' '}
          <span className="kbd">VCC</span>, and record \(I_B\), \(I_C\), and{' '}
          <span className="kbd">
            V<sub>CE</sub>
          </span>
          .
        </p>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="row">
            <p className="card-title">Guide</p>
            <span className="pill">
              Step {NPN_CE_STEPS.findIndex((s) => s.id === stepId) + 1}/{NPN_CE_STEPS.length}
            </span>
          </div>
          <p className="p" style={{ marginTop: 8 }}>
            <b>{step.title}</b>: {step.description}
          </p>
          {wrongWireKeys.size > 0 ? (
            <p className="p" style={{ marginTop: 8, color: 'rgba(239,68,68,0.95)' }}>
              Wrong connection detected. Remove red wires before continuing.
            </p>
          ) : null}
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={prevStep} disabled={stepId === 'power'}>
              Previous
            </button>
            <button
              className="btn"
              disabled={!step.requiredWires[0] || stepDone}
              onClick={() => setWireStart(step.requiredWires[0].a)}
            >
              Show connection
            </button>
            <button className="btn primary" onClick={nextStep} disabled={!canProceed}>
              Next
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div className="row">
            <span className="pill">Power</span>
            <span className="pill">
              <b style={{ color: powerOn ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.95)' }}>
                {powerOn ? 'ON' : 'OFF'}
              </b>
            </span>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <p className="card-title">Supplies & resistors</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <label className="row">
                <span className="pill">VBB (0–5V)</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.05}
                  value={VBB}
                  onChange={(e) => setVBB(parseFloat(e.target.value))}
                  disabled={!powerOn}
                  style={{ width: 260 }}
                />
                <span className="pill">{VBB.toFixed(2)} V</span>
              </label>
              <label className="row">
                <span className="pill">VCC (0–12V)</span>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.1}
                  value={VCC}
                  onChange={(e) => setVCC(parseFloat(e.target.value))}
                  disabled={!powerOn}
                  style={{ width: 260 }}
                />
                <span className="pill">{VCC.toFixed(2)} V</span>
              </label>
              <label className="row">
                <span className="pill">RB</span>
                <input
                  type="number"
                  value={RB}
                  min={100}
                  step={100}
                  onChange={(e) => setRB(clamp(parseInt(e.target.value || '0', 10), 100, 200000))}
                  disabled={!powerOn}
                  style={{ width: 140 }}
                />
                <span className="pill">Ω</span>
              </label>
              <label className="row">
                <span className="pill">RC</span>
                <input
                  type="number"
                  value={RC}
                  min={10}
                  step={10}
                  onChange={(e) => setRC(clamp(parseInt(e.target.value || '0', 10), 10, 20000))}
                  disabled={!powerOn}
                  style={{ width: 140 }}
                />
                <span className="pill">Ω</span>
              </label>
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <p className="card-title">Meters (live)</p>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <div className="row">
                <span className="pill">IB</span>
                <span className="pill">
                  <b>{(op.IB * 1e6).toFixed(1)}</b> µA
                </span>
              </div>
              <div className="row">
                <span className="pill">IC</span>
                <span className="pill">
                  <b>{(op.IC * 1e3).toFixed(2)}</b> mA
                </span>
              </div>
              <div className="row">
                <span className="pill">VCE</span>
                <span className="pill">
                  <b>{op.VCE.toFixed(2)}</b> V
                </span>
              </div>
              <div className="row">
                <span className="pill">Region</span>
                <span className="pill">
                  <b>{op.region}</b>
                </span>
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <div className="row">
              <p className="card-title">Plot table (samples)</p>
              <button
                className="btn primary"
                disabled={!powerOn}
                onClick={() =>
                  setSamples((prev) => [
                    ...prev,
                    {
                      VCE: op.VCE,
                      ICmA: op.IC * 1e3,
                      IBuA: op.IB * 1e6,
                      region: op.region,
                    },
                  ])
                }
              >
                Add reading
              </button>
              <button className="btn" onClick={() => setSamples([])} disabled={samples.length === 0}>
                Clear
              </button>
            </div>
            {samples.length === 0 ? (
              <p className="p" style={{ marginTop: 10 }}>
                Add readings while sweeping VCC for a fixed IB (set by VBB/RB), then change IB and repeat.
              </p>
            ) : (
              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                {samples.slice(-8).map((s, idx) => (
                  <div key={idx} className="row">
                    <span className="pill">VCE {s.VCE.toFixed(2)}V</span>
                    <span className="pill">IC {s.ICmA.toFixed(2)}mA</span>
                    <span className="pill">IB {s.IBuA.toFixed(1)}µA</span>
                    <span className="pill">{s.region}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 4 }}>
            <p className="card-title">3D components</p>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() =>
                  setHotspotOpen({
                    label: 'NPN Transistor',
                    description: 'NPN transistor (BJT) used in CE configuration.',
                    model: 'npn',
                  })
                }
              >
                NPN transistor
              </button>
              <button
                className="btn"
                onClick={() =>
                  setHotspotOpen({
                    label: 'Resistor (RB/RC)',
                    description: 'RB sets base current; RC sets collector current limit.',
                    model: 'resistor',
                  })
                }
              >
                Resistors
              </button>
              <button
                className="btn"
                onClick={() =>
                  setHotspotOpen({
                    label: 'Multimeter',
                    description: 'Use meters to read IB/IC/VCE while changing supplies.',
                    model: 'meter',
                  })
                }
              >
                Meter
              </button>
            </div>
          </div>
        </div>
      </div>

      {hotspotOpen ? (
        <Modal3D title={hotspotOpen.label} onClose={() => setHotspotOpen(null)}>
          <p className="p" style={{ marginBottom: 10 }}>
            {hotspotOpen.description}
          </p>
          <ComponentViewer3D kind={hotspotOpen.model} />
        </Modal3D>
      ) : null}
    </div>
  )
}

