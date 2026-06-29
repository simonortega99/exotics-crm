import { createContext, useContext, useState } from 'react'
import { useStore } from './store.jsx'

// Autenticación simple basada en el equipo guardado en el store.
// (Pensado para uso interno; las credenciales viven en localStorage.)
const AuthContext = createContext(null)
const KEY = 'exotics_hq_user'

export function AuthProvider({ children }) {
  const { data } = useStore()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
  })

  function login(usuario, password) {
    const u = (data.equipo || []).find(
      e => e.usuario.toLowerCase() === usuario.trim().toLowerCase() && e.password === password
    )
    if (!u) return false
    const sesion = { nombre: u.nombre, usuario: u.usuario, rol: u.rol || 'asesor' }
    setUser(sesion)
    localStorage.setItem(KEY, JSON.stringify(sesion))
    return true
  }
  function logout() { setUser(null); localStorage.removeItem(KEY) }

  // El rol vigente se toma del equipo (por si cambió desde la última sesión)
  const rolActual = user ? (data.equipo || []).find(e => e.usuario === user.usuario)?.rol || user.rol : null
  const isAdmin = rolActual === 'admin'

  return <AuthContext.Provider value={{ user, isAdmin, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
