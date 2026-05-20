import { Link, useParams } from 'react-router-dom'
import { getPractical } from '../data/practicals'
import { KitArExperience } from '../ar/KitArExperience'
import { KIT_AR_CONFIGS } from '../ar/kitArConfigs'

export function ArLabPage() {
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

  const config = KIT_AR_CONFIGS[practical.id]

  // Kits that have an AR config get the full camera experience
  if (config) {
    return <KitArExperience practical={practical} config={config} />
  }

  // Remaining kits (no kit image / no config yet): show info panel
  return (
    <div className="two-col">
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 26, marginBottom: 8 }}>
          AR — {practical.title}
        </h2>
        <p className="p">
          AR overlay for this practical will be available once a{' '}
          <code>.mind</code> image-target file is compiled from the kit photo.
        </p>
        <p className="p" style={{ marginTop: 8 }}>
          Steps to enable AR for this kit:
        </p>
        <ol style={{ margin: '8px 0 0', paddingLeft: 22, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
          <li>Take a clear, flat, well-lit photo of the physical kit.</li>
          <li>
            Upload it to the{' '}
            <a
              href="https://hiukim.github.io/mind-ar-js-doc/tools/compile"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              MindAR Image Compiler
            </a>
            .
          </li>
          <li>Download the <code>.mind</code> file and place it in <code>public/targets/</code>.</li>
          <li>Add a config entry in <code>src/ar/kitArConfigs.ts</code>.</li>
        </ol>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn primary" to="/practical/8-full-subtractor/ar">
            See AR demo (practical #8)
          </Link>
          <Link className="btn" to={`/practical/${practical.id}/mode`}>Back</Link>
        </div>
      </div>

      <div className="panel">
        <p className="card-title">Kit preview</p>
        {practical.kitImage ? (
          <img
            src={practical.kitImage}
            alt={practical.title}
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1px solid var(--border)',
              display: 'block',
              marginTop: 10,
            }}
          />
        ) : (
          <p className="p" style={{ marginTop: 10 }}>No kit image available yet.</p>
        )}
      </div>
    </div>
  )
}
