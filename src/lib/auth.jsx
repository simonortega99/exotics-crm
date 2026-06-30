import { createContext, useContext, useState, useEffect } from 'react'
import { useStore } from './store.jsx'
import { supabase } from './supabaseClient.js'

// Autenticación.
//  - Con Supabase configurado: login real con Supabase Auth (email + contraseña).
//    Los roles (admin/asesor) y nombres se toman del `equipo` cruzando por email.
//  - Sin Supabase (dev local): login simple contra `equipo` (usuario/contraseña).
const AuthContext = createContext(null)
const KEY = 'exotics_hq_user' // solo modo local

// Dueños: siempre admin, sin importar la lista de Equipo (evita quedar bloqueado).
const SUPER_ADMINS = ['simonortega99@gmail.com']

export function AuthProvider({ children }) {
  const { data } = useStore()
  const [localUser, setLocalUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
  })
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: s }) => { setSession(s.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  let user = null, isAdmin = false
  if (supabase) {
    if (session?.user) {
      const email = (session.user.email || '')
      const entries = data.equipo || []
      const withEmail = entries.filter(e => e.email)
      const entry = entries.find(e => (e.email || '').toLowerCase() === email.toLowerCase())
      // Dueños siempre admin; si no, el rol de su entrada en Equipo; y si todavía
      // nadie tiene email configurado, quien entre es admin (arranque seguro).
      const rol = SUPER_ADMINS.includes(email.toLowerCase()) ? 'admin'
        : entry ? (entry.rol || 'asesor')
        : (withEmail.length === 0 ? 'admin' : 'asesor')
      user = { nombre: entry?.nombre || email, email, usuario: email, rol }
      isAdmin = rol === 'admin'
    }
  } else if (localUser) {
    const entry = (data.equipo || []).find(e => e.usuario === localUser.usuario)
    user = localUser
    isAdmin = (entry?.rol || localUser.rol) === 'admin'
  }

  async function login(idOrEmail, password) {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: (idOrEmail || '').trim(), password })
      return !error
    }
    const u = (data.equipo || []).find(e => (e.usuario || '').toLowerCase() === (idOrEmail || '').trim().toLowerCase() && e.password === password)
    if (!u) return false
    const s = { nombre: u.nombre, usuario: u.usuario, rol: u.rol || 'asesor' }
    setLocalUser(s); localStorage.setItem(KEY, JSON.stringify(s))
    return true
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setLocalUser(null); localStorage.removeItem(KEY)
  }

  return <AuthContext.Provider value={{ user, isAdmin, login, logout, authReady }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
