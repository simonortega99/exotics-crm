import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useAuth } from '../lib/auth.jsx'
import { ENTREGA_CHECKLIST, fmtDate, today, addDays, isOverdue, picoPlacaRestringido, uid } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, Kebab } from '../components/ui.jsx'
import { toast } from '../components/feedback.jsx'
import { calCrearEntrega, calActualizarEntrega, calEliminarEntrega } from '../lib/calendar.js'

const ESTADO_TONE = { 'En proceso': 'amber', 'Entregado': 'green' }
const TOTAL = ENTREGA_CHECKLIST.length

export default function Entregas() {
  const { data, addItem, updateItem, deleteItem, restoreItem } = useStore()
  const { user, isAdmin } = useAuth()
  const [prog, setProg] = useState(null)      // entrega a programar
  const [actModal, setActModal] = useState(null) // { entrega, actividad? }
  const [filtro, setFiltro] = useState('proceso') // proceso | entregadas | todas

  const picoPlaca = data.picoPlaca || {}
  const todas = (data.entregas || []).filter(e => isAdmin || e.owner === user.nombre)
  const enProceso = todas.filter(e => e.estado !== 'Entregado')
  const entregadas = todas.filter(e => e.estado === 'Entregado')
  const lista = filtro === 'entregadas' ? entregadas : filtro === 'todas' ? todas : enProceso
  // Ordena: en proceso primero, luego por fecha de entrega / venta más reciente.
  const ordenada = [...lista].sort((a, b) => (b.entregaFecha || b.fechaVenta || '').localeCompare(a.entregaFecha || a.fechaVenta || ''))

  const hechas = e => ENTREGA_CHECKLIST.filter(i => e.checklist?.[i.key]).length

  function toggle(e, key) {
    const checklist = { ...(e.checklist || {}), [key]: !e.checklist?.[key] }
    const updates = { checklist }
    if (key === 'entregado') updates.estado = checklist.entregado ? 'Entregado' : 'En proceso'
    updateItem('entregas', e.id, updates)
  }

  function guardarProgramacion(e, f) {
    const guests = [(data.equipo || []).find(x => x.nombre === e.owner)?.email, data.leads.find(l => l.id === e.clienteId)?.email].filter(Boolean)
    const checklist = { ...(e.checklist || {}), programada: true }
    const titulo = `Entrega: ${e.cliente || e.vehiculo || 'vehículo'}`
    if (e.actId && e.calKey) {
      updateItem('actividades', e.actId, { fecha: f.fecha, titulo, lead: e.cliente, vehiculo: e.vehiculo })
      updateItem('entregas', e.id, { entregaFecha: f.fecha, entregaHora: f.hora, entregaLugar: f.lugar, checklist })
      calActualizarEntrega({ ...e, entregaFecha: f.fecha, entregaHora: f.hora, entregaLugar: f.lugar }, e.entregaFecha, guests)
    } else {
      const calKey = uid()
      const act = addItem('actividades', { titulo, fecha: f.fecha, tipo: 'Entrega', owner: e.owner || '', lead: e.cliente || '', vehiculo: e.vehiculo || '', entregaId: e.id, done: false })
      updateItem('entregas', e.id, { entregaFecha: f.fecha, entregaHora: f.hora, entregaLugar: f.lugar, checklist, calKey, actId: act.id })
      calCrearEntrega({ ...e, entregaFecha: f.fecha, entregaHora: f.hora, entregaLugar: f.lugar, calKey }, guests)
    }
    setProg(null)
    toast('Entrega programada · visible en Actividades')
  }

  function eliminar(e) {
    const act = e.actId ? (data.actividades || []).find(a => a.id === e.actId) : null
    deleteItem('entregas', e.id)
    if (e.actId) deleteItem('actividades', e.actId)
    calEliminarEntrega(e)
    toast('Entrega eliminada', 'info', { label: 'Deshacer', fn: () => { restoreItem('entregas', e); if (act) restoreItem('actividades', act) } })
  }

  // Actividades adicionales de la entrega (excluye la de la programación, que se
  // gestiona con "Reprogramar" para mantener sincronizado Google Calendar).
  const actividadesDe = e => (data.actividades || [])
    .filter(a => a.entregaId === e.id && a.id !== e.actId)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))

  function guardarActividad(f) {
    const { entrega, actividad } = actModal
    if (actividad) {
      updateItem('actividades', actividad.id, { titulo: f.titulo, fecha: f.fecha })
    } else {
      addItem('actividades', { titulo: f.titulo, fecha: f.fecha, tipo: 'Entrega', owner: entrega.owner || '', lead: entrega.cliente || '', vehiculo: entrega.vehiculo || '', entregaId: entrega.id, done: false })
    }
    setActModal(null)
    toast(actividad ? 'Actividad actualizada' : 'Actividad agregada · visible en Actividades')
  }
  function eliminarActividad(a) {
    deleteItem('actividades', a.id)
    toast('Actividad eliminada', 'info', { label: 'Deshacer', fn: () => restoreItem('actividades', a) })
  }
  function marcarEntregado(e) {
    const entregado = !(e.checklist?.entregado)
    updateItem('entregas', e.id, { checklist: { ...(e.checklist || {}), entregado }, estado: entregado ? 'Entregado' : 'En proceso' })
  }

  return (
    <>
      <Topbar title="Entregas" sub="Checklist y programación de entrega de cada venta">
        <div className="seg">
          <button className={filtro === 'proceso' ? 'on' : ''} onClick={() => setFiltro('proceso')}>En proceso ({enProceso.length})</button>
          <button className={filtro === 'entregadas' ? 'on' : ''} onClick={() => setFiltro('entregadas')}>Entregadas ({entregadas.length})</button>
          <button className={filtro === 'todas' ? 'on' : ''} onClick={() => setFiltro('todas')}>Todas</button>
        </div>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="En proceso" value={enProceso.length} accent="amber" />
          <Kpi label="Entregadas" value={entregadas.length} accent="green" />
          <Kpi label="Programadas" value={enProceso.filter(e => e.entregaFecha).length} accent="cyan" />
        </div>

        {ordenada.map(e => {
          const pct = Math.round((hechas(e) / TOTAL) * 100)
          const pp = e.entregaFecha && picoPlacaRestringido(e.placa, e.motor, e.entregaFecha, picoPlaca)
          return (
            <div key={e.id} className="card mb-16">
              <div className="row between mb-12" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="cell-strong" style={{ fontSize: 14 }}>{e.vehiculo || 'Vehículo'}{e.placa ? ` · ${e.placa}` : ''}</div>
                  <div className="text-3" style={{ fontSize: 12 }}>{e.cliente || 'Cliente'} · {e.owner || '—'} · venta {e.fechaVenta ? fmtDate(e.fechaVenta) : '—'}</div>
                </div>
                <div className="row gap-8" style={{ flexShrink: 0 }}>
                  <Badge tone={ESTADO_TONE[e.estado] || 'gray'} dot>{e.estado || 'En proceso'}</Badge>
                  <Kebab items={[{ label: 'Eliminar', danger: true, onClick: () => eliminar(e) }]} />
                </div>
              </div>

              <div className="row between mb-8" style={{ fontSize: 11 }}>
                <span className="text-3">{hechas(e)} de {TOTAL} pasos</span>
                <span className="text-3">{pct}%</span>
              </div>
              <div className="progress mb-12"><span style={{ width: pct + '%' }} /></div>

              <div className="split even">
                {ENTREGA_CHECKLIST.map(item => {
                  const on = !!e.checklist?.[item.key]
                  return (
                    <label key={item.key} className="row gap-8" style={{ fontSize: 12.5, padding: '5px 0', cursor: 'pointer', alignItems: 'center' }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(e, item.key)} />
                      <span style={{ textDecoration: on ? 'line-through' : 'none', color: on ? 'var(--text-3)' : 'var(--text)' }}>{item.label}</span>
                    </label>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <div className="row between mb-8" style={{ alignItems: 'center' }}>
                  <span className="overline">Actividades</span>
                  <button className="btn sm" onClick={() => setActModal({ entrega: e })}>+ Agregar actividad</button>
                </div>
                {actividadesDe(e).map(a => (
                  <div key={a.id} className="row gap-8" style={{ padding: '5px 0', fontSize: 12.5, alignItems: 'center' }}>
                    <input type="checkbox" checked={!!a.done} onChange={() => updateItem('actividades', a.id, { done: !a.done })} />
                    <span style={{ flex: 1, minWidth: 0, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-3)' : 'var(--text)' }}>
                      {a.titulo} <span className={isOverdue(a.fecha) && !a.done ? 't-red' : 'text-3'}>· {fmtDate(a.fecha)}</span>
                    </span>
                    <button className="btn ghost sm" onClick={() => setActModal({ entrega: e, actividad: a })}>Editar</button>
                    <button className="btn danger sm" onClick={() => eliminarActividad(a)}>×</button>
                  </div>
                ))}
                {!actividadesDe(e).length && <div className="text-3" style={{ fontSize: 12 }}>Sin actividades. Agrega recordatorios o tareas de la entrega.</div>}
              </div>

              <div className="row between mt-12 wrap gap-8" style={{ alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <div className="text-2" style={{ fontSize: 12.5 }}>
                  {e.entregaFecha
                    ? <>Entrega: <b>{fmtDate(e.entregaFecha)}{e.entregaHora ? ` · ${e.entregaHora}` : ''}</b>{e.entregaLugar ? ` · ${e.entregaLugar}` : ''} {pp && <Badge tone="red">pico y placa</Badge>}</>
                    : <span className="text-3">Sin programar</span>}
                </div>
                <div className="row gap-6 wrap">
                  <button className="btn cyan sm" onClick={() => setProg(e)}>{e.entregaFecha ? 'Reprogramar' : 'Programar entrega'}</button>
                  <button className={e.checklist?.entregado ? 'btn sm' : 'btn primary sm'} onClick={() => marcarEntregado(e)}>{e.checklist?.entregado ? 'Reabrir' : '✓ Marcar entregado'}</button>
                </div>
              </div>
            </div>
          )
        })}
        {!ordenada.length && (
          <div className="table-wrap"><table className="data"><tbody>
            <EmptyRow colSpan={1}><div className="big">Sin entregas {filtro === 'entregadas' ? 'completadas' : 'en proceso'}</div>Las entregas se crean automáticamente al registrar una venta.</EmptyRow>
          </tbody></table></div>
        )}
      </Page>

      {prog && <ProgramarModal entrega={prog} picoPlaca={picoPlaca} onSave={guardarProgramacion} onClose={() => setProg(null)} />}
      {actModal && <ActividadModal entrega={actModal.entrega} actividad={actModal.actividad} onSave={guardarActividad} onClose={() => setActModal(null)} />}
    </>
  )
}

function ActividadModal({ entrega, actividad, onSave, onClose }) {
  const [f, setF] = useState({ titulo: actividad?.titulo || '', fecha: actividad?.fecha || today() })
  return (
    <Modal title={actividad ? 'Editar actividad' : `Nueva actividad · ${entrega.cliente || entrega.vehiculo || ''}`} onClose={onClose} width={400}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(f)} disabled={!f.titulo.trim()} saveLabel={actividad ? 'Guardar' : 'Agregar'} />}>
      <Field label="Actividad"><input className="input" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ej. Llamar para confirmar entrega" autoFocus /></Field>
      <Field label="Fecha">
        <div className="row gap-6">
          <input className="input" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} />
          {[1, 3, 7].map(n => <button key={n} className="btn sm" onClick={() => setF({ ...f, fecha: addDays(n) })}>+{n}d</button>)}
        </div>
      </Field>
    </Modal>
  )
}

function ProgramarModal({ entrega, picoPlaca, onSave, onClose }) {
  const [f, setF] = useState({ fecha: entrega.entregaFecha || today(), hora: entrega.entregaHora || '', lugar: entrega.entregaLugar || '' })
  const pp = picoPlacaRestringido(entrega.placa, entrega.motor, f.fecha, picoPlaca)
  return (
    <Modal title="Programar entrega" onClose={onClose} width={420}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(entrega, f)} saveLabel="Programar" />}>
      <div className="text-3 mb-12" style={{ fontSize: 12 }}>Vehículo: <b>{entrega.vehiculo || '—'}</b>{entrega.placa ? ` · ${entrega.placa}` : ''} · Cliente: <b>{entrega.cliente || '—'}</b></div>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
        <Field label="Hora"><input className="input" type="time" value={f.hora} onChange={e => setF({ ...f, hora: e.target.value })} /></Field>
      </div>
      {entrega.placa && (
        <div className="card" style={{ background: pp ? 'var(--red-soft)' : 'var(--green-soft)', boxShadow: 'none', padding: '9px 12px', margin: '4px 0 12px', fontSize: 12.5, fontWeight: 600, color: pp ? 'var(--red)' : 'var(--green)' }}>
          {pp ? `⚠️ Pico y placa ese día (${entrega.placa}). Considera otra fecha.` : 'Sin pico y placa ese día ✓'}
        </div>
      )}
      <Field label="Lugar"><input className="input" value={f.lugar} onChange={e => setF({ ...f, lugar: e.target.value })} placeholder="Ej. Vitrina, domicilio…" /></Field>
      <div className="text-3" style={{ fontSize: 11, marginTop: 6 }}>Se agenda en Actividades y en Google Calendar (con recordatorio e invitación), igual que una cita.</div>
    </Modal>
  )
}
