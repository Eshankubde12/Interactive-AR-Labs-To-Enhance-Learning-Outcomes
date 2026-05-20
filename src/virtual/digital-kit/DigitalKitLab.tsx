import { useMemo, useState } from 'react'
import type { Practical } from '../../data/practicals'
import { VirtualKitBoard, type BoardWire } from '../shared/KitBoard'
import type { BoardNode } from '../shared/KitBoard'
import { Modal3D } from '../../components/Modal3D'
import { ComponentViewer3D } from '../../components/ComponentViewer3D'
import type { Bit } from '../shared/digitalLogic'

type Wire<TId extends string> = { a: TId; b: TId }

function normWire<TId extends string>(w: Wire<TId>) {
  return w.a < w.b ? `${w.a}__${w.b}` : `${w.b}__${w.a}`
}

function hasWire<TId extends string>(wires: Wire<TId>[], a: TId, b: TId) {
  const key = a < b ? `${a}__${b}` : `${b}__${a}`
  return wires.some((w) => normWire(w) === key)
}

function listWrongWires<TId extends string>(wires: Wire<TId>[], isOutput: (id: TId) => boolean, isGround: (id: TId) => boolean) {
  const wrong = new Set<string>()
  for (const w of wires) {
    const k = normWire(w)
    if (isOutput(w.a) && isOutput(w.b) && w.a !== w.b) wrong.add(k)
    if ((isGround(w.a) && isOutput(w.b)) || (isGround(w.b) && isOutput(w.a))) wrong.add(k)
  }
  return wrong
}

export type DigitalKitConfig<TId extends string> = {
  title: string
  nodes: BoardNode<TId>[]
  hotspots: { id: string; label: string; description: string; model: 'xor' | 'and' | 'not' | 'ic' | 'probe' }[]
  steps: { id: string; title: string; description: string; requiredWires: { a: TId; b: TId }[] }[]
  sources: { id: TId; label: string }[]
  outputs: { id: TId; label: string }[]
  gnd: TId
  meter: TId
  power: TId
  compute: (args: { powerOn: boolean; sourcesPatched: boolean; srcBits: Record<string, Bit> }) => Record<string, Bit>
}

