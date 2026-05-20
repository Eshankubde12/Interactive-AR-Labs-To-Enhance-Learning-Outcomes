import { Link } from 'react-router-dom'
import { PRACTICALS } from '../data/practicals'

const ICONS: Record<string, string> = {
  '1-npn-ce': '🔌',
  '2-ic741-inverting': '🔊',
  '3-ic741-noninverting': '📡',
  '4-transistor-switch': '💡',
  '5-ic555-astable': '🌊',
  '6-ttl-logic-gates': '⚙️',
  '7-half-subtractor': '➖',
  '8-full-subtractor': '🔢',
  '9-sr-flipflop': '🔁',
  '10-jk-flipflop': '🔄',
}

export function HomePage() {
  return (
    <>
      <div className="home-hero">
        <div className="home-eyebrow">⚡ Electronics Lab</div>
        <h1 className="h1">Choose your<br />Practical</h1>
        <p className="p" style={{ marginTop: 8, maxWidth: 400 }}>
          Pick an experiment and run it virtually or scan your real kit with AR.
        </p>
        <div className="home-chips">
          <span className="home-chip">📱 Mobile-first</span>
          <span className="home-chip">🧭 Guided steps</span>
          <span className="home-chip">🔬 3D components</span>
          <span className="home-chip">📷 AR scanning</span>
        </div>
      </div>

      <div className="section-label">All practicals</div>

      <section className="grid">
        {PRACTICALS.map((p) => (
          <Link key={p.id} to={`/practical/${p.id}/mode`} className="card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="card-accent" />
            {p.kitImage ? (
              <img className="card-thumb" src={p.kitImage} alt="" />
            ) : (
              <div className="card-thumb-empty">{ICONS[p.id] ?? '🔬'}</div>
            )}
            <div className="card-body">
              <div className="card-sr">Practical {p.srNo}</div>
              <div className="card-title">{p.title}</div>
              <div className="card-sub">{p.short}</div>
              <div className="card-footer">
                <span
                  className={`btn primary`}
                  style={{ fontSize: 12, padding: '7px 13px', minHeight: 34 }}
                >
                  Open →
                </span>
                <span className={`status-dot${p.status === 'coming_soon' ? ' soon' : ''}`}>
                  {p.status === 'ready' ? 'Ready' : p.status === 'template' ? 'Template' : 'Soon'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </>
  )
}
