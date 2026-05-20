import type { NodeId } from './subtractorConfig'

export type Wire = { a: NodeId; b: NodeId }

export function normWire(w: Wire) {
  return w.a < w.b ? `${w.a}__${w.b}` : `${w.b}__${w.a}`
}

export function hasWire(wires: Wire[], a: NodeId, b: NodeId) {
  const key = a < b ? `${a}__${b}` : `${b}__${a}`
  return wires.some((w) => normWire(w) === key)
}

export function listWrongWires(wires: Wire[]) {
  // Very strict safety rules to surface obvious “wrong connections”.
  // These are meant to teach the student, not to model every electrical nuance.
  const wrong = new Set<string>()
  for (const w of wires) {
    const k = normWire(w)
    const { a, b } = w
    // No shorting outputs together
    if (
      (a === 'D_OUT' || a === 'BORROW_OUT') &&
      (b === 'D_OUT' || b === 'BORROW_OUT') &&
      a !== b
    ) {
      wrong.add(k)
    }
    // No shorting an output to GND
    if ((a === 'GND' && (b === 'D_OUT' || b === 'BORROW_OUT')) || (b === 'GND' && (a === 'D_OUT' || a === 'BORROW_OUT'))) {
      wrong.add(k)
    }
    // No shorting sources together
    const src = new Set<NodeId>(['A_SRC', 'B_SRC', 'C_SRC'])
    if (src.has(a) && src.has(b) && a !== b) wrong.add(k)
    // No patching a source directly to an output
    if (
      (src.has(a) && (b === 'D_OUT' || b === 'BORROW_OUT')) ||
      (src.has(b) && (a === 'D_OUT' || a === 'BORROW_OUT'))
    ) {
      wrong.add(k)
    }
  }
  return wrong
}

export type StepId = 'power' | 'patch-inputs' | 'meter-gnd' | 'meter-diff' | 'meter-borrow'

export type Step = {
  id: StepId
  title: string
  description: string
  requiredWires: Wire[]
}

export const SUBTRACTOR_STEPS: Step[] = [
  {
    id: 'power',
    title: 'Power ON',
    description: 'Switch the kit power ON. The circuit won’t respond when power is OFF.',
    requiredWires: [],
  },
  {
    id: 'patch-inputs',
    title: 'Patch the inputs',
    description: 'Connect the input sources to the kit input sockets using wires.',
    requiredWires: [
      { a: 'A_SRC', b: 'A_IN' },
      { a: 'B_SRC', b: 'B_IN' },
      { a: 'C_SRC', b: 'C_IN' },
    ],
  },
  {
    id: 'meter-gnd',
    title: 'Connect multimeter black to GND',
    description: 'Connect the meter black lead to GND.',
    requiredWires: [{ a: 'METER', b: 'GND' }],
  },
  {
    id: 'meter-diff',
    title: 'Measure Difference output',
    description: 'Connect the meter red lead to Difference output.',
    requiredWires: [{ a: 'METER', b: 'D_OUT' }],
  },
  {
    id: 'meter-borrow',
    title: 'Measure Borrow output',
    description: 'Move the meter red lead to Borrow output.',
    requiredWires: [{ a: 'METER', b: 'BORROW_OUT' }],
  },
]

