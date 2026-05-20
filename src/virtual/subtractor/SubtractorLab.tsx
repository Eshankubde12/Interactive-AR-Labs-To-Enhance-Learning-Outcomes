import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import { Modal3D } from '../../components/Modal3D'
import { bitToVolts, fullSubtractor, type Bit } from './subtractorLogic'
import { SUBTRACTOR_HOTSPOTS, type NodeId } from './subtractorConfig'
import {
  SUBTRACTOR_STEPS,
  hasWire,
  listWrongWires,
  normWire,
  type StepId,
  type Wire,
} from './wireValidation'
import { VirtualKitBoard, type BoardWire } from '../shared/KitBoard'
import { SUBTRACTOR_BOARD_NODES } from './subtractorBoard'

export function VirtualSubtractorLab({ practical }: { practical: Practical }) {
  const [powerOn, setPowerOn] = useState(false)
  const [A, setA] = useState<Bit>(0)
  const [B, setB] = useState<Bit>(0)
  const [Bin, setBin] = useState<Bit>(0)

  const [wires, setWires] = useState<Wire[]>([])
  const [wireStart, setWireStart] = useState<NodeId | null>(null)

  const [stepId, setStepId] = useState<StepId>('power')

  const [hotspotOpen, setHotspotOpen] = useState<null | {
    label: string
    description: string
    model: 'xor' | 'and' | 'not' | 'ic' | 'probe'
  }>(null)

  const inputsPatched = useMemo(() => {
    return (
      hasWire(wires, 'A_SRC', 'A_IN') &&
      hasWire(wires, 'B_SRC', 'B_IN') &&
      hasWire(wires, 'C_SRC', 'C_IN')
    )
  }, [wires])

  const effectiveA: Bit = powerOn && inputsPatched ? A : 0
  const effectiveB: Bit = powerOn && inputsPatched ? B : 0
  const effectiveC: Bit = powerOn && inputsPatched ? Bin : 0

  const { D, borrow } = useMemo(
    () => fullSubtractor(effectiveA, effectiveB, effectiveC),
    [effectiveA, effectiveB, effectiveC],
  )

  const meterReading = useMemo(() => {
    if (!powerOn) return { label: 'Power is OFF', volts: null as number | null }
    if (!inputsPatched) return { label: 'Patch A/B/C into kit inputs', volts: null }

    const hasGnd = hasWire(wires, 'METER', 'GND')
    const diff = hasWire(wires, 'METER', 'D_OUT')
    const bor = hasWire(wires, 'METER', 'BORROW_OUT')

    if (!hasGnd) return { label: 'Connect meter to GND', volts: null }
    if (diff && bor) return { label: 'Only one output at a time', volts: null }
    if (diff) return { label: 'Difference', volts: bitToVolts(D) }
    if (bor) return { label: 'Borrow', volts: bitToVolts(borrow) }
    return { label: 'Connect meter to an output', volts: null }
  }, [D, borrow, inputsPatched, powerOn, wires])

  const wrongWireKeys = useMemo(() => listWrongWires(wires), [wires])

  const step = useMemo(() => SUBTRACTOR_STEPS.find((s) => s.id === stepId)!, [stepId])
  const stepDone = useMemo(() => {
    if (stepId === 'power') return powerOn
    return step.requiredWires.every((w) => hasWire(wires, w.a, w.b))
  }, [powerOn, step.requiredWires, stepId, wires])

  const canProceed = stepDone && wrongWireKeys.size === 0

  const nextStep = () => {
    const idx = SUBTRACTOR_STEPS.findIndex((s) => s.id === stepId)
    const next = SUBTRACTOR_STEPS[idx + 1]
    if (next) setStepId(next.id)
  }
  const prevStep = () => {
    const idx = SUBTRACTOR_STEPS.findIndex((s) => s.id === stepId)
    const prev = SUBTRACTOR_STEPS[idx - 1]
    if (prev) setStepId(prev.id)
  }

  const onTerminalClick = (id: NodeId) => {
    if (id === 'POWER') {
      setPowerOn((v) => !v)
      if (!powerOn) setStepId('patch-inputs')
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

  const highlighted = useMemo(() => {
    if (stepId === 'patch-inputs') return { nodes: ['A_SRC', 'A_IN', 'B_SRC', 'B_IN', 'C_SRC', 'C_IN'] as NodeId[] }
    if (stepId === 'meter-gnd') return { from: 'METER' as NodeId, to: 'GND' as NodeId, nodes: ['METER', 'GND'] as NodeId[] }
    if (stepId === 'meter-diff') return { from: 'METER' as NodeId, to: 'D_OUT' as NodeId, nodes: ['METER', 'D_OUT'] as NodeId[] }
    if (stepId === 'meter-borrow') return { from: 'METER' as NodeId, to: 'BORROW_OUT' as NodeId, nodes: ['METER', 'BORROW_OUT'] as NodeId[] }
    return { nodes: ['POWER'] as NodeId[] }
  }, [stepId])

  const boardWires: BoardWire<NodeId>[] = useMemo(() => {
    return wires.map((w) => {
      const key = normWire(w)
      const status: BoardWire<NodeId>['status'] = wrongWireKeys.has(key) ? 'wrong' : 'ok'
      return { a: w.a, b: w.b, status }
    })
  }, [wires, wrongWireKeys])

  return (
    <div className="two-col">
      <VirtualKitBoard<NodeId>
        title={`Virtual Trainer Kit — ${practical.title}`}
        nodes={SUBTRACTOR_BOARD_NODES}
        wires={boardWires}
        selectedStart={wireStart}
        highlighted={highlighted}
        onNodeClick={onTerminalClick}
        onWireRemove={(w) =>
          setWires((prev) => prev.filter((x) => normWire(x) !== normWire({ a: w.a, b: w.b })))
        }
      />

      <div className="panel">
        <h2 className="h1" style={{ fontSize: 26, margin: 0 }}>
          Practical #{practical.srNo} — Full Subtractor
        </h2>
        <p className="p" style={{ marginTop: 8 }}>
          Use the virtual trainer board on the left. Set inputs A, B, and Borrow-in (C). The guide highlights exactly what to connect next. Verify DIFF and BORROW outputs for all 8 input combinations.
        </p>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div className="row">
            <span className="pill">Power</span>
            <span className="pill">
              <b style={{ color: powerOn ? 'rgba(34,211,238,0.95)' : 'rgba(239,68,68,0.95)' }}>
                {powerOn ? 'ON' : 'OFF'}
              </b>
            </span>
          </div>
          <div className="row">
            <span className="pill">Inputs (sources)</span>
            <span className="pill">
              A={A} B={B} C={Bin}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setA(A ? 0 : 1)} disabled={!powerOn}>
              Toggle A source
            </button>
            <button className="btn" onClick={() => setB(B ? 0 : 1)} disabled={!powerOn}>
              Toggle B source
            </button>
            <button className="btn" onClick={() => setBin(Bin ? 0 : 1)} disabled={!powerOn}>
              Toggle C source
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }} className="meter">
          <div className="row">
            <span className="pill">Wiring</span>
            <span className="pill">{wireStart ? `Selected: ${wireStart}` : 'Select a terminal'}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                if (wireStart) setWireStart(null)
              }}
              disabled={!wireStart}
            >
              Cancel wire
            </button>
            <button
              className="btn"
              onClick={() => setWires((prev) => prev.slice(0, -1))}
              disabled={wires.length === 0}
            >
              Undo last
            </button>
            <button
              className="btn"
              onClick={() => {
                setWires([])
                setWireStart(null)
              }}
              disabled={wires.length === 0}
            >
              Clear all
            </button>
          </div>

          <div className="meter-value">
            {meterReading.volts == null
              ? meterReading.label
              : `${meterReading.label}: ${meterReading.volts.toFixed(2)} V`}
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <div className="row">
              <p className="card-title">Practical guide</p>
              <span className="pill">
                Step {SUBTRACTOR_STEPS.findIndex((s) => s.id === stepId) + 1}/
                {SUBTRACTOR_STEPS.length}
              </span>
            </div>
            <p className="p" style={{ marginTop: 8 }}>
              <b>{step.title}:</b> {step.description}
            </p>
            {wrongWireKeys.size > 0 ? (
              <p className="p" style={{ marginTop: 8, color: 'rgba(239,68,68,0.95)' }}>
                Wrong connection detected. Remove the red wire(s) before continuing.
              </p>
            ) : null}
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={prevStep} disabled={stepId === 'power'}>
                Previous
              </button>
              <button
                className="btn"
                onClick={() => {
                  // “show me” sets up the start terminal for the current step (student just taps the target)
                  const req = step.requiredWires[0]
                  if (!req) return
                  setWireStart(req.a)
                }}
                disabled={step.requiredWires.length === 0 || stepDone}
              >
                Show connection
              </button>
              <button className="btn primary" onClick={nextStep} disabled={!canProceed}>
                Next
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <p className="card-title">Expected outputs</p>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="pill">Difference (D)</span>
            <span className="pill">
              <b>{D}</b>
            </span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="pill">Borrow</span>
            <span className="pill">
              <b>{borrow}</b>
            </span>
          </div>
          {!inputsPatched ? (
            <p className="p" style={{ marginTop: 10 }}>
              Note: outputs stay at 0 until you patch <span className="kbd">A_SRC→A_IN</span>,{' '}
              <span className="kbd">B_SRC→B_IN</span>, <span className="kbd">C_SRC→C_IN</span>.
            </p>
          ) : null}
        </div>

        <div style={{ marginTop: 14 }}>
          <p className="card-title">Kit components (tap for 3D)</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {SUBTRACTOR_HOTSPOTS.map((h) => (
              <button
                key={h.id}
                className="btn"
                onClick={() =>
                  setHotspotOpen({
                    label: h.label,
                    description: h.description,
                    model: h.model,
                  })
                }
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <p className="card-title">Current wires</p>
          {wires.length === 0 ? (
            <p className="p" style={{ marginTop: 8 }}>
              No wires yet. Tap a terminal, then tap another terminal to connect.
            </p>
          ) : (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {wires.map((w) => {
                const key = normWire(w)
                const isWrong = wrongWireKeys.has(key)
                return (
                  <div key={key} className="row">
                    <span className="pill">
                      {w.a} ↔ {w.b} {isWrong ? ' (wrong)' : ''}
                    </span>
                    <button
                      className="btn"
                      onClick={() => setWires((prev) => prev.filter((x) => normWire(x) !== key))}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          )}
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

