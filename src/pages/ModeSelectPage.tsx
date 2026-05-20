import { Link, useParams } from 'react-router-dom'
import { getPractical } from '../data/practicals'

export function ModeSelectPage() {
  const { id } = useParams()
  const practical = getPractical(id)

  if (!practical) {
    return (
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 26 }}>Practical not found</h2>
        <p className="p" style={{ marginTop: 8 }}>Go back and pick a practical from the list.</p>
        <div style={{ marginTop: 14 }}>
          <Link className="btn primary" to="/">← Back to list</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent2)', marginBottom: 6 }}>
          Practical {practical.srNo}
        </div>
        <h1 className="h1" style={{ fontSize: 'clamp(22px, 5vw, 34px)' }}>{practical.title}</h1>
        <p className="p" style={{ marginTop: 8 }}>{practical.short}</p>
      </div>

      {/* Kit image */}
      {practical.kitImage && (
        <div style={{ marginBottom: 20, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img
            src={practical.kitImage}
            alt={practical.title}
            style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover', opacity: 0.88 }}
          />
        </div>
      )}

      {/* Mode selection */}
      <div className="section-label">Choose mode</div>
      <div className="mode-grid">
        <Link to={`/practical/${practical.id}/virtual`} className="mode-card virtual">
          <div className="mode-icon">🖥️</div>
          <div className="mode-title">Virtual Lab</div>
          <div className="mode-desc">Simulate the experiment on-screen. Wire up components and read outputs without any physical kit.</div>
          <div className="mode-cta">Start virtual →</div>
        </Link>

        <Link to={`/practical/${practical.id}/ar`} className="mode-card ar">
          <div className="mode-icon">📷</div>
          <div className="mode-title">Physical + AR</div>
          <div className="mode-desc">Scan your real kit with the camera. AR labels overlay component positions and guide you live.</div>
          <div className="mode-cta">Open camera →</div>
        </Link>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          💡 <b style={{ color: 'var(--text)' }}>Virtual</b> mode works offline — great for home study.{' '}
          <b style={{ color: 'var(--text)' }}>AR</b> mode requires camera access and a physical kit.
        </p>
      </div>
    </div>
  )
}
