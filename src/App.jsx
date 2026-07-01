import { HashRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './lib/store.jsx'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import Sidebar from './components/Sidebar.jsx'
import { FeedbackRoot } from './components/feedback.jsx'
import SheetsSync from './components/SheetsSync.jsx'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Contactos from './pages/Contactos.jsx'
import Oportunidades from './pages/Oportunidades.jsx'
import Funnel from './pages/Funnel.jsx'
import Inventario from './pages/Inventario.jsx'
import Retomas from './pages/Retomas.jsx'
import Busquedas from './pages/Busquedas.jsx'
import Ventas from './pages/Ventas.jsx'
import Fidelizacion from './pages/Fidelizacion.jsx'
import Actividades from './pages/Actividades.jsx'
import Citas from './pages/Citas.jsx'

function Shell() {
  const { user } = useAuth()
  if (!user) return <Login />
  return (
    <HashRouter>
      <div className="app-shell">
        <Sidebar />
        <main>
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
