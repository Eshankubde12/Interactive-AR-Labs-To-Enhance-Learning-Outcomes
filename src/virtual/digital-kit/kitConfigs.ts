import type { PracticalId } from '../../data/practicals'
import type { DigitalKitConfig } from './DigitalKitLab'
import type { BoardNode } from '../shared/KitBoard'
import { and, fullSubtractor, halfSubtractor, jkOnRisingEdge, not, srNandLatch, xor, type Bit } from '../shared/digitalLogic'

type Id = string

function baseNodes(prefix = ''): BoardNode<Id>[] {
  // Simple reusable “trainer board” layout
  return [
    { id: `${prefix}POWER`, kind: 'power', label: 'POWER', x: 0.09, y: 0.18 },

    { id: `${prefix}S1_SRC`, kind: 'source', label: 'S1 SRC', x: 0.18, y: 0.32 },
    { id: `${prefix}S2_SRC`, kind: 'source', label: 'S2 SRC', x: 0.18, y: 0.46 },
    { id: `${prefix}S3_SRC`, kind: 'source', label: 'S3 SRC', x: 0.18, y: 0.60 },

    { id: `${prefix}S1_IN`, kind: 'socket', label: 'S1 IN', x: 0.48, y: 0.32 },
    { id: `${prefix}S2_IN`, kind: 'socket', label: 'S2 IN', x: 0.48, y: 0.46 },
    { id: `${prefix}S3_IN`, kind: 'socket', label: 'S3 IN', x: 0.48, y: 0.60 },

    { id: `${prefix}O1`, kind: 'output', label: 'O1', x: 0.84, y: 0.40 },
    { id: `${prefix}O2`, kind: 'output', label: 'O2', x: 0.84, y: 0.56 },

    { id: `${prefix}GND`, kind: 'ground', label: 'GND', x: 0.78, y: 0.78 },
    { id: `${prefix}METER`, kind: 'meter', label: 'METER', x: 0.88, y: 0.78 },
  ]
}

function basicSteps(meter: Id, gnd: Id, out: Id) {
  return [
    { id: 'power', title: 'Power ON', description: 'Turn the kit power ON.', requiredWires: [] as { a: Id; b: Id }[] },
    {
      id: 'patch',
      title: 'Patch sources to inputs',
      description: 'Connect the source terminals to the kit input sockets.',
      requiredWires: [] as { a: Id; b: Id }[],
    },
    {
      id: 'gnd',
      title: 'Connect meter to GND',
      description: 'Connect METER to GND.',
      requiredWires: [{ a: meter, b: gnd }],
    },
    {
      id: 'measure',
      title: 'Measure output',
      description: 'Connect METER to the output you want to read.',
      requiredWires: [{ a: meter, b: out }],
    },
  ]
}

