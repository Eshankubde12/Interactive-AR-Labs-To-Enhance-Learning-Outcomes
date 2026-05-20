import { Outlet, useLocation, useNavigate } from 'react-router-dom'

export function AppShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const canGoBack = loc.pathname !== '/'

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/" className="brand" style={{ textDecoration: 'none' }}>
            <div className="brand-icon">⚡</div>
            <span className="brand-name">AR <b>Lab</b></span>
            <span className="badge">Virtual • AR</span>
          </a>
          <div className="topbar-actions">
            {canGoBack && (
              <button className="btn" onClick={() => nav(-1)}>
                ← Back
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="layout">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </>
  )
}
