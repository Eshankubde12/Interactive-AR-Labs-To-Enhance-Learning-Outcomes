export type Bit = 0 | 1

export function fullSubtractor(A: Bit, B: Bit, Bin: Bit) {
  const axb = (A ^ B) as Bit
  const D = (axb ^ Bin) as Bit
  const borrow = (((A ^ 1) & B) | (((axb ^ 1) as Bit) & Bin)) as Bit
  return { D, borrow }
}

export function bitToVolts(bit: Bit, vcc = 5) {
  return bit === 1 ? vcc : 0
}

