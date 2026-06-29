import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, Target, Filter, Car, ArrowLeftRight,
  Search, Receipt, Heart, UsersRound, LogOut, X, Plus,
} from 'lucide-react'
import { useStore } from '../lib/store.jsx'
import { useAuth } from '../lib/auth.jsx'
import { uid } from '../lib/utils.js'
import { Modal, BrandMark } from './ui.jsx'
import { toast, confirmDelete } from './feedback.jsx'

const NAV = [
  { section: 'Principal', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/actividades', label: 'Actividades', icon: Calendar, badge: 'act' },
    { to: '/contactos', label: 'Contactos', icon: Users },
    { to: '/oportunidades', label: 'Oportunidades', icon: Target },
    { to: '/funnel', label: 'Funnel', icon: Filter },
  ]},
  { section: 'Operaciones', items: [
    { to: '/inventario', label: 'Inventario', icon: Car },
    { to: '/retomas', label: 'Retomas', icon: ArrowLeftRight },
    { to: '/busquedas', label: 'Búsquedas', icon: Search },
    { to: '/ventas', label: 'Ventas', icon: Receipt },
  ]},
  { section: 'Relación', items: [
    { to: '/fidelizacion', label: 'Fidelización', icon: Heart, badge: 'fid' },
  ]},
]

const loadIds = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const saveIds = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* noop */ } }

