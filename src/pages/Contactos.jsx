import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtDate, today, addDays, cumpleInfo, ROLES, ASESORES, THERMO_TONE, exportarHojaXls } from '../lib/utils.js'
import { Topbar, Page, Field, Modal, ModalButtons, Badge, EmptyRow, VehiculoInteresSelect } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'
import { Download } from 'lucide-react'

const THERMO = THERMO_TONE
const ROL_TONE = { lead: 'cyan', cliente: 'green', consignante: 'violet', aliado: 'amber' }
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export default function Contactos() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [rolFilter, setRolFilter] = useState('todos')
  const [ownerFilter, setOwnerFilter] = useState('todos')
  const { user, isAdmin } = useAuth()
  const asesores = data.asesores || ASESORES
  const ownerOptions = isAdmin ? asesores : [user.nombre]
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState('')

  const visibleLeads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const lead = data.leads.find(l => l.id === selected)
  const invActivo = data.inventario.filter(v => v.estado !== 'Vendido')
  const tareas = useMemo(
    () => data.actividades.filter(a => a.leadId === selected).sort((a, b) => (a.fecha > b.fecha ? 1 : -1)),
    [data.actividades, selected]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visibleLeads.filter(l =>
      (rolFilter === 'todos' || (l.rol || 'lead') === rolFilter) &&
      (ownerFilter === 'todos' || l.owner === ownerFilter) &&
      (!q || `${l.nombre} ${l.tel || ''} ${l.email || ''}`.toLowerCase().includes(q))
    )
  }, [visibleLeads, query, rolFilter, ownerFilter])

  function handleAddLead(form) {
    addItem('leads', { ...form, fechaCreacion: today() })
    setShowForm(false)
    toast('Contacto agregado')
  }
  function addTask() {
    if (!taskTitle || !taskDate || !lead) return
    addItem('actividades', { titulo: taskTitle, fecha: taskDate, tipo: 'Seguimiento', owner: lead.owner || 'Simón', lead: lead.nombre, leadId: lead.id, done: false })
    setTaskTitle(''); setTaskDate('')
    toast('Tarea agregada a la agenda')
  }
  function exportar() {
    const headers = ['Nombre', 'Rol', 'Teléfono', 'Email', 'Temperatura', 'Vehículo de interés', 'Vehículo propiedad', 'En consignación', 'Cumpleaños', 'Asesor', 'Creado', 'Nota']
    const rows = filtered.map(l => [l.nombre, l.rol, l.tel, l.email, l.thermo, l.vehiculoInteres, l.vehiculoPropio, l.vehiculoConsignado, l.cumple, l.owner, l.fechaCreacion, l.nota])
    exportarHojaXls(`Contactos_${today()}.xls`, 'Contactos · Exotics Co.', headers, rows)
    toast('Contactos exportados')
  }
  function crearOportunidad() {
    addItem('oportunidades', {
      contactoId: lead.id, contacto: lead.nombre,
      vehiculoInteres: lead.vehiculoInteres || '', vehiculoId: lead.vehiculoId || '',
      valor: '', stage: 0, estado: 'Abierta', financiacion: false, owner: lead.owner || 'Simón', fecha: today(),
    })
    toast('Oportunidad creada · míralá en Oportunidades')
  }

  const esLead = (lead?.rol || 'lead') === 'lead'

  return (
    <>
      <Topbar title="Contactos" sub={`${visibleLeads.length} personas en tu directorio`}>
        <button className="btn" onClick={exportar}><Download size={14} /> Exportar</button>
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Nuevo contacto</button>
      </Topbar>
      <Page>
        <div className="filters">
          <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar por nombre, teléfono o email…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="seg">
            {['todos', ...ROLES].map(r => (
              <button key={r} className={rolFilter === r ? 'on' : ''} onClick={() => setRolFilter(r)}>{r === 'todos' ? 'Todos' : cap(r)}</button>
            ))}
          </div>
          {isAdmin && (
            <select className="select" style={{ width: 150 }} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
              <option value="todos">Todos los asesores</option>
              {asesores.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{['Nombre', 'Rol', 'Teléfono', 'Temperatura', 'Vehículo de interés', 'Cumpleaños', 'Creado', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const ci = cumpleInfo(l.cumple)
                return (
                  <tr key={l.id} className="clickable" onClick={() => setSelected(l.id)}>
                    <td className="cell-strong">{l.nombre}</td>
                    <td><Badge tone={ROL_TONE[l.rol] || 'gray'}>{cap(l.rol || 'lead')}</Badge></td>
                    <td className="num">{l.tel || <span className="muted">—</span>}</td>
                    <td>{(l.rol || 'lead') === 'lead' ? <Badge tone={THERMO[l.thermo] || 'gray'} dot>{cap(l.thermo || 'frío')}</Badge> : <span className="muted">—</span>}</td>
                    <td>{l.vehiculoInteres ? <Badge tone="cyan">{l.vehiculoInteres}</Badge> : <span className="muted">—</span>}</td>
                    <td>{l.cumple ? <span>{fmtDate(l.cumple)} {ci && ci.diff <= 7 && <Badge tone="amber">🎂 {ci.diff === 0 ? 'hoy' : `en ${ci.diff}d`}</Badge>}</span> : <span className="muted">—</span>}</td>
                    <td className="num text-2">{l.fechaCreacion ? fmtDate(l.fechaCreacion) : '—'}</td>
                    <td className="text-3">→</td>
                  </tr>
                )
              })}
              {!filtered.length && <EmptyRow colSpan={8}><div className="big">Sin contactos</div>Agrega tu primer contacto para empezar.</EmptyRow>}
            </tbody>
          </table>
        </div>

        {lead && (
          <div className="card flush mt-16">
            <div style={{ padding: '14px 18px', background: 'var(--ink)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{lead.nombre}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{lead.tel} {lead.email ? '· ' + lead.email : ''}</div>
              </div>
              <div className="row gap-8">
                <button className="btn cyan sm" onClick={crearOportunidad}>+ Oportunidad</button>
                <button className="btn ghost sm" style={{ color: '#fff' }} onClick={() => confirmDelete(`a ${lead.nombre}`, () => { deleteItem('leads', lead.id); setSelected(null) })}>Eliminar</button>
                <button className="btn sm" onClick={() => setSelected(null)}>Cerrar</button>
              </div>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <div className="overline mb-12">Datos del contacto</div>
                <Field label="Rol">
                  <select className="select" value={lead.rol || 'lead'} onChange={e => updateItem('leads', lead.id, { rol: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{cap(r)}</option>)}
                  </select>
                </Field>
                {esLead && (
                  <Field label="Temperatura">
                    <select className="select" value={lead.thermo || 'frio'} onChange={e => updateItem('leads', lead.id, { thermo: e.target.value })}>
                      <option value="frio">Frío</option><option value="tibio">Tibio</option><option value="caliente">Caliente</option>
                    </select>
                  </Field>
                )}
                <Field label="Vehículo de interés">
                  <VehiculoInteresSelect inventario={invActivo} value={{ vehiculoId: lead.vehiculoId || '', vehiculoInteres: lead.vehiculoInteres || '' }}
                    onChange={({ vehiculoId, vehiculoInteres }) => updateItem('leads', lead.id, { vehiculoId, vehiculoInteres })} />
                </Field>
                {['lead', 'cliente'].includes(lead.rol || 'lead') && (
                  <Field label="Vehículo de su propiedad">
                    <input className="input" value={lead.vehiculoPropio || ''} onChange={e => updateItem('leads', lead.id, { vehiculoPropio: e.target.value })} placeholder="Ej. Mazda CX-5 2020" />
                  </Field>
                )}
                {lead.rol === 'consignante' && (
                  <Field label="Vehículo en consignación (de su propiedad)">
                    <VehiculoInteresSelect inventario={invActivo} value={{ vehiculoId: lead.vehiculoConsignadoId || '', vehiculoInteres: lead.vehiculoConsignado || '' }}
                      onChange={({ vehiculoId, vehiculoInteres }) => updateItem('leads', lead.id, { vehiculoConsignadoId: vehiculoId, vehiculoConsignado: vehiculoInteres })} />
                  </Field>
                )}
                <Field label="Cumpleaños">
                  <input className="input" type="date" value={lead.cumple || ''} onChange={e => updateItem('leads', lead.id, { cumple: e.target.value })} />
                </Field>
                <Field label="Nota / observación">
                  <textarea className="input" rows={3} value={lead.nota || ''} onChange={e => updateItem('leads', lead.id, { nota: e.target.value })} placeholder="Notas internas sobre el contacto…" />
                </Field>
              </div>
              <div>
                <div className="overline mb-12">Tareas de seguimiento</div>
                {tareas.map(a => (
                  <div key={a.id} className="row gap-8" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!a.done} onChange={() => updateItem('actividades', a.id, { done: !a.done })} />
                    <div style={{ flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-3)' : 'var(--text)' }}>
                      {a.titulo} <span className="text-3">· {fmtDate(a.fecha)}</span>
                    </div>
                    <button className="btn danger sm" onClick={() => deleteItem('actividades', a.id)}>×</button>
                  </div>
                ))}
                {!tareas.length && <div className="text-3" style={{ fontSize: 12, padding: '4px 0' }}>Sin tareas. Aparecerán también en Actividades.</div>}
                <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <input className="input" placeholder="Nueva tarea…" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                  <div className="row gap-6">
                    <input className="input" type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} />
                    {[1, 3, 7, 14].map(n => <button key={n} className="btn sm" onClick={() => setTaskDate(addDays(n))}>+{n}d</button>)}
                  </div>
                  <button className="btn primary" onClick={addTask}>+ Agregar tarea</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Page>

      {showForm && <LeadForm inventario={invActivo} asesores={ownerOptions} onSave={handleAddLead} onClose={() => setShowForm(false)} />}
    </>
  )
}

function LeadForm({ inventario, asesores, onSave, onClose }) {
  const [form, setForm] = useState({ nombre: '', tel: '', email: '', cumple: '', rol: 'lead', owner: asesores[0] || 'Simón', thermo: 'frio', stage: 0, vehiculoId: '', vehiculoInteres: '', vehiculoPropio: '', vehiculoConsignadoId: '', vehiculoConsignado: '', nota: '' })
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <Modal title="Nuevo contacto" onClose={onClose} width={440}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.nombre.trim()} />}>
      <Field label="Nombre"><input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus /></Field>
      <div className="form-grid cols-2">
        <Field label="Teléfono"><input className="input" value={form.tel} onChange={e => set('tel', e.target.value)} /></Field>
        <Field label="Email"><input className="input" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Cumpleaños"><input className="input" type="date" value={form.cumple} onChange={e => set('cumple', e.target.value)} /></Field>
        <Field label="Owner">
          <select className="select" value={form.owner} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Rol">
          <select className="select" value={form.rol} onChange={e => set('rol', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{cap(r)}</option>)}</select>
        </Field>
        {form.rol === 'lead' && (
          <Field label="Temperatura">
            <select className="select" value={form.thermo} onChange={e => set('thermo', e.target.value)}>
              <option value="frio">Frío</option><option value="tibio">Tibio</option><option value="caliente">Caliente</option>
            </select>
          </Field>
        )}
      </div>
      <Field label="Vehículo de interés">
        <VehiculoInteresSelect inventario={inventario} value={{ vehiculoId: form.vehiculoId, vehiculoInteres: form.vehiculoInteres }}
          onChange={({ vehiculoId, vehiculoInteres }) => setForm({ ...form, vehiculoId, vehiculoInteres })} />
      </Field>
      {['lead', 'cliente'].includes(form.rol) && (
        <Field label="Vehículo de su propiedad">
          <input className="input" value={form.vehiculoPropio} onChange={e => set('vehiculoPropio', e.target.value)} placeholder="Opcional · ej. Mazda CX-5 2020" />
        </Field>
      )}
      {form.rol === 'consignante' && (
        <Field label="Vehículo en consignación (de su propiedad)">
          <VehiculoInteresSelect inventario={inventario} value={{ vehiculoId: form.vehiculoConsignadoId, vehiculoInteres: form.vehiculoConsignado }}
            onChange={({ vehiculoId, vehiculoInteres }) => setForm({ ...form, vehiculoConsignadoId: vehiculoId, vehiculoConsignado: vehiculoInteres })} />
        </Field>
      )}
      <Field label="Nota / observación">
        <textarea className="input" rows={2} value={form.nota} onChange={e => set('nota', e.target.value)} placeholder="Opcional" />
      </Field>
    </Modal>
  )
}