export const DIGITAL_CONFIGS: Record<PracticalId, DigitalKitConfig<Id>> = {
  '1-npn-ce': {
    title: 'NPN CE Characteristics (starter sim)',
    nodes: baseNodes('P1_'),
    hotspots: [{ id: 'ic', label: 'Transistor', description: 'Starter simulation UI. We can refine with IV curves next.', model: 'ic' }],
    steps: basicSteps('P1_METER', 'P1_GND', 'P1_O1'),
    sources: [
      { id: 'P1_S1_SRC', label: 'VBB (base)' },
      { id: 'P1_S2_SRC', label: 'VCC (collector)' },
    ],
    outputs: [
      { id: 'P1_O1', label: 'IC (approx bit)' },
      { id: 'P1_O2', label: 'VCE (approx bit)' },
    ],
    gnd: 'P1_GND',
    meter: 'P1_METER',
    power: 'P1_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const base = (srcBits['P1_S1_SRC'] ?? 0) as Bit
      const col = (srcBits['P1_S2_SRC'] ?? 0) as Bit
      // very simplified: if base=1 and VCC=1 -> conduction
      const ic = (on && base && col ? 1 : 0) as Bit
      const vce = (on && ic ? 0 : on && col ? 1 : 0) as Bit
      return { P1_O1: ic, P1_O2: vce }
    },
  },

  '2-ic741-inverting': {
    title: 'IC741 Inverting (digitalized starter)',
    nodes: baseNodes('P2_'),
    hotspots: [{ id: 'opamp', label: 'IC 741', description: 'Starter sim. Next refinement: analog Vin slider + gain + saturation.', model: 'ic' }],
    steps: basicSteps('P2_METER', 'P2_GND', 'P2_O1'),
    sources: [
      { id: 'P2_S1_SRC', label: 'VIN' },
      { id: 'P2_S2_SRC', label: 'MODE' },
    ],
    outputs: [{ id: 'P2_O1', label: 'VOUT (bit)' }, { id: 'P2_O2', label: 'PHASE' }],
    gnd: 'P2_GND',
    meter: 'P2_METER',
    power: 'P2_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const vin = (srcBits['P2_S1_SRC'] ?? 0) as Bit
      const vout = (on ? not(vin) : 0) as Bit
      return { P2_O1: vout, P2_O2: (on ? 1 : 0) as Bit }
    },
  },

  '3-ic741-noninverting': {
    title: 'IC741 Non‑Inverting (digitalized starter)',
    nodes: baseNodes('P3_'),
    hotspots: [{ id: 'opamp', label: 'IC 741', description: 'Starter sim. Next refinement: analog Vin slider + gain + saturation.', model: 'ic' }],
    steps: basicSteps('P3_METER', 'P3_GND', 'P3_O1'),
    sources: [
      { id: 'P3_S1_SRC', label: 'VIN' },
      { id: 'P3_S2_SRC', label: 'MODE' },
    ],
    outputs: [{ id: 'P3_O1', label: 'VOUT (bit)' }, { id: 'P3_O2', label: 'PHASE' }],
    gnd: 'P3_GND',
    meter: 'P3_METER',
    power: 'P3_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const vin = (srcBits['P3_S1_SRC'] ?? 0) as Bit
      const vout = (on ? vin : 0) as Bit
      return { P3_O1: vout, P3_O2: (on ? 0 : 0) as Bit }
    },
  },

  '4-transistor-switch': {
    title: 'Transistor as Switch (starter sim)',
    nodes: baseNodes('P4_'),
    hotspots: [{ id: 'sw', label: 'Transistor', description: 'Cutoff vs saturation. Starter sim; refine next with load + base resistor.', model: 'ic' }],
    steps: basicSteps('P4_METER', 'P4_GND', 'P4_O1'),
    sources: [{ id: 'P4_S1_SRC', label: 'BASE' }, { id: 'P4_S2_SRC', label: 'VCC' }],
    outputs: [{ id: 'P4_O1', label: 'LOAD' }, { id: 'P4_O2', label: 'VCE' }],
    gnd: 'P4_GND',
    meter: 'P4_METER',
    power: 'P4_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const base = (srcBits['P4_S1_SRC'] ?? 0) as Bit
      const vcc = (srcBits['P4_S2_SRC'] ?? 0) as Bit
      const load = (on && base && vcc ? 1 : 0) as Bit
      const vce = (on && load ? 0 : on && vcc ? 1 : 0) as Bit
      return { P4_O1: load, P4_O2: vce }
    },
  },

  '5-ic555-astable': {
    title: 'IC555 Astable (logic output)',
    nodes: baseNodes('P5_'),
    hotspots: [{ id: '555', label: 'IC 555', description: 'Astable output toggles. Next refinement: frequency/duty calculations.', model: 'ic' }],
    steps: basicSteps('P5_METER', 'P5_GND', 'P5_O1'),
    sources: [{ id: 'P5_S1_SRC', label: 'TRIG' }, { id: 'P5_S2_SRC', label: 'RESET' }],
    outputs: [{ id: 'P5_O1', label: 'OUT' }, { id: 'P5_O2', label: 'DISCH' }],
    gnd: 'P5_GND',
    meter: 'P5_METER',
    power: 'P5_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const reset = (srcBits['P5_S2_SRC'] ?? 0) as Bit
      const out = (on && reset ? 1 : 0) as Bit
      return { P5_O1: out, P5_O2: (on && reset ? 0 : 0) as Bit }
    },
  },

  '6-ttl-logic-gates': {
    title: 'Logic Gates (AND/OR/XOR/NAND/NOR)',
    nodes: baseNodes('P6_'),
    hotspots: [{ id: 'ttl', label: 'TTL Gates', description: 'Toggle A/B to verify outputs.', model: 'ic' }],
    steps: basicSteps('P6_METER', 'P6_GND', 'P6_O1'),
    sources: [{ id: 'P6_S1_SRC', label: 'A' }, { id: 'P6_S2_SRC', label: 'B' }],
    outputs: [{ id: 'P6_O1', label: 'XOR' }, { id: 'P6_O2', label: 'AND' }],
    gnd: 'P6_GND',
    meter: 'P6_METER',
    power: 'P6_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const A = (srcBits['P6_S1_SRC'] ?? 0) as Bit
      const B = (srcBits['P6_S2_SRC'] ?? 0) as Bit
      return { P6_O1: (on ? xor(A, B) : 0) as Bit, P6_O2: (on ? and(A, B) : 0) as Bit }
    },
  },

  '7-half-subtractor': {
    title: 'Half Subtractor',
    nodes: baseNodes('P7_'),
    hotspots: [{ id: 'gates', label: 'Logic gates', description: 'Half subtractor built using XOR and AND/NOT gates.', model: 'xor' }],
    steps: basicSteps('P7_METER', 'P7_GND', 'P7_O1'),
    sources: [{ id: 'P7_S1_SRC', label: 'A' }, { id: 'P7_S2_SRC', label: 'B' }],
    outputs: [{ id: 'P7_O1', label: 'DIFF' }, { id: 'P7_O2', label: 'BORROW' }],
    gnd: 'P7_GND',
    meter: 'P7_METER',
    power: 'P7_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const A = (srcBits['P7_S1_SRC'] ?? 0) as Bit
      const B = (srcBits['P7_S2_SRC'] ?? 0) as Bit
      const hs = halfSubtractor(A, B)
      return { P7_O1: (on ? hs.diff : 0) as Bit, P7_O2: (on ? hs.borrow : 0) as Bit }
    },
  },

  '8-full-subtractor': {
    title: 'Full Subtractor',
    // for #8 we keep the dedicated detailed subtractor lab; this config is unused
    nodes: baseNodes('P8_'),
    hotspots: [{ id: 'gates', label: 'Logic', description: 'Implemented in dedicated full subtractor lab.', model: 'ic' }],
    steps: basicSteps('P8_METER', 'P8_GND', 'P8_O1'),
    sources: [{ id: 'P8_S1_SRC', label: 'A' }, { id: 'P8_S2_SRC', label: 'B' }, { id: 'P8_S3_SRC', label: 'Bin' }],
    outputs: [{ id: 'P8_O1', label: 'DIFF' }, { id: 'P8_O2', label: 'BORROW' }],
    gnd: 'P8_GND',
    meter: 'P8_METER',
    power: 'P8_POWER',
    compute: ({ powerOn, sourcesPatched, srcBits }) => {
      const on = powerOn && sourcesPatched
      const A = (srcBits['P8_S1_SRC'] ?? 0) as Bit
      const B = (srcBits['P8_S2_SRC'] ?? 0) as Bit
      const C = (srcBits['P8_S3_SRC'] ?? 0) as Bit
      const fs = fullSubtractor(A, B, C)
      return { P8_O1: (on ? fs.diff : 0) as Bit, P8_O2: (on ? fs.borrow : 0) as Bit }
    },
  },

  '9-sr-flipflop': {
    title: 'SR Flip‑Flop (NAND latch)',
    nodes: baseNodes('P9_'),
    hotspots: [{ id: 'nand', label: 'NAND latch', description: 'SR latch built from NAND gates. S=0 sets, R=0 resets.', model: 'and' }],
    steps: basicSteps('P9_METER', 'P9_GND', 'P9_O1'),
    sources: [{ id: 'P9_S1_SRC', label: 'S' }, { id: 'P9_S2_SRC', label: 'R' }],
    outputs: [{ id: 'P9_O1', label: 'Q' }, { id: 'P9_O2', label: 'Q̄' }],
    gnd: 'P9_GND',
    meter: 'P9_METER',
    power: 'P9_POWER',
    compute: (() => {
      let prevQ: Bit = 0
      return ({ powerOn, sourcesPatched, srcBits }) => {
        const on = powerOn && sourcesPatched
        if (!on) {
          prevQ = 0
          return { P9_O1: 0 as Bit, P9_O2: 1 as Bit }
        }
        const S = (srcBits['P9_S1_SRC'] ?? 1) as Bit
        const R = (srcBits['P9_S2_SRC'] ?? 1) as Bit
        const r = srNandLatch(S, R, prevQ)
        prevQ = r.Q
        return { P9_O1: r.Q, P9_O2: r.Qbar }
      }
    })(),
  },

  '10-jk-flipflop': {
    title: 'JK Flip‑Flop (edge triggered)',
    nodes: baseNodes('P10_'),
    hotspots: [{ id: 'jk', label: 'JK logic', description: 'Press CLK to apply J/K on rising edge.', model: 'ic' }],
    steps: basicSteps('P10_METER', 'P10_GND', 'P10_O1'),
    sources: [{ id: 'P10_S1_SRC', label: 'J' }, { id: 'P10_S2_SRC', label: 'K' }, { id: 'P10_S3_SRC', label: 'CLK' }],
    outputs: [{ id: 'P10_O1', label: 'Q' }, { id: 'P10_O2', label: 'Q̄' }],
    gnd: 'P10_GND',
    meter: 'P10_METER',
    power: 'P10_POWER',
    compute: (() => {
      let prevQ: Bit = 0
      let prevClk: Bit = 0
      return ({ powerOn, sourcesPatched, srcBits }) => {
        const on = powerOn && sourcesPatched
        if (!on) {
          prevQ = 0
          prevClk = 0
          return { P10_O1: 0 as Bit, P10_O2: 1 as Bit }
        }
        const J = (srcBits['P10_S1_SRC'] ?? 0) as Bit
        const K = (srcBits['P10_S2_SRC'] ?? 0) as Bit
        const CLK = (srcBits['P10_S3_SRC'] ?? 0) as Bit
        const rising = prevClk === 0 && CLK === 1
        if (rising) prevQ = jkOnRisingEdge(J, K, prevQ)
        prevClk = CLK
        return { P10_O1: prevQ, P10_O2: not(prevQ) }
      }
    })(),
  },
}

