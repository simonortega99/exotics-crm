import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './lib/store.jsx'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import Sidebar from './components/Sidebar.jsx'
import { FeedbackRoot } from './components/feedback.jsx'
import SheetsSync from './components/SheetsSync.jsx'
import Login from './pages/Login.jsx'

// Cada página se carga bajo demanda (code-splitting) para acelerar el arranque.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Contactos = lazy(() => import('./pages/Contactos.jsx'))
const Oportunidades = lazy(() => import('./pages/Oportunidades.jsx'))
const Funnel = lazy(() => import('./pages/Funnel.jsx'))
const Inventario = lazy(() => import('./pages/Inventario.jsx'))
const Retomas = lazy(() => import('./pages/Retomas.jsx'))
const Busquedas = lazy(() => import('./pages/Busquedas.jsx'))
const Ventas = lazy(() => import('./pages/Ventas.jsx'))
const Fidelizacion = lazy(() => import('./pages/Fidelizacion.jsx'))
const Actividades = lazy(() => import('./pages/Actividades.jsx'))
const Citas = lazy(() => import('./pages/Citas.jsx'))

function Shell() {
  const { user } = useAuth()
  if (!user) return <Login />
  return (
    <HashRouter>
      <div className="app-shell">
        <Sidebar />
        <main>
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--muted, #888)' }}>Cargando…</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contactos" element={<Contactos />} />
              <Route path="/oportunidades" element={<Oportunidades />} />
              <Route path="/funnel" element={<Funnel />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/retomas" element={<Retomas />} />
              <Route path="/busquedas" element={<Busquedas />} />
              <Route path="/ventas" element={<Ventas />} />
              <Route path="/fidelizacion" element={<Fidelizacion />} />
              <Route path="/actividades" element={<Actividades />} />
              <Route path="/citas" element={<Citas />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </HashRouter>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
      <SheetsSync />
      <FeedbackRoot />
    </StoreProvider>
  )
}
