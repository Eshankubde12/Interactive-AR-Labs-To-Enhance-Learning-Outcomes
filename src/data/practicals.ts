export type PracticalId =
  | '1-npn-ce'
  | '2-ic741-inverting'
  | '3-ic741-noninverting'
  | '4-transistor-switch'
  | '5-ic555-astable'
  | '6-ttl-logic-gates'
  | '7-half-subtractor'
  | '8-full-subtractor'
  | '9-sr-flipflop'
  | '10-jk-flipflop'

export type PracticalMode = 'virtual' | 'ar'

export type Practical = {
  id: PracticalId
  srNo: number
  title: string
  short: string
  kitImage?: string
  arTarget?: string
  status: 'ready' | 'template' | 'coming_soon'
}

export const PRACTICALS: Practical[] = [
  {
    id: '1-npn-ce',
    srNo: 1,
    title: 'NPN transistor (CE) characteristics',
    short: 'Study and plot characteristics in common-emitter configuration.',
    status: 'ready',
  },
  {
    id: '2-ic741-inverting',
    srNo: 2,
    title: 'IC 741 as Inverting Amplifier',
    short: 'Build and observe gain and phase inversion.',
    kitImage: '/kits/ic741-amp.jpeg',
    arTarget: '/targets/ic741-amp.mind',
    status: 'ready',
  },
  {
    id: '3-ic741-noninverting',
    srNo: 3,
    title: 'IC 741 as Non‑Inverting Amplifier',
    short: 'Build and observe gain without phase inversion.',
    kitImage: '/kits/ic741-amp.jpeg',
    arTarget: '/targets/ic741-amp.mind',
    status: 'ready',
  },
  {
    id: '4-transistor-switch',
    srNo: 4,
    title: 'Transistor as a switch',
    short: 'Verify cutoff/saturation operation and switching behavior.',
    status: 'ready',
  },
  {
    id: '5-ic555-astable',
    srNo: 5,
    title: 'IC 555 as Astable / Monostable Multivibrator',
    short: 'Generate waveforms and verify time period formulas.',
    kitImage: '/kits/ic555-astable.jpeg',
    arTarget: '/targets/ic555-astable.mind',
    status: 'ready',
  },
  {
    id: '6-ttl-logic-gates',
    srNo: 6,
    title: 'Truth table of logic gates (TTL ICs)',
    short: 'Verify AND/OR/NOT/NAND/NOR/XOR behavior.',
    status: 'ready',
  },
  {
    id: '7-half-subtractor',
    srNo: 7,
    title: 'Half Subtractor',
    short: 'Verify DIFF and BORROW outputs for all input combinations.',
    kitImage: '/kits/half-full-subtractor.jpeg',
    status: 'ready',
  },
  {
    id: '8-full-subtractor',
    srNo: 8,
    title: 'Full Subtractor',
    short: 'Verify DIFF and BORROW with borrow-in; connect inputs and read outputs.',
    kitImage: '/kits/half-full-subtractor.jpeg',
    arTarget: '/targets/half-full-subtractor.mind',
    status: 'ready',
  },
  {
    id: '9-sr-flipflop',
    srNo: 9,
    title: 'SR Flip‑Flop using NAND gate',
    short: 'Verify latch operation and stable states.',
    kitImage: '/kits/rs-flipflop.jpeg',
    arTarget: '/targets/rs-flipflop.mind',
    status: 'ready',
  },
  {
    id: '10-jk-flipflop',
    srNo: 10,
    title: 'JK Flip‑Flop using NAND gate',
    short: 'Verify toggling and characteristic table.',
    kitImage: '/kits/jk-flipflop.jpeg',
    arTarget: '/targets/jk-flipflop.mind',
    status: 'ready',
  },
]

export function getPractical(id: string | undefined) {
  return PRACTICALS.find((p) => p.id === id)
}

