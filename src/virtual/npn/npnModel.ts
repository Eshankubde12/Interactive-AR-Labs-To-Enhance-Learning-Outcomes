function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export type NpnParams = {
  beta: number
  VbeOn: number
  VceSat: number
}

export type CeCircuit = {
  VBB: number
  VCC: number
  RB: number
  RC: number
}

export type CeOperatingPoint = {
  VBE: number
  IB: number // A
  IC: number // A
  VCE: number
  region: 'cutoff' | 'active' | 'saturation'
}

export function solveCeOperatingPoint(
  circuit: CeCircuit,
  params: NpnParams,
  connected: { powerOn: boolean; emitterToGnd: boolean; basePath: boolean; collectorPath: boolean },
): CeOperatingPoint {
  if (!connected.powerOn || !connected.emitterToGnd || !connected.basePath || !connected.collectorPath) {
    return { VBE: 0, IB: 0, IC: 0, VCE: 0, region: 'cutoff' }
  }

  const VBB = clamp(circuit.VBB, 0, 5)
  const VCC = clamp(circuit.VCC, 0, 12)
  const RB = Math.max(100, circuit.RB)
  const RC = Math.max(10, circuit.RC)

  // Very simple educational model:
  // IB ≈ (VBB - VbeOn) / RB (if VBB > VbeOn)
  const VBE = VBB > params.VbeOn ? params.VbeOn : VBB
  const IB = VBB > params.VbeOn ? (VBB - params.VbeOn) / RB : 0
  const IC_active = params.beta * IB

  // Collector current limited by VCC and RC with saturation at VceSat
  const IC_sat = VCC > params.VceSat ? (VCC - params.VceSat) / RC : 0
  const IC = Math.min(IC_active, IC_sat)

  let region: CeOperatingPoint['region'] = 'cutoff'
  if (IB <= 0) region = 'cutoff'
  else if (IC_active <= IC_sat) region = 'active'
  else region = 'saturation'

  const VCE = clamp(VCC - IC * RC, 0, VCC)
  return { VBE, IB, IC, VCE, region }
}

