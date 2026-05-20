export type Bit = 0 | 1

export function xor(a: Bit, b: Bit): Bit {
  return ((a ^ b) & 1) as Bit
}
export function and(a: Bit, b: Bit): Bit {
  return ((a & b) & 1) as Bit
}
export function or(a: Bit, b: Bit): Bit {
  return ((a | b) & 1) as Bit
}
export function not(a: Bit): Bit {
  return (a ? 0 : 1) as Bit
}

export function halfAdder(A: Bit, B: Bit) {
  const sum = xor(A, B)
  const carry = and(A, B)
  return { sum, carry }
}

export function halfSubtractor(A: Bit, B: Bit) {
  const diff = xor(A, B)
  const borrow = and(not(A), B)
  return { diff, borrow }
}

export function fullAdder(A: Bit, B: Bit, Cin: Bit) {
  const s1 = xor(A, B)
  const sum = xor(s1, Cin)
  const carry = or(and(A, B), and(s1, Cin))
  return { sum, carry }
}

export function fullSubtractor(A: Bit, B: Bit, Bin: Bit) {
  const axb = xor(A, B)
  const diff = xor(axb, Bin)
  const borrow = or(and(not(A), B), and(not(axb), Bin))
  return { diff, borrow }
}

export function srNandLatch(S: Bit, R: Bit, prevQ: Bit) {
  // Model as active-low NAND latch inputs: S=0 set, R=0 reset, S=R=1 hold, S=R=0 invalid.
  if (S === 0 && R === 1) return { Q: 1 as Bit, Qbar: 0 as Bit, invalid: false }
  if (S === 1 && R === 0) return { Q: 0 as Bit, Qbar: 1 as Bit, invalid: false }
  if (S === 1 && R === 1) return { Q: prevQ, Qbar: not(prevQ), invalid: false }
  return { Q: 1 as Bit, Qbar: 1 as Bit, invalid: true }
}

export function jkOnRisingEdge(J: Bit, K: Bit, prevQ: Bit) {
  if (J === 0 && K === 0) return prevQ
  if (J === 0 && K === 1) return 0 as Bit
  if (J === 1 && K === 0) return 1 as Bit
  return not(prevQ)
}