export default function Sidebar() {
  const { data } = useStore()
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const [showTeam, setShowTeam] = useState(false)

  // "Pendientes por revisar": actividades / fidelización nuevas que no has abierto.
  // El punto se limpia del todo al entrar al módulo.
  const actIds = (data.actividades || []).map(a => a.id)
  const fidIds = (data.actividades || []).filter(a => a.tipo === 'Fidelización').map(a => a.id)
  const [seenAct, setSeenAct] = useState(() => loadIds('exotics_seen_act'))
  const [seenFid, setSeenFid] = useState(() => loadIds('exotics_seen_fid'))

  // Inicializa (primera vez todo cuenta como visto, para no marcar lo viejo como nuevo)
  useEffect(() => {
    if (seenAct === null) { setSeenAct(actIds); saveIds('exotics_seen_act', actIds) }
    if (seenFid === null) { setSeenFid(fidIds); saveIds('exotics_seen_fid', fidIds) }
  }, []) // eslint-disable-line

  // Al entrar al módulo, marca todo como visto (limpia el punto)
  useEffect(() => {
    if (location.pathname === '/actividades') { setSeenAct(actIds); saveIds('exotics_seen_act', actIds) }
    if (location.pathname === '/fidelizacion') { setSeenFid(fidIds); saveIds('exotics_seen_fid', fidIds) }
  }, [location.pathname, data.actividades]) // eslint-disable-line

  const unseenAct = seenAct ? actIds.filter(id => !seenAct.includes(id)).length : 0
  const unseenFid = seenFid ? fidIds.filter(id => !seenFid.includes(id)).length : 0
  const badges = { act: { n: unseenAct, tone: '' }, fid: { n: unseenFid, tone: '' } }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BrandMark size={38} />
        <div>
          <div className="title">Exotics Co.</div>
          <div className="sub">CRM</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(({ to, label, icon: Icon, badge }) => {
              const b = badge ? badges[badge] : null
              return (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                  <Icon size={16} strokeWidth={2} />
                  <span className="nav-label">{label}</span>
                  {b && b.n > 0 && <span className={`nav-badge ${b.tone}`}>{b.n}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <div className="avatar">{(user?.nombre || '?').charAt(0)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nav-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{user?.nombre}</div>
            <div className="nav-label" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>@{user?.usuario}</div>
          </div>
          <button className="btn icon" title="Cerrar sesión" onClick={logout}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)' }}><LogOut size={15} /></button>
        </div>
        {isAdmin && (
          <button className="foot-btn" onClick={() => setShowTeam(true)}>
            <UsersRound size={15} /><span className="nav-label">Equipo</span>
            <span className="nav-badge">{(data.equipo || []).length}</span>
          </button>
        )}
      </div>

      {showTeam && isAdmin && <TeamModal onClose={() => setShowTeam(false)} />}
    </aside>
  )
}

function TeamModal({ onClose }) {
  const { data, setField } = useStore()
  const equipo = data.equipo || []
  const [nuevo, setNuevo] = useState({ nombre: '', usuario: '', password: '', rol: 'asesor' })

  const save = arr => { setField('equipo', arr); setField('asesores', arr.map(e => e.nombre)) }
  function add() {
    const n = nuevo.nombre.trim(), u = nuevo.usuario.trim().toLowerCase()
    if (!n || !u || !nuevo.password) { toast('Completa nombre, usuario y contraseña', 'error'); return }
    if (equipo.some(e => e.usuario.toLowerCase() === u)) { toast('Ese usuario ya existe', 'error'); return }
    save([...equipo, { id: uid(), nombre: n, usuario: u, password: nuevo.password, rol: nuevo.rol }])
    setNuevo({ nombre: '', usuario: '', password: '', rol: 'asesor' }); toast(`${n} agregado al equipo`)
  }
  function update(id, k, v) { save(equipo.map(e => e.id === id ? { ...e, [k]: v } : e)) }
  function remove(e) {
    if (equipo.filter(x => x.rol === 'admin').length <= 1 && e.rol === 'admin') { toast('Debe quedar al menos un admin', 'error'); return }
    confirmDelete(`a ${e.nombre} del equipo`, () => save(equipo.filter(x => x.id !== e.id)))
  }

  return (
    <Modal title="Equipo y accesos" onClose={onClose} width={480}
      footer={<button className="btn" onClick={onClose}>Cerrar</button>}>
      <div className="text-3 mb-12" style={{ fontSize: 12 }}>
        Cada persona entra con su usuario y contraseña. Los <b>admins</b> ven todo y gestionan el equipo; los <b>asesores</b> solo ven su propia información.
      </div>
      {equipo.map(e => (
        <div key={e.id} className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none', padding: 12, marginBottom: 10 }}>
          <div className="row between mb-12">
            <span className="cell-strong">{e.nombre} <span className={`badge ${e.rol === 'admin' ? 'cyan' : 'gray'}`}>{e.rol}</span></span>
            <button className="btn danger sm" onClick={() => remove(e)}><X size={13} /> Quitar</button>
          </div>
          <div className="form-grid cols-2">
            <div><div className="field-label">Nombre</div><input className="input" value={e.nombre} onChange={ev => update(e.id, 'nombre', ev.target.value)} /></div>
            <div><div className="field-label">Usuario</div><input className="input" value={e.usuario} onChange={ev => update(e.id, 'usuario', ev.target.value)} /></div>
            <div><div className="field-label">Contraseña</div><input className="input" value={e.password} onChange={ev => update(e.id, 'password', ev.target.value)} /></div>
            <div><div className="field-label">Rol</div>
              <select className="select" value={e.rol} onChange={ev => update(e.id, 'rol', ev.target.value)}>
                <option value="admin">Admin</option><option value="asesor">Asesor</option>
              </select>
            </div>
          </div>
        </div>
      ))}
      <div className="overline" style={{ margin: '14px 0 8px' }}>Nuevo usuario</div>
      <div className="form-grid cols-2">
        <input className="input" placeholder="Nombre" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input className="input" placeholder="Usuario" value={nuevo.usuario} onChange={e => setNuevo({ ...nuevo, usuario: e.target.value })} />
        <input className="input" placeholder="Contraseña" value={nuevo.password} onChange={e => setNuevo({ ...nuevo, password: e.target.value })} />
        <select className="select" value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}>
          <option value="asesor">Asesor</option><option value="admin">Admin</option>
        </select>
      </div>
      <button className="btn cyan mt-12" onClick={add}><Plus size={14} /> Agregar usuario</button>
    </Modal>
  )
}
