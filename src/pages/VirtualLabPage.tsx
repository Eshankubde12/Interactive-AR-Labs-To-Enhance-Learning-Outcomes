import { Link, useParams } from 'react-router-dom'
import { getPractical } from '../data/practicals'
import { VirtualSubtractorLab } from '../virtual/subtractor/SubtractorLab'
import { VirtualNpnCeLab } from '../virtual/npn/NpnCeLab'
import { VirtualIc741Lab } from '../virtual/ic741/Ic741Lab'
import { VirtualTransistorSwitchLab } from '../virtual/transistor-switch/TransistorSwitchLab'
import { VirtualIc555Lab } from '../virtual/ic555/Ic555Lab'
import { VirtualLogicGatesLab } from '../virtual/logic-gates/LogicGatesLab'
import { VirtualHalfAdderLab } from '../virtual/half-adder/HalfAdderLab'
import { VirtualSrFlipFlopLab } from '../virtual/sr-flipflop/SrFlipFlopLab'
import { VirtualJkFlipFlopLab } from '../virtual/jk-flipflop/JkFlipFlopLab'

export function VirtualLabPage() {
  const { id } = useParams()
  const practical = getPractical(id)

  if (!practical) {
    return (
      <div className="panel">
        <p className="card-title">Practical not found</p>
        <p className="p">Please go back and select a practical.</p>
        <div style={{ marginTop: 12 }}>
          <Link className="btn primary" to="/">Back to list</Link>
        </div>
      </div>
    )
  }

  switch (practical.id) {
    case '1-npn-ce':
      return <VirtualNpnCeLab practical={practical} />

    case '2-ic741-inverting':
      return <VirtualIc741Lab practical={practical} mode="inverting" />

    case '3-ic741-noninverting':
      return <VirtualIc741Lab practical={practical} mode="noninverting" />

    case '4-transistor-switch':
      return <VirtualTransistorSwitchLab practical={practical} />

    case '5-ic555-astable':
      return <VirtualIc555Lab practical={practical} />

    case '6-ttl-logic-gates':
      return <VirtualLogicGatesLab practical={practical} />

    case '7-half-subtractor':
      return <VirtualHalfAdderLab practical={practical} />

    case '8-full-subtractor':
      return <VirtualSubtractorLab practical={practical} />

    case '9-sr-flipflop':
      return <VirtualSrFlipFlopLab practical={practical} />

    case '10-jk-flipflop':
      return <VirtualJkFlipFlopLab practical={practical} />

    default:
      return (
        <div className="panel">
          <p className="card-title">Virtual mode not available</p>
          <p className="p" style={{ marginTop: 8 }}>This practical doesn't have a virtual kit config yet.</p>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" to={`/practical/${practical.id}/mode`}>Back</Link>
          </div>
        </div>
      )
  }
}
