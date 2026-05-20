import type { ReactNode } from 'react'

export function npnCeKitUnderlay(opts: {
  powerOn: boolean
  vbb: number
  vcc: number
  ib_uA: number
  ic_mA: number
  vce: number
  region: string
}): ReactNode {
  const { powerOn, vbb, vcc, ib_uA, ic_mA, vce, region } = opts

  return (
    <>
      {/* faceplate */}
      <rect x="12" y="12" width="976" height="626" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
      <text x="500" y="58" textAnchor="middle" fontSize="24" fill="rgba(255,255,255,0.85)" fontWeight="800">
        TRANSISTOR CHARACTERISTIC (COMMON EMITTER)
      </text>

      {/* power switch (visual) */}
      <g>
        <rect x="872" y="92" width="86" height="110" rx="12" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.16)" />
        <text x="915" y="120" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.75)" fontWeight="700">
          POWER
        </text>
        <rect
          x="895"
          y="132"
          width="40"
          height="58"
          rx="8"
          fill={powerOn ? 'rgba(34,211,238,0.30)' : 'rgba(239,68,68,0.22)'}
          stroke="rgba(255,255,255,0.18)"
        />
        <circle cx="915" cy={powerOn ? 152 : 174} r="10" fill="rgba(255,255,255,0.55)" />
        <text x="915" y="208" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)">
          {powerOn ? 'ON' : 'OFF'}
        </text>
      </g>

      {/* digital displays */}
      {display(130, 120, 'I\u2091 (µA)', ib_uA.toFixed(1))}
      {display(500, 120, 'I\u1D9C (mA)', ic_mA.toFixed(2))}
      {display(210, 520, 'VBE (V)', vbb.toFixed(2))}
      {display(610, 520, 'VCE (V)', vce.toFixed(2))}

      {/* knobs */}
      {knob(95, 320, 'P1 (VBB)', vbb / 5)}
      {knob(690, 320, 'P2 (VCC)', vcc / 12)}

      {/* region indicator */}
      <g>
        <rect x="410" y="260" width="180" height="44" rx="14" fill="rgba(0,0,0,0.30)" stroke="rgba(255,255,255,0.14)" />
        <text x="500" y="288" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.8)" fontWeight="700">
          REGION: {region.toUpperCase()}
        </text>
      </g>

      {/* light “printed” circuit hints */}
      <g opacity="0.55">
        <text x="410" y="340" fontSize="14" fill="rgba(255,255,255,0.65)" fontWeight="700">
          B
        </text>
        <text x="410" y="400" fontSize="14" fill="rgba(255,255,255,0.65)" fontWeight="700">
          C
        </text>
        <text x="410" y="460" fontSize="14" fill="rgba(255,255,255,0.65)" fontWeight="700">
          E
        </text>
      </g>
    </>
  )
}

function display(x: number, y: number, label: string, value: string) {
  return (
    <g>
      <rect x={x - 150} y={y - 54} width={300} height={86} rx="14" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.18)" />
      <text x={x} y={y - 64} textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.72)" fontWeight="700">
        {label}
      </text>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize="42"
        fill="rgba(248,113,113,0.95)"
        fontFamily="ui-monospace, Consolas, monospace"
        fontWeight="800"
      >
        {value.padStart(5, ' ')}
      </text>
    </g>
  )
}

function knob(x: number, y: number, label: string, t01: number) {
  const a = -140 + t01 * 280
  return (
    <g>
      <text x={x} y={y - 78} textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.72)" fontWeight="700">
        {label}
      </text>
      <circle cx={x} cy={y} r="54" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" />
      <circle cx={x} cy={y} r="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
      <line
        x1={x}
        y1={y}
        x2={x + Math.cos((a * Math.PI) / 180) * 34}
        y2={y + Math.sin((a * Math.PI) / 180) * 34}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </g>
  )
}