export function VirtualDigitalKitLab<TId extends string>({
  practical,
  config,
}: {
  practical: Practical
  config: DigitalKitConfig<TId>
}) {
  const [powerOn, setPowerOn] = useState(false)
  const [wires, setWires] = useState<Wire<TId>[]>([])
  const [wireStart, setWireStart] = useState<TId | null>(null)
  const [stepIdx, setStepIdx] = useState(0)

  const [srcBits, setSrcBits] = useState<Record<string, Bit>>(() => {
    const obj: Record<string, Bit> = {}
    for (const s of config.sources) obj[String(s.id)] = 0
    return obj
  })

  const wrongWireKeys = useMemo(
    () =>
      listWrongWires(
        wires,
        (id) => config.outputs.some((o) => o.id === id),
        (id) => id === config.gnd,
      ),
    [config.gnd, config.outputs, wires],
  )

  const sourcesPatched = useMemo(() => {
    // Patch rule: each source must be connected to some socket with the same suffix if present.
    // For now we treat “patched” as: at least one wire from each source exists.
    return config.sources.every((s) => wires.some((w) => w.a === s.id || w.b === s.id))
  }, [config.sources, wires])

  const computedOutputs = useMemo(() => {
    return config.compute({ powerOn, sourcesPatched, srcBits })
  }, [config, powerOn, sourcesPatched, srcBits])

  const meterReading = useMemo(() => {
    if (!powerOn) return { label: 'Power is OFF', volts: null as number | null }
    if (!sourcesPatched) return { label: 'Connect sources into the kit', volts: null }

    const hasGnd = hasWire(wires, config.meter, config.gnd)
    if (!hasGnd) return { label: 'Connect meter to GND', volts: null }

    const connectedOutput = config.outputs.find((o) => hasWire(wires, config.meter, o.id))
    if (!connectedOutput) return { label: 'Connect meter to an output', volts: null }
    const bit = computedOutputs[String(connectedOutput.id)] ?? 0
    return { label: connectedOutput.label, volts: bit ? 5 : 0 }
  }, [computedOutputs, config.gnd, config.meter, config.outputs, powerOn, sourcesPatched, wires])

  const step = config.steps[stepIdx]
  const stepDone = useMemo(() => {
    if (!step) return true
    if (step.id === 'power') return powerOn
    return step.requiredWires.every((w) => hasWire(wires, w.a, w.b))
  }, [powerOn, step, wires])

  const canProceed = stepDone && wrongWireKeys.size === 0

  const highlighted = useMemo(() => {
    if (!step) return undefined
    const req = step.requiredWires[0]
    if (!req) return { nodes: [config.power] as TId[] }
    return { from: req.a, to: req.b, nodes: [req.a, req.b] as TId[] }
  }, [config.power, step])

  const boardWires: BoardWire<TId>[] = useMemo(() => {
    return wires.map((w) => {
      const key = normWire(w)
      const status: BoardWire<TId>['status'] = wrongWireKeys.has(key) ? 'wrong' : 'ok'
      return { a: w.a, b: w.b, status }
    })
  }, [wires, wrongWireKeys])

  const [hotspotOpen, setHotspotOpen] = useState<null | { label: string; description: string; model: 'xor' | 'and' | 'not' | 'ic' | 'probe' }>(
    null,
  )

  const onTerminalClick = (id: TId) => {
    if (id === config.power) {
      setPowerOn((v) => !v)
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

    const w: Wire<TId> = { a: wireStart, b: id }
    const key = normWire(w)
    setWires((prev) => {
      if (prev.some((x) => normWire(x) === key)) return prev
      return [...prev, w]
    })
    setWireStart(null)
  }

  return (
    <div className="two-col">
      <VirtualKitBoard<TId>
        title={`Virtual Trainer Kit — ${practical.title}`}
        nodes={config.nodes}
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
          Virtual mode (interactive)
        </h2>
        <p className="p" style={{ marginTop: 8 }}>
          Power ON, connect wires, and observe outputs. Wrong connections are highlighted in red.
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
            <span className="pill">Sources</span>
            <span className="pill">{sourcesPatched ? 'connected' : 'not connected'}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {config.sources.map((s) => {
              const key = String(s.id)
              return (
                <button
                  key={key}
                  className="btn"
                  disabled={!powerOn}
                  onClick={() => setSrcBits((prev) => ({ ...prev, [key]: prev[key] ? 0 : 1 }))}
                >
                  {s.label}: {srcBits[key] ?? 0}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 14 }} className="meter">
          <div className="row">
            <span className="pill">Virtual multimeter</span>
            <span className="pill">METER ↔ GND + METER ↔ output</span>
          </div>
          <div className="meter-value">
            {meterReading.volts == null ? meterReading.label : `${meterReading.label}: ${meterReading.volts.toFixed(2)} V`}
          </div>
        </div>

        <div style={{ marginTop: 14 }} className="panel">
          <div className="row">
            <p className="card-title">Guide</p>
            <span className="pill">
              Step {stepIdx + 1}/{config.steps.length}
            </span>
          </div>
          <p className="p" style={{ marginTop: 8 }}>
            <b>{step?.title}</b>: {step?.description}
          </p>
          {wrongWireKeys.size > 0 ? (
            <p className="p" style={{ marginTop: 8, color: 'rgba(239,68,68,0.95)' }}>
              Wrong connection detected. Remove red wires before continuing.
            </p>
          ) : null}
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" disabled={stepIdx === 0} onClick={() => setStepIdx((v) => Math.max(0, v - 1))}>
              Previous
            </button>
            <button
              className="btn"
              disabled={!step?.requiredWires?.[0] || stepDone}
              onClick={() => {
                const req = step?.requiredWires?.[0]
                if (!req) return
                setWireStart(req.a)
              }}
            >
              Show connection
            </button>
            <button className="btn primary" disabled={!canProceed} onClick={() => setStepIdx((v) => Math.min(config.steps.length - 1, v + 1))}>
              Next
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <p className="card-title">Outputs</p>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {config.outputs.map((o) => (
              <div key={String(o.id)} className="row">
                <span className="pill">{o.label}</span>
                <span className="pill">
                  <b>{computedOutputs[String(o.id)] ?? 0}</b>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <p className="card-title">Components (3D)</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {config.hotspots.map((h) => (
              <button key={h.id} className="btn" onClick={() => setHotspotOpen(h)}>
                {h.label}
              </button>
            ))}
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

