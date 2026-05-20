/**
 * Per-kit AR marker configurations.
 *
 * Coordinate system (MindAR THREE.js):
 *   X: -0.5 (left edge) → +0.5 (right edge)  [image width = 1 unit]
 *   Y: -(h/w)/2 (bottom) → +(h/w)/2 (top)    [Y+ is up]
 *   Z: 0 (flush with image plane), positive Z is toward the camera
 *
 * Conversion from image pixel percentage (px%, py%) where (0,0)=top-left:
 *   X = (px - 50) / 100
 *   Y = (50 - py) / 100 * (imageHeight / imageWidth)
 *
 * Positions are calibrated to the kit photos in /public/kits/.
 */

// ─── Component types for 3D model overlays ────────────────────────────────────
export type ComponentType =
  | 'ic-dip'        // DIP IC package (741, 555, NAND gate ICs)
  | 'transistor'    // TO-92 transistor (BC548, etc.)
  | 'resistor'      // Axial resistor with colour bands
  | 'capacitor'     // Electrolytic capacitor (upright cylinder)
  | 'led'           // LED indicator
  | 'switch'        // Rocker / toggle switch
  | 'terminal'      // Banana-plug input / output terminal socket
  | 'potentiometer' // Variable resistor / trim-pot

export type ArMarker = {
  id: string
  label: string
  description: string
  /** MindAR normalised X, Y (Z is always 0) */
  x: number
  y: number
  /** Bounding-box half-width and half-height in MindAR units */
  hw: number
  hh: number
  color: string
  /** Which guide step (0-based) this marker belongs to */
  step: number
  /** 3D model type displayed when this marker is selected */
  componentType?: ComponentType
}

export type ArConnection = {
  fromId: string
  toId: string
  color: string
}

export type KitArConfig = {
  /** Path to the .mind image-target file under /public/targets/ */
  arTarget: string
  /** Kit image used as visual fallback */
  kitImage: string
  /** Ratio h/w of the target image */
  imageAspect: number
  steps: string[]
  markers: ArMarker[]
  connections: ArConnection[]
}

// ─── Half & Full Subtractor  (DIC-118)  ─────────────────────────────────────
const subtractorConfig: KitArConfig = {
  arTarget: '/targets/half-full-subtractor.mind',
  kitImage: '/kits/half-full-subtractor.jpeg',
  imageAspect: 0.77,
  steps: [
    'Power ON the kit using the rocker switch (top-left).',
    'Set Borrow-In (C) first, then Input A and Input B using the toggle probes on the left.',
    'Observe LEDs on the OUTPUT row at the top — cross-check with truth table.',
    'Measure Difference and Borrow outputs with a multimeter against GND.',
  ],
  markers: [
    {
      id: 'pwr',
      label: 'Power ON',
      description: 'Rocker switch — flip to ON before applying inputs.',
      x: -0.41, y: 0.29, hw: 0.055, hh: 0.06,
      color: '#ef4444', step: 0, componentType: 'switch',
    },
    {
      id: 'C',
      label: 'Borrow-In (C)',
      description: 'Third input C (Borrow-in). Set to 0 or 1 using the probe/toggle.',
      x: -0.33, y: 0.08, hw: 0.05, hh: 0.05,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'A',
      label: 'Input A',
      description: 'Input A terminal. Connect high (1) or low (0).',
      x: -0.33, y: -0.08, hw: 0.05, hh: 0.05,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'B',
      label: 'Input B',
      description: 'Input B terminal. Connect high (1) or low (0).',
      x: -0.34, y: -0.24, hw: 0.05, hh: 0.05,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'OUTPUT',
      label: 'Output LEDs',
      description: 'LED row shows all output states simultaneously.',
      x: 0.05, y: 0.19, hw: 0.22, hh: 0.06,
      color: '#f59e0b', step: 2, componentType: 'led',
    },
    {
      id: 'HDIFF',
      label: 'Half Diff O/P',
      description: 'Half Subtractor Difference output. Measure with multimeter.',
      x: 0.00, y: -0.11, hw: 0.06, hh: 0.05,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'HBORR',
      label: 'Half Borrow O/P',
      description: 'Half Subtractor Borrow output.',
      x: 0.00, y: -0.23, hw: 0.06, hh: 0.05,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'FDIFF',
      label: 'Full Diff O/P',
      description: 'Full Subtractor Difference output (yellow socket, right side).',
      x: 0.39, y: 0.08, hw: 0.06, hh: 0.05,
      color: '#7c3aed', step: 3, componentType: 'terminal',
    },
    {
      id: 'FBORR',
      label: 'Full Borrow O/P',
      description: 'Full Subtractor Borrow output (right side, lower).',
      x: 0.38, y: -0.21, hw: 0.06, hh: 0.05,
      color: '#7c3aed', step: 3, componentType: 'terminal',
    },
  ],
  connections: [
    // Half Subtractor: A and B → HDIFF and HBORR (one wire per output)
    { fromId: 'A',     toId: 'HDIFF', color: '#22d3ee' },
    { fromId: 'B',     toId: 'HBORR', color: '#22d3ee' },
    // Full Subtractor: cascades from half subtractor + Borrow-In C
    { fromId: 'HDIFF', toId: 'FDIFF', color: '#a855f7' },
    { fromId: 'C',     toId: 'FDIFF', color: '#6366f1' },
    { fromId: 'HBORR', toId: 'FBORR', color: '#a855f7' },
  ],
}

