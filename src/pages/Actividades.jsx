import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtDate, today, isOverdue, inRange, weekRange, ASESORES } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, Kebab } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'
import { ArrowUpDown } from 'lucide-react'

const TIPOS = ['Llamada', 'WhatsApp', 'Visita', 'Email', 'Seguimiento', 'Fidelización', 'Otro']
// Color por tipo de actividad
const TIPO_TONE = { Fidelización: 'violet', Seguimiento: 'cyan', Llamada: 'gray', WhatsApp: 'green', Visita: 'amber', Email: 'gray', Otro: 'gray' }
const calTone = a => a.done ? 'done' : (TIPO_TONE[a.tipo] || 'cyan')

export default function Actividades() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [vista, setVista] = useState('lista')
  const [verHechas, setVerHechas] = useState(false)
  const [orden, setOrden] = useState('asc') // asc | desc
  const [ownerFilter, setOwnerFilter] = useState('todos')
  const [filtro, setFiltro] = useState('hoy') // hoy | semana | vencidas | todas
  const [selDay, setSelDay] = useState(today())
  const [formDate, setFormDate] = useState(today())
  const [leaving, setLeaving] = useState(() => new Set())
  const { user, isAdmin } = useAuth()
  const asesores = data.asesores || ASESORES
  const ownerOptions = isAdmin ? asesores : [user.nombre]

  // Marca como hecha: se tacha y se va con una breve animación antes de salir de la lista.
  function toggle(a) {
    const willDone = !a.done
    updateItem('actividades', a.id, { done: willDone })
    if (willDone && !verHechas) {
      setLeaving(s => new Set(s).add(a.id))
      setTimeout(() => setLeaving(s => { const n = new Set(s); n.delete(a.id); return n }), 650)
    }
  }

  const scoped = isAdmin ? (data.actividades || []) : (data.actividades || []).filter(a => a.owner === user.nombre)
  const base = scoped.filter(a => ownerFilter === 'todos' || a.owner === ownerFilter)
  const ordenadas = [...base].sort((a, b) => (orden === 'asc' ? (a.fecha > b.fecha ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1)))

  const [wkStart, wkEnd] = weekRange()
  const matchFiltro = a => filtro === 'hoy' ? a.fecha === today()
    : filtro === 'semana' ? inRange(a.fecha, wkStart, wkEnd)
    : filtro === 'vencidas' ? isOverdue(a.fecha)
    : true
  const filtradas = ordenadas.filter(matchFiltro)
  const lista = verHechas ? filtradas : filtradas.filter(a => !a.done || leaving.has(a.id))

  const hoy = base.filter(a => a.fecha === today() && !a.done).length
  const semana = base.filter(a => inRange(a.fecha, wkStart, wkEnd) && !a.done).length
  const vencidas = base.filter(a => !a.done && isOverdue(a.fecha)).length
  const pendientes = base.filter(a => !a.done).length
  const events = base.map(a => ({ id: a.id, date: a.fecha, label: a.titulo, tone: calTone(a) }))
  const delDia = base.filter(a => a.fecha === selDay)

  const pick = f => { setFiltro(f); setVista('lista') }
  function openForm(date) { setFormDate(date || today()); setShowForm(true) }
  function save(f) { addItem('actividades', { ...f, done: false }); setShowForm(false); toast('Actividad creada') }

  return (
    <>
      <Topbar title="Actividades" sub="Agenda de seguimiento del equipo">
        <button className="btn cyan" onClick={() => openForm(vista === 'calendario' ? selDay : today())}>+ Nueva actividad</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="Para hoy" value={hoy} accent="cyan" onClick={() => pick('hoy')} active={filtro === 'hoy'} />
          <Kpi label="Esta semana" value={semana} accent="amber" onClick={() => pick('semana')} active={filtro === 'semana'} />
          <Kpi label="Vencidas" value={vencidas} accent="amber" valueClass={vencidas ? 'red' : ''} onClick={() => pick('vencidas')} active={filtro === 'vencidas'} />
          <Kpi label="Pendientes (todas)" value={pendientes} accent="ink" onClick={() => pick('todas')} active={filtro === 'todas'} />
        </div>

        <div className="filters">
          <div className="seg">
            <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}>Lista</button>
            <button className={vista === 'calendario' ? 'on' : ''} onClick={() => setVista('calendario')}>Calendario</button>
          </div>
          {isAdmin && (
            <select className="select" style={{ width: 150 }} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
              <option value="todos">Todos los asesores</option>
              {asesores.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {vista === 'lista' && <>
            <button className="btn" onClick={() => setOrden(o => o === 'asc' ? 'desc' : 'asc')}>
              <ArrowUpDown size={14} /> Fecha {orden === 'asc' ? '↑' : '↓'}
            </button>
            <label className="row gap-6 text-2" style={{ fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={verHechas} onChange={e => setVerHechas(e.target.checked)} /> Mostrar completadas
            </label>
          </>}
          <span className="text-3 row gap-12" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
            <span><span className="badge cyan" style={{ padding: '1px 6px' }}>•</span> Seguimiento</span>
            <span><span className="badge violet" style={{ padding: '1px 6px' }}>•</span> Fidelización</span>
          </span>
        </div>

        {vista === 'calendario' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div className="card"><Calendar events={events} selectedDate={selDay} onSelectDay={setSelDay} onEventClick={id => updateItem('actividades', id, { done: !base.find(a => a.id === id)?.done })} /></div>
            <div className="card" style={{ alignSelf: 'start' }}>
              <div className="row between mb-12">
                <span className="section-title" style={{ fontSize: 14 }}>{fmtDate(selDay)}</span>
                <button className="btn cyan sm" onClick={() => openForm(selDay)}>+ Actividad</button>
              </div>
              {delDia.map(a => (
                <div key={a.id} className="row gap-8" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                  <input type="checkbox" checked={!!a.done} onChange={() => updateItem('actividades', a.id, { done: !a.done })} />
                  <div style={{ flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-3)' : 'var(--text)' }}>
                    {a.titulo} <Badge tone={TIPO_TONE[a.tipo] || 'gray'}>{a.tipo}</Badge>
                  </div>
                  <button className="btn danger sm" onClick={() => confirmDelete('la actividad', () => deleteItem('actividades', a.id))}>×</button>
                </div>
              ))}
              {!delDia.length && <div className="text-3" style={{ fontSize: 12.5, padding: '6px 0' }}>Sin actividades este día.</div>}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>{['', 'Fecha', 'Título', 'Tipo', 'Relacionado', 'Asesor', ''].map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {lista.map(a => {
                  const overdue = !a.done && isOverdue(a.fecha)
                  const isLeaving = leaving.has(a.id)
                  return (
                    <tr key={a.id} style={{
                      ...(a.fecha === today() && !a.done ? { background: 'var(--cyan-soft)' } : {}),
                      ...(isLeaving ? { opacity: 0, transition: 'opacity .55s ease' } : {}),
                    }}>
                      <td><input type="checkbox" checked={!!a.done} onChange={() => toggle(a)} /></td>
                      <td className="num">{fmtDate(a.fecha)} {overdue && <Badge tone="red">vencida</Badge>}</td>
                      <td className="cell-strong" style={a.done ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}>{a.titulo}</td>
                      <td><Badge tone={TIPO_TONE[a.tipo] || 'gray'} dot>{a.tipo}</Badge></td>
                      <td className="text-2">{a.lead || '—'}</td>
                      <td className="text-2">{a.owner || '—'}</td>
                      <td>
                        <Kebab items={[
                          { label: 'Editar', onClick: () => setEditing(a) },
                          { label: 'Eliminar', danger: true, onClick: () => confirmDelete('la actividad', () => deleteItem('actividades', a.id)) },
                        ]} />
                      </td>
                    </tr>
                  )
                })}
                {!lista.length && <EmptyRow colSpan={7}><div className="big">Todo al día</div>No hay actividades pendientes.</EmptyRow>}
              </tbody>
            </table>
          </div>
        )}
      </Page>

      {showForm && <ActividadForm leads={isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)} asesores={ownerOptions} initial={{ fecha: formDate }} onSave={save} onClose={() => setShowForm(false)} />}
      {editing && <ActividadForm leads={isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)} asesores={ownerOptions} initial={editing}
        onSave={f => { updateItem('actividades', editing.id, f); setEditing(null); toast('Actividad actualizada') }} onClose={() => setEditing(null)} />}
    </>
  )
}

function ActividadForm({ leads, asesores, initial, onSave, onClose }) {
  const editMode = !!initial?.id
  const [form, setForm] = useState({
    titulo: initial?.titulo || '', fecha: initial?.fecha || today(), tipo: initial?.tipo || 'Llamada',
    owner: initial?.owner || asesores[0] || 'Simón', lead: initial?.lead || '', leadId: initial?.leadId, cliente: initial?.cliente,
  })
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <Modal title={editMode ? 'Editar actividad' : 'Nueva actividad'} onClose={onClose} width={420}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.titulo.trim()} saveLabel={editMode ? 'Guardar cambios' : 'Guardar'} />}>
      <Field label="Título"><input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} autoFocus /></Field>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
        <Field label="Tipo">
          <select className="select" value={form.tipo} onChange={e => set('tipo', e.target.value)}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Asesor">
          <select className="select" value={form.owner} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
        <Field label="Contacto relacionado">
          <select className="select" value={form.lead} onChange={e => set('lead', e.target.value)}>
            <option value="">— Ninguno —</option>
            {leads.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
