export type NodeId =
  | 'POWER'
  | 'A_SRC'
  | 'B_SRC'
  | 'C_SRC'
  | 'A_IN'
  | 'B_IN'
  | 'C_IN'
  | 'D_OUT'
  | 'BORROW_OUT'
  | 'GND'
  | 'METER'

export type NodeKind = 'input' | 'output' | 'ground' | 'meter'

export type KitNode = {
  id: NodeId
  kind: NodeKind
  label: string
  xPct: number
  yPct: number
}

export type Hotspot = {
  id: string
  label: string
  xPct: number
  yPct: number
  model: 'xor' | 'and' | 'not' | 'ic' | 'probe'
  description: string
}

// Coordinates are approximate; tuned for `public/kits/half-full-subtractor.jpeg`
export const SUBTRACTOR_NODES: KitNode[] = [
  { id: 'POWER', kind: 'input', label: 'Power switch', xPct: 6, yPct: 14 },

  { id: 'C_SRC', kind: 'input', label: 'C / Bin source', xPct: 16, yPct: 40 },
  { id: 'A_SRC', kind: 'input', label: 'A source', xPct: 16, yPct: 58 },
  { id: 'B_SRC', kind: 'input', label: 'B source', xPct: 16, yPct: 78 },

  // Virtual “kit sockets” (where you patch the sources into the circuit)
  { id: 'C_IN', kind: 'input', label: 'C / Bin input', xPct: 44, yPct: 40 },
  { id: 'A_IN', kind: 'input', label: 'A input', xPct: 44, yPct: 58 },
  { id: 'B_IN', kind: 'input', label: 'B input', xPct: 44, yPct: 78 },

  { id: 'D_OUT', kind: 'output', label: 'Difference O/P', xPct: 83.5, yPct: 46 },
  { id: 'BORROW_OUT', kind: 'output', label: 'Borrow O/P', xPct: 83.5, yPct: 78 },
  { id: 'GND', kind: 'ground', label: 'GND', xPct: 57, yPct: 66.5 },
  { id: 'METER', kind: 'meter', label: 'Virtual Meter', xPct: 86, yPct: 92 },
]

export const SUBTRACTOR_HOTSPOTS: Hotspot[] = [
  {
    id: 'hs-A',
    label: 'Input A',
    xPct: 10,
    yPct: 58,
    model: 'probe',
    description: 'A source (0/1). Patch A source to A input using a wire.',
  },
  {
    id: 'hs-B',
    label: 'Input B',
    xPct: 10,
    yPct: 78,
    model: 'probe',
    description: 'B source (0/1). Patch B source to B input using a wire.',
  },
  {
    id: 'hs-Bin',
    label: 'Borrow In (C)',
    xPct: 10,
    yPct: 40,
    model: 'probe',
    description: 'C/Bin source (0/1). Patch C source to C input using a wire.',
  },
  {
    id: 'hs-xor',
    label: 'XOR logic',
    xPct: 64,
    yPct: 38,
    model: 'xor',
    description: 'XOR gate(s) used to compute Difference.',
  },
  {
    id: 'hs-not',
    label: 'NOT logic',
    xPct: 62,
    yPct: 57,
    model: 'not',
    description: 'Inverter used in borrow calculation.',
  },
  {
    id: 'hs-and',
    label: 'AND logic',
    xPct: 62,
    yPct: 73,
    model: 'and',
    description: 'AND gate(s) used to compute Borrow.',
  },
  {
    id: 'hs-ic',
    label: 'TTL IC block',
    xPct: 50,
    yPct: 52,
    model: 'ic',
    description: 'Represents the underlying TTL logic ICs on the trainer kit.',
  },
]