// ─── SR (RS) Flip-Flop using NAND gate  (DIC-059)  ──────────────────────────
const srFlipFlopConfig: KitArConfig = {
  arTarget: '/targets/rs-flipflop.mind',
  kitImage: '/kits/rs-flipflop.jpeg',
  imageAspect: 0.77,
  steps: [
    'Power ON the kit using the rocker switch (top-left).',
    'For the R-S Latch (left): apply R and S using the coloured sockets/probes.',
    'Observe Q output and note the cross-coupled NAND gate behaviour.',
    'Switch to Clocked section: set S, CLK, R and read Q/Q̄ at the right-side sockets.',
  ],
  markers: [
    {
      id: 'pwr', label: 'Power ON',
      description: 'Flip the rocker switch before applying logic levels.',
      x: -0.43, y: 0.29, hw: 0.055, hh: 0.06,
      color: '#ef4444', step: 0, componentType: 'switch',
    },
    {
      id: 'R_latch', label: 'R (Latch)',
      description: 'Reset input of R-S Latch (green socket, far left).',
      x: -0.38, y: 0.07, hw: 0.05, hh: 0.045,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'S_latch', label: 'S (Latch)',
      description: 'Set input of R-S Latch (blue socket, far left).',
      x: -0.38, y: -0.245, hw: 0.05, hh: 0.045,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'G1', label: 'NAND G1',
      description: 'Upper NAND gate of the R-S Latch.',
      x: -0.22, y: 0.05, hw: 0.08, hh: 0.06,
      color: '#f59e0b', step: 1, componentType: 'ic-dip',
    },
    {
      id: 'G2', label: 'NAND G2',
      description: 'Lower NAND gate of the R-S Latch.',
      x: -0.22, y: -0.11, hw: 0.08, hh: 0.06,
      color: '#f59e0b', step: 1, componentType: 'ic-dip',
    },
    {
      id: 'S_clk', label: 'S (Clocked)',
      description: 'Set input of the Clocked R-S flip-flop (center).',
      x: -0.08, y: 0.18, hw: 0.05, hh: 0.045,
      color: '#34d399', step: 3, componentType: 'terminal',
    },
    {
      id: 'CLK', label: 'CLK',
      description: 'Clock input — a rising edge latches S/R into the flip-flop.',
      x: -0.09, y: 0.03, hw: 0.05, hh: 0.045,
      color: '#facc15', step: 3, componentType: 'terminal',
    },
    {
      id: 'R_clk', label: 'R (Clocked)',
      description: 'Reset input of the Clocked R-S flip-flop (center).',
      x: 0.00, y: -0.11, hw: 0.05, hh: 0.045,
      color: '#34d399', step: 3, componentType: 'terminal',
    },
    {
      id: 'G3', label: 'NAND G3',
      description: 'G3 — upper gate of the Clocked section.',
      x: 0.23, y: 0.05, hw: 0.08, hh: 0.06,
      color: '#f59e0b', step: 3, componentType: 'ic-dip',
    },
    {
      id: 'G4', label: 'NAND G4',
      description: 'G4 — lower gate of the Clocked section.',
      x: 0.23, y: -0.11, hw: 0.08, hh: 0.06,
      color: '#f59e0b', step: 3, componentType: 'ic-dip',
    },
    {
      id: 'Q', label: 'Q output',
      description: 'Q output (yellow socket, right). Measure against GND.',
      x: 0.44, y: 0.02, hw: 0.05, hh: 0.045,
      color: '#a855f7', step: 2, componentType: 'terminal',
    },
    {
      id: 'Qbar', label: 'Q̄ output',
      description: 'Q-bar (complement) output (yellow socket, right lower).',
      x: 0.44, y: -0.23, hw: 0.05, hh: 0.045,
      color: '#a855f7', step: 2, componentType: 'terminal',
    },
  ],
  connections: [
    // RS Latch (unclocked) — left section, separate circuit
    { fromId: 'R_latch', toId: 'G1',   color: '#22d3ee' },
    { fromId: 'S_latch', toId: 'G2',   color: '#22d3ee' },
    // Clocked RS Flip-Flop — centre/right section
    { fromId: 'S_clk',   toId: 'G3',   color: '#34d399' },
    { fromId: 'CLK',     toId: 'G3',   color: '#facc15' },
    { fromId: 'R_clk',   toId: 'G4',   color: '#34d399' },
    { fromId: 'G3',      toId: 'Q',    color: '#a855f7' },
    { fromId: 'G4',      toId: 'Qbar', color: '#a855f7' },
  ],
}

