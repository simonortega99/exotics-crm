import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { BrandMark } from '../components/ui.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function Login() {
  const { login } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(false)
  const usaEmail = !!supabase

  async function submit(e) {
    e.preventDefault()
    setCargando(true)
    const ok = await login(usuario, password)
    setCargando(false)
    if (!ok) { setError(true); setPassword('') }
  }

  return (
    <div style={wrap}>
      <form onSubmit={submit} className="card" style={{ width: 360, padding: 28 }}>
        <div className="row gap-12" style={{ marginBottom: 18 }}>
          <BrandMark size={44} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>Exotics Co.</div>
            <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--cyan-700)', fontWeight: 700 }}>CRM</div>
          </div>
        </div>
        <div className="field">
          <div className="field-label">{usaEmail ? 'Email' : 'Usuario'}</div>
          <input className="input" type={usaEmail ? 'email' : 'text'} value={usuario} onChange={e => { setUsuario(e.target.value); setError(false) }} autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <div className="field-label">Contraseña</div>
          <input className="input" type="password" value={password} onChange={e => { setPassword(e.target.value); setError(false) }} autoComplete="current-password" />
        </div>
        {error && <div className="t-red" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{usaEmail ? 'Email o contraseña incorrectos.' : 'Usuario o contraseña incorrectos.'}</div>}
        <button className="btn cyan" type="submit" disabled={cargando} style={{ width: '100%', justifyContent: 'center', padding: 10 }}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        <div className="text-3" style={{ fontSize: 11, marginTop: 14, textAlign: 'center' }}>Gestiona los accesos desde "Equipo" en el menú lateral.</div>
      </form>
    </div>
  )
}

const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #15171C 0%, #0C0D10 100%)' }
