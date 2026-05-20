import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { ModeSelectPage } from './pages/ModeSelectPage'
import { VirtualLabPage } from './pages/VirtualLabPage'
import { ArLabPage } from './pages/ArLabPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/practical/:id/mode" element={<ModeSelectPage />} />
        <Route path="/practical/:id/virtual" element={<VirtualLabPage />} />
        <Route path="/practical/:id/ar" element={<ArLabPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