// ─── JK Flip-Flop using NAND gate  (DIC-060)  ───────────────────────────────
const jkFlipFlopConfig: KitArConfig = {
  arTarget: '/targets/jk-flipflop.mind',
  kitImage: '/kits/jk-flipflop.jpeg',
  imageAspect: 0.74,
  steps: [
    'Power ON the kit.',
    'Set J and K inputs using the toggle switches on the left (0 = down, 1 = up).',
    'Tap the toggle once — observe Q and Q̄ on the yellow sockets (right side).',
    'Toggle J=1, K=1 repeatedly to verify the flip-flop toggles on each clock edge.',
  ],
  markers: [
    {
      id: 'pwr', label: 'Power ON',
      description: 'Rocker switch (top-left) — must be ON before applying inputs.',
      x: -0.42, y: 0.27, hw: 0.055, hh: 0.06,
      color: '#ef4444', step: 0, componentType: 'switch',
    },
    {
      id: 'J', label: 'J Input',
      description: 'J input toggle switch + green socket. Toggle UP = logic 1.',
      x: -0.23, y: 0.10, hw: 0.09, hh: 0.07,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'K', label: 'K Input',
      description: 'K input toggle switch + blue socket. Toggle UP = logic 1.',
      x: -0.23, y: -0.16, hw: 0.09, hh: 0.07,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'G1', label: 'NAND Gate 1',
      description: 'Gate 1 — upper 3-input NAND connected to J input.',
      x: -0.10, y: 0.09, hw: 0.09, hh: 0.07,
      color: '#f59e0b', step: 2, componentType: 'ic-dip',
    },
    {
      id: 'G2', label: 'NAND Gate 2',
      description: 'Gate 2 — lower 3-input NAND connected to K input.',
      x: -0.05, y: -0.11, hw: 0.09, hh: 0.07,
      color: '#f59e0b', step: 2, componentType: 'ic-dip',
    },
    {
      id: 'G3', label: 'NAND Gate 3',
      description: 'Gate 3 — upper SR latch NAND (connected to G1 output).',
      x: 0.13, y: 0.09, hw: 0.09, hh: 0.07,
      color: '#f59e0b', step: 2, componentType: 'ic-dip',
    },
    {
      id: 'G4', label: 'NAND Gate 4',
      description: 'Gate 4 — lower SR latch NAND (connected to G2 output).',
      x: 0.04, y: -0.06, hw: 0.09, hh: 0.07,
      color: '#f59e0b', step: 2, componentType: 'ic-dip',
    },
    {
      id: 'Q', label: 'Q output',
      description: 'Q output — upper yellow socket (right). Measure against black GND socket.',
      x: 0.29, y: 0.09, hw: 0.055, hh: 0.055,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'Qbar', label: 'Q̄ output',
      description: 'Q-bar output — lower yellow socket (right).',
      x: 0.29, y: -0.17, hw: 0.055, hh: 0.055,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'GND', label: 'GND',
      description: 'Ground reference — black socket. Connect multimeter negative probe here.',
      x: 0.33, y: -0.01, hw: 0.04, hh: 0.04,
      color: '#6b7280', step: 3, componentType: 'terminal',
    },
  ],
  connections: [
    // Clean linear signal flow — feedback is on PCB traces, not user-facing
    { fromId: 'J',  toId: 'G1',   color: '#22d3ee' },
    { fromId: 'K',  toId: 'G2',   color: '#22d3ee' },
    { fromId: 'G1', toId: 'G3',   color: '#f59e0b' },
    { fromId: 'G2', toId: 'G4',   color: '#f59e0b' },
    { fromId: 'G3', toId: 'Q',    color: '#a855f7' },
    { fromId: 'G4', toId: 'Qbar', color: '#a855f7' },
  ],
}

