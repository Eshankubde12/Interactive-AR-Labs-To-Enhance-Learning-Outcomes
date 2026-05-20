import type { BoardNode } from '../shared/KitBoard'
import type { NodeId } from './subtractorConfig'

export const SUBTRACTOR_BOARD_NODES: BoardNode<NodeId>[] = [
  { id: 'POWER', kind: 'power', label: 'POWER', x: 0.09, y: 0.18, group: 'power' },

  { id: 'C_SRC', kind: 'source', label: 'C (Bin) SRC', x: 0.18, y: 0.32, group: 'src' },
  { id: 'A_SRC', kind: 'source', label: 'A SRC', x: 0.18, y: 0.46, group: 'src' },
  { id: 'B_SRC', kind: 'source', label: 'B SRC', x: 0.18, y: 0.60, group: 'src' },

  { id: 'C_IN', kind: 'socket', label: 'C IN', x: 0.48, y: 0.32, group: 'in' },
  { id: 'A_IN', kind: 'socket', label: 'A IN', x: 0.48, y: 0.46, group: 'in' },
  { id: 'B_IN', kind: 'socket', label: 'B IN', x: 0.48, y: 0.60, group: 'in' },

  { id: 'D_OUT', kind: 'output', label: 'DIFF', x: 0.84, y: 0.40, group: 'out' },
  { id: 'BORROW_OUT', kind: 'output', label: 'BORROW', x: 0.84, y: 0.56, group: 'out' },

  { id: 'GND', kind: 'ground', label: 'GND', x: 0.78, y: 0.78, group: 'meter' },
  { id: 'METER', kind: 'meter', label: 'METER', x: 0.88, y: 0.78, group: 'meter' },
]

