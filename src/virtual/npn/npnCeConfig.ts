import type { BoardNode } from '../shared/KitBoard'

export type NpnNodeId =
  | 'POWER'
  | 'VBB_SRC'
  | 'VCC_SRC'
  | 'GND'
  | 'B'
  | 'C'
  | 'E'
  | 'RB_TOP'
  | 'RB_BOT'
  | 'RC_TOP'
  | 'RC_BOT'
  | 'METER'

export const NPN_CE_NODES: BoardNode<NpnNodeId>[] = [
  // Positioned to resemble the shared CE kit photo layout
  { id: 'POWER', kind: 'power', label: 'POWER', x: 0.915, y: 0.235 },

  { id: 'VBB_SRC', kind: 'source', label: 'VBB (+)', x: 0.12, y: 0.42 },
  { id: 'VCC_SRC', kind: 'source', label: 'VCC (+)', x: 0.70, y: 0.42 },
  { id: 'GND', kind: 'ground', label: 'GND', x: 0.50, y: 0.68 },

  { id: 'RB_TOP', kind: 'socket', label: 'RB top', x: 0.20, y: 0.42 },
  { id: 'RB_BOT', kind: 'socket', label: 'RB bot', x: 0.30, y: 0.42 },

  { id: 'RC_TOP', kind: 'socket', label: 'RC top', x: 0.62, y: 0.42 },
  { id: 'RC_BOT', kind: 'socket', label: 'RC bot', x: 0.52, y: 0.42 },

  { id: 'B', kind: 'socket', label: 'B', x: 0.39, y: 0.42 },
  { id: 'C', kind: 'socket', label: 'C', x: 0.46, y: 0.34 },
  { id: 'E', kind: 'socket', label: 'E', x: 0.46, y: 0.62 },

  { id: 'METER', kind: 'meter', label: 'METER', x: 0.86, y: 0.80 },
]

export const NPN_CE_STEPS = [
  {
    id: 'power',
    title: 'Power ON',
    description: 'Turn the trainer power ON.',
    requiredWires: [] as { a: NpnNodeId; b: NpnNodeId }[],
  },
  {
    id: 'emitter',
    title: 'Connect emitter to ground',
    description: 'Connect E to GND.',
    requiredWires: [{ a: 'E', b: 'GND' }] as { a: NpnNodeId; b: NpnNodeId }[],
  },
  {
    id: 'base-path',
    title: 'Make the base bias path (VBB → RB → B)',
    description: 'Connect VBB(+ ) to RB top, RB bot to B.',
    requiredWires: [
      { a: 'VBB_SRC', b: 'RB_TOP' },
      { a: 'RB_BOT', b: 'B' },
    ] as { a: NpnNodeId; b: NpnNodeId }[],
  },
  {
    id: 'collector-path',
    title: 'Make the collector path (VCC → RC → C)',
    description: 'Connect VCC(+ ) to RC top, RC bot to C.',
    requiredWires: [
      { a: 'VCC_SRC', b: 'RC_TOP' },
      { a: 'RC_BOT', b: 'C' },
    ] as { a: NpnNodeId; b: NpnNodeId }[],
  },
  {
    id: 'measure',
    title: 'Measure and plot',
    description: 'Adjust VBB/VCC and record IB, IC, and VCE.',
    requiredWires: [] as { a: NpnNodeId; b: NpnNodeId }[],
  },
] as const