// ─── IC 741 Inverting / Non-Inverting Amplifier  ────────────────────────────
const ic741Config: KitArConfig = {
  arTarget: '/targets/ic741-amp.mind',
  kitImage: '/kits/ic741-amp.jpeg',
  imageAspect: 0.80,
  steps: [
    'Power ON the kit; connect ±12 V DC supply to V+ and V− terminals.',
    'Connect signal generator output to V1 (AF I/P) — start with 1 kHz sine wave at 0.1 V pp.',
    'Observe output Vo on the CRO; calculate gain = Vo / Vin.',
    'For inverting: check 180° phase shift. For non-inverting: confirm in-phase output.',
  ],
  markers: [
    {
      id: 'pwr', label: 'Power Switch',
      description: 'Power rocker switch (top-left of kit).',
      x: -0.42, y: 0.31, hw: 0.05, hh: 0.05,
      color: '#ef4444', step: 0, componentType: 'switch',
    },
    {
      id: 'Vplus', label: 'V+ (+12 V)',
      description: '+12 V DC supply terminal. Connect positive supply rail.',
      x: 0.21, y: 0.13, hw: 0.06, hh: 0.05,
      color: '#ef4444', step: 0, componentType: 'terminal',
    },
    {
      id: 'Vminus', label: 'V− (−12 V)',
      description: '−12 V DC supply terminal. Connect negative supply rail.',
      x: 0.17, y: 0.045, hw: 0.06, hh: 0.05,
      color: '#f59e0b', step: 0, componentType: 'terminal',
    },
    {
      id: 'Vi', label: 'Vi (Input)',
      description: 'AF input terminal V1 — connect signal generator positive probe here.',
      x: -0.33, y: -0.14, hw: 0.07, hh: 0.06,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'R1', label: 'R1 (Input res.)',
      description: 'R1 — input resistor. Connect one end to Vi, the other end goes to IC741 Pin 2 (−).',
      x: -0.32, y: 0.12, hw: 0.09, hh: 0.05,
      color: '#34d399', step: 1, componentType: 'resistor',
    },
    {
      id: 'RF_in', label: 'RF (Output side)',
      description: 'RF feedback resistor — the end facing IC741 Pin 6 (output). Connect wire from IC741 output here.',
      x: 0.00, y: 0.11, hw: 0.06, hh: 0.05,
      color: '#34d399', step: 1, componentType: 'resistor',
    },
    {
      id: 'RF_out', label: 'RF (Input side)',
      description: 'RF feedback resistor — the end facing IC741 Pin 2 (−input). Connect wire from here to IC741 Pin 2.',
      x: -0.01, y: 0.11, hw: 0.06, hh: 0.05,
      color: '#34d399', step: 1, componentType: 'resistor',
    },
    {
      id: 'IC741', label: 'IC 741 Op-Amp',
      description: '8-pin DIP IC 741 operational amplifier. Pin 2 = INV input (−), Pin 3 = NON-INV input (+), Pin 6 = Output.',
      x: 0.02, y: -0.03, hw: 0.12, hh: 0.09,
      color: '#f59e0b', step: 2, componentType: 'ic-dip',
    },
    {
      id: 'IC741_P2', label: 'IC741 Pin 2 (−Input)',
      description: 'Inverting input socket of IC741 (Pin 2, labelled "2" or "−" on kit). R1 output and RF feedback both connect here.',
      x: -0.12, y: -0.09, hw: 0.05, hh: 0.04,
      color: '#fb923c', step: 2, componentType: 'terminal',
    },
    {
      id: 'IC741_P6', label: 'IC741 Pin 6 (Output)',
      description: 'Output socket of IC741 (Pin 6, labelled "6" or "OUT" on kit). Connects to Vo terminal and to RF feedback resistor.',
      x: 0.03, y: -0.08, hw: 0.05, hh: 0.04,
      color: '#fb923c', step: 2, componentType: 'terminal',
    },
    {
      id: 'Vo', label: 'Vo (Output)',
      description: 'Output measurement terminal Vo — connect CRO Channel 2 here to observe amplified signal.',
      x: 0.17, y: -0.11, hw: 0.07, hh: 0.06,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'GND', label: 'GND',
      description: 'Circuit ground. Connect CRO and supply grounds here.',
      x: -0.02, y: -0.28, hw: 0.06, hh: 0.05,
      color: '#6b7280', step: 0, componentType: 'terminal',
    },
  ],
  connections: [
    { fromId: 'Vi',       toId: 'R1',       color: '#22d3ee' },   // Step 1: Signal generator → R1 input
    { fromId: 'R1',       toId: 'IC741_P2', color: '#34d399' },   // Step 2: R1 output → IC741 inverting input (Pin 2)
    { fromId: 'IC741_P6', toId: 'RF_in',   color: '#6366f1' },   // Step 3: IC741 output (Pin 6) → RF feedback resistor
    { fromId: 'RF_out',   toId: 'IC741_P2', color: '#f59e0b' },   // Step 4: RF feedback → IC741 inverting input (Pin 2)
    { fromId: 'IC741_P6', toId: 'Vo',       color: '#a855f7' },   // Step 5: IC741 output (Pin 6) → Vo measurement terminal
  ],
}

// ─── IC 555 Astable / Monostable Multivibrator  ─────────────────────────────
const ic555Config: KitArConfig = {
  arTarget: '/targets/ic555-astable.mind',
  kitImage: '/kits/ic555-astable.jpeg',
  imageAspect: 0.77,
  steps: [
    'Power ON. Ensure +12 V supply is connected (VCC terminal).',
    'Left section — IC 555 Astable: set Ra, Rb (pot), C1. Measure frequency at VC output.',
    'Verify: f = 1.44 / ((Ra + 2·Rb) × C1). Adjust pot to change duty cycle.',
    'Right section — Transistor Astable: observe square wave, compare period with IC 555.',
  ],
  markers: [
    {
      id: 'pwr', label: 'Power Switch',
      description: 'Rocker switch — turn ON before applying supply.',
      x: -0.43, y: 0.28, hw: 0.05, hh: 0.05,
      color: '#ef4444', step: 0, componentType: 'switch',
    },
    {
      id: 'VCC', label: '+12 V (VCC)',
      description: '+12 V supply input for the astable circuit.',
      x: -0.22, y: 0.18, hw: 0.07, hh: 0.05,
      color: '#ef4444', step: 0, componentType: 'terminal',
    },
    {
      id: 'R1', label: 'R1',
      description: 'R1 — fixed resistor (controls high-time of output pulse).',
      x: -0.38, y: 0.07, hw: 0.07, hh: 0.05,
      color: '#34d399', step: 1, componentType: 'resistor',
    },
    {
      id: 'R2', label: 'R2 / Rb (Pot)',
      description: 'Rb potentiometer — adjust to change frequency and duty cycle.',
      x: -0.28, y: 0.07, hw: 0.07, hh: 0.05,
      color: '#34d399', step: 1, componentType: 'potentiometer',
    },
    {
      id: 'IC555', label: 'IC 555',
      description: '8-pin 555 timer IC. Pin 3 = Output, Pin 4 = Reset, Pin 5 = Control.',
      x: -0.20, y: -0.04, hw: 0.10, hh: 0.09,
      color: '#f59e0b', step: 1, componentType: 'ic-dip',
    },
    {
      id: 'C1', label: 'C1 (Timing cap)',
      description: 'Timing capacitor C1. Changes the period: T = 0.693·(Ra+2Rb)·C1.',
      x: -0.32, y: -0.14, hw: 0.07, hh: 0.07,
      color: '#22d3ee', step: 1, componentType: 'capacitor',
    },
    {
      id: 'Vc', label: 'VC Output',
      description: 'Output of IC 555 astable. Connect CRO here to observe square wave.',
      x: -0.14, y: -0.04, hw: 0.06, hh: 0.05,
      color: '#a855f7', step: 2, componentType: 'terminal',
    },
    {
      id: 'GND', label: 'GND',
      description: 'Ground reference for both sections.',
      x: -0.22, y: -0.23, hw: 0.06, hh: 0.05,
      color: '#6b7280', step: 0, componentType: 'terminal',
    },
    {
      id: 'TR1', label: 'BC548 (Q1)',
      description: 'Transistor Q1 (BC548) — part of the right-side transistor astable.',
      x: 0.12, y: -0.07, hw: 0.08, hh: 0.09,
      color: '#f59e0b', step: 3, componentType: 'transistor',
    },
    {
      id: 'TR2', label: 'BC548 (Q2)',
      description: 'Transistor Q2 (BC548) — complements Q1 in the cross-coupled astable.',
      x: 0.21, y: -0.08, hw: 0.08, hh: 0.09,
      color: '#f59e0b', step: 3, componentType: 'transistor',
    },
  ],
  connections: [
    // Show series timing chain VCC→R1→R2→IC555 (R1 and R2 are in series)
    { fromId: 'VCC',  toId: 'R1',    color: '#ef4444' },
    { fromId: 'R1',   toId: 'R2',    color: '#34d399' },
    { fromId: 'R2',   toId: 'IC555', color: '#34d399' },
    { fromId: 'C1',   toId: 'IC555', color: '#22d3ee' },
    { fromId: 'IC555', toId: 'Vc',   color: '#a855f7' },
    { fromId: 'TR1',  toId: 'TR2',   color: '#f59e0b' },
  ],
}

// ─── NPN Transistor — Common Emitter Characteristics  ────────────────────────
const npnCeConfig: KitArConfig = {
  arTarget: '/targets/npn-ce.mind',
  kitImage: '/kits/npn-ce.jpeg',
  imageAspect: 0.79,                  // h/w of npn-ce.jpeg (actual: 1005/1280 = 0.785)
  steps: [
    'Power ON using the rocker switch (top-right corner of the kit).',
    'Connect VBB supply (+) to the IB input socket (left side). Connect (−) to left GND.',
    'Connect VCC supply (+) to the VCE input socket (right side). Connect (−) to right GND.',
    'Adjust P1 (1 kΩ) to set base current IB. Read IB on the top-left digital meter.',
    'Adjust P2 (22 kΩ) to vary VCE. Read VBE (bottom-left) and VCE (bottom-right) meters. Plot IC vs VCE for each fixed IB.',
  ],
  markers: [
    {
      id: 'pwr', label: 'Power Switch',
      description: 'Rocker switch — flip to ON before connecting any supply.',
      x: 0.38, y: 0.19, hw: 0.05, hh: 0.06,
      color: '#ef4444', step: 0, componentType: 'switch',
    },

    // ── VBB / Base-bias side (left) ───────────────────────────────────────────
    {
      id: 'VBB_plus', label: 'VBB (+) Input',
      description: 'Connect positive terminal of base-bias DC supply here (left orange socket). Typical range 0–5 V.',
      x: -0.31, y: 0.08, hw: 0.04, hh: 0.04,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'P1', label: 'P1 — RB (1 kΩ)',
      description: 'Base potentiometer P1 (1 kΩ). Rotate clockwise to increase IB. This is the base resistor RB.',
      x: -0.37, y: -0.02, hw: 0.07, hh: 0.07,
      color: '#34d399', step: 1, componentType: 'potentiometer',
    },
    {
      id: 'GND_left', label: 'GND (IB side)',
      description: 'Ground terminal on the IB/VBB side. Connect negative (−) of the base-bias supply here.',
      x: -0.38, y: -0.17, hw: 0.04, hh: 0.04,
      color: '#6b7280', step: 1, componentType: 'terminal',
    },

    // ── VCC / Collector side (right) ──────────────────────────────────────────
    {
      id: 'VCC_plus', label: 'VCC (+) Input',
      description: 'Connect positive terminal of collector supply VCC here (right orange socket). Typical range 0–12 V.',
      x: 0.20, y: 0.05, hw: 0.04, hh: 0.04,
      color: '#f59e0b', step: 2, componentType: 'terminal',
    },
    {
      id: 'P2', label: 'P2 — RC (22 kΩ)',
      description: 'Collector potentiometer P2 (22 kΩ). Adjusts VCE. This is the collector resistor RC.',
      x: 0.17, y: -0.01, hw: 0.07, hh: 0.07,
      color: '#34d399', step: 2, componentType: 'potentiometer',
    },
    {
      id: 'GND_right', label: 'GND (VCE side)',
      description: 'Ground terminal on the VCC/VCE side. Connect negative (−) of the collector supply here.',
      x: 0.14, y: -0.16, hw: 0.04, hh: 0.04,
      color: '#6b7280', step: 2, componentType: 'terminal',
    },

    // ── Transistor ────────────────────────────────────────────────────────────
    {
      id: 'Q1', label: 'Q1 — CL100 (NPN)',
      description: 'NPN transistor CL100 in Common Emitter configuration. B = Base, C = Collector, E = Emitter (tied to GND).',
      x: -0.06, y: 0.01, hw: 0.09, hh: 0.08,
      color: '#f59e0b', step: 1, componentType: 'transistor',
    },
    {
      id: 'Q1_B', label: 'Base (B) Socket',
      description: 'Base terminal of Q1. RB (P1) connects here. This controls IB and therefore IC.',
      x: -0.12, y: 0.08, hw: 0.04, hh: 0.04,
      color: '#22d3ee', step: 1, componentType: 'terminal',
    },
    {
      id: 'Q1_C', label: 'Collector (C) Socket',
      description: 'Collector terminal of Q1. RC (P2) connects above; VCE is measured from here to GND.',
      x: -0.04, y: 0.07, hw: 0.04, hh: 0.04,
      color: '#f59e0b', step: 2, componentType: 'terminal',
    },
    {
      id: 'GND_center', label: 'GND (Emitter / Common)',
      description: 'Common ground. Emitter of Q1 is tied here. Also the reference for VBE and VCE measurements.',
      x: 0.01, y: -0.22, hw: 0.05, hh: 0.04,
      color: '#6b7280', step: 1, componentType: 'terminal',
    },

    // ── Measurement points ────────────────────────────────────────────────────
    {
      id: 'IB_meter', label: 'IB Meter (µA)',
      description: 'Top-left digital display — reads base current IB in microamperes. Observe while rotating P1.',
      x: -0.36, y: 0.23, hw: 0.12, hh: 0.08,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'IC_meter', label: 'IC Meter',
      description: 'Top-right digital display — reads collector current IC (or emitter current IE). Observe while adjusting P2.',
      x: 0.12, y: 0.23, hw: 0.12, hh: 0.08,
      color: '#a855f7', step: 3, componentType: 'terminal',
    },
    {
      id: 'VBE_plus', label: 'VBE (+) Terminal',
      description: 'Connect voltmeter (+) probe here to measure VBE (base-emitter junction voltage, ~0.6–0.7 V in active region).',
      x: -0.42, y: -0.31, hw: 0.04, hh: 0.04,
      color: '#6366f1', step: 4, componentType: 'terminal',
    },
    {
      id: 'VCE_plus', label: 'VCE (+) Terminal',
      description: 'Connect voltmeter (+) probe here to measure VCE (collector-emitter voltage). Vary P2 to sweep VCE.',
      x: 0.05, y: -0.30, hw: 0.04, hh: 0.04,
      color: '#6366f1', step: 4, componentType: 'terminal',
    },
  ],
  connections: [
    { fromId: 'VBB_plus', toId: 'P1',        color: '#22d3ee' },  // Step 1: VBB supply → base pot RB
    { fromId: 'P1',       toId: 'Q1_B',       color: '#34d399' },  // Step 1: RB pot → transistor base
    { fromId: 'VCC_plus', toId: 'P2',         color: '#f59e0b' },  // Step 2: VCC supply → collector pot RC
    { fromId: 'P2',       toId: 'Q1_C',       color: '#34d399' },  // Step 2: RC pot → transistor collector
    { fromId: 'Q1_C',     toId: 'GND_center', color: '#6b7280' },  // Collector → GND through transistor (common emitter)
    { fromId: 'VBE_plus', toId: 'GND_center', color: '#6366f1' },  // Step 4: VBE measurement
    { fromId: 'VCE_plus', toId: 'GND_center', color: '#6366f1' },  // Step 4: VCE measurement
  ],
}

// ─── Registry  ───────────────────────────────────────────────────────────────
export const KIT_AR_CONFIGS: Record<string, KitArConfig> = {
  '1-npn-ce':                     npnCeConfig,
  '2-ic741-inverting':            ic741Config,
  '3-ic741-noninverting':         ic741Config,
  '5-ic555-astable':              ic555Config,
  '8-full-subtractor': subtractorConfig,
  '9-sr-flipflop':                srFlipFlopConfig,
  '10-jk-flipflop':               jkFlipFlopConfig,
}
