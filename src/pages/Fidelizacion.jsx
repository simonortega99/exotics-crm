import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtMoney, fmtMoneyShort, fmtDate, today, addDays, num, loyaltyTier, TIERS, cumpleInfo, uid } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'
import { Zap } from 'lucide-react'

const TIPOS_ACCION = ['Llamada de cortesía', 'Regalo / aniversario', 'Oferta exclusiva', 'Mantenimiento VIP', 'Encuesta de satisfacción', 'Referido', 'Otro']
// Las acciones de fidelización se guardan en la colección `actividades`
// (tipo 'Fidelización') para que aparezcan también en el módulo Actividades.

export default function Fidelizacion() {
  const { data, addItem, updateItem, deleteItem, setField } = useStore()
  const tipos = (data.fidelidadTipos && data.fidelidadTipos.length) ? data.fidelidadTipos : TIPOS_ACCION
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showAuto, setShowAuto] = useState(false)
  const [accForm, setAccForm] = useState({ tipo: tipos[0], fecha: today(), nota: '' })
  const { user, isAdmin } = useAuth()

  const sLeads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const sVentas = isAdmin ? data.ventas : data.ventas.filter(v => v.owner === user.nombre)
  const acciones = useMemo(
    () => (data.actividades || []).filter(a => a.tipo === 'Fidelización' && (isAdmin || a.owner === user.nombre)),
    [data.actividades, isAdmin, user.nombre]
  )

  const clientes = useMemo(() => {
    const map = new Map()
    const ensure = nombre => {
      if (!map.has(nombre)) {
        const lead = data.leads.find(l => l.nombre === nombre)
        map.set(nombre, { nombre, leadId: lead?.id || null, nivelManual: lead?.nivelFidelidad || null, compras: 0, total: 0, ultima: '', ultimoVehiculo: '', cumple: lead?.cumple || '', tel: lead?.tel || '' })
      }
      return map.get(nombre)
    }
    sLeads.filter(l => l.rol === 'cliente').forEach(l => ensure(l.nombre))
    sVentas.forEach(v => {
      if (!v.cliente) return
      const c = ensure(v.cliente)
      c.compras += 1; c.total += num(v.precio)
      if (!c.ultima || v.fecha >= c.ultima) { c.ultima = v.fecha; c.ultimoVehiculo = v.vehiculo || c.ultimoVehiculo }
    })
    return [...map.values()].map(c => ({
      ...c,
      tier: c.nivelManual ? (TIERS.find(t => t.key === c.nivelManual) || loyaltyTier(c.compras)) : loyaltyTier(c.compras),
    })).sort((a, b) => b.total - a.total)
  }, [sLeads, sVentas, data.leads])

  const cli = clientes.find(c => c.nombre === selected)
  const accionesCli = acciones.filter(a => (a.cliente || a.lead) === selected)
  const pendientes = acciones.filter(a => !a.done)
  const cumpleMes = clientes.filter(c => { const ci = cumpleInfo(c.cumple); return ci && ci.diff <= 30 })
  const oroPlus = clientes.filter(c => ['Oro', 'Platino'].includes(c.tier.key)).length

  function addAccion() {
    addItem('actividades', { titulo: accForm.tipo + (accForm.nota ? ` · ${accForm.nota}` : ''), fecha: accForm.fecha, tipo: 'Fidelización', cliente: selected, lead: selected, owner: '', done: false })
    setAccForm({ tipo: TIPOS_ACCION[0], fecha: today(), nota: '' })
    toast('Acción programada · visible en Actividades')
  }

  return (
    <>
      <Topbar title="Fidelización" sub="Relación post-venta y lealtad de clientes">
        <button className="btn" onClick={() => setShowAuto(true)}><Zap size={14} /> Automatizaciones</button>
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Programar acción</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="Clientes" value={clientes.length} accent="cyan" />
          <Kpi label="Clientes Oro+" value={oroPlus} accent="amber" sub="alto valor" />
          <Kpi label="Cumpleaños (30 días)" value={cumpleMes.length} accent="violet" />
          <Kpi to="/actividades" label="Acciones pendientes" value={pendientes.length} accent="green" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.4fr 1fr' : '1fr', gap: 16 }}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>{['Cliente', 'Nivel', 'Compras', 'Total', 'Último vehículo', 'Última', 'Cumpleaños'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {clientes.map(c => {
                  const ci = cumpleInfo(c.cumple)
                  return (
                    <tr key={c.nombre} className="clickable" onClick={() => setSelected(c.nombre)}>
                      <td className="cell-strong">{c.nombre}</td>
                      <td><Badge tone={c.tier.color}>{c.tier.key}{c.nivelManual ? ' ✎' : ''}</Badge></td>
                      <td className="num">{c.compras}</td>
                      <td className="cell-money">{fmtMoney(c.total)}</td>
                      <td className="text-2">{c.ultimoVehiculo || <span className="muted">—</span>}</td>
                      <td className="num text-2">{c.ultima ? fmtDate(c.ultima) : '—'}</td>
                      <td>{c.cumple ? <span>{fmtDate(c.cumple)} {ci && ci.diff <= 14 && <Badge tone="amber">🎂 {ci.diff}d</Badge>}</span> : <span className="muted">—</span>}</td>
                    </tr>
                  )
                })}
                {!clientes.length && <EmptyRow colSpan={7}><div className="big">Aún no hay clientes</div>Los clientes aparecen al registrar ventas o marcar un contacto como "cliente".</EmptyRow>}
              </tbody>
            </table>
          </div>

          {cli && (
            <div className="card" style={{ alignSelf: 'start' }}>
              <div className="row between mb-12">
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{cli.nombre}</div>
                  <div className="text-3" style={{ fontSize: 12 }}>{cli.compras} compras · {fmtMoneyShort(cli.total)}</div>
                </div>
                <button className="btn ghost sm" onClick={() => setSelected(null)}>Cerrar</button>
              </div>
              <div className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none', padding: 12, marginBottom: 14 }}>
                <div className="row between mb-12">
                  <Badge tone={cli.tier.color}>Nivel {cli.tier.key}</Badge>
                  {cli.cumple && <span className="text-3" style={{ fontSize: 12 }}>🎂 {fmtDate(cli.cumple)}</span>}
                </div>
                {cli.ultimoVehiculo && <div className="text-2" style={{ fontSize: 12.5, marginBottom: 10 }}>Último vehículo: <b>{cli.ultimoVehiculo}</b></div>}
                {cli.leadId && (
                  <div>
                    <div className="field-label">Nivel de fidelidad (manual)</div>
                    <select className="select" value={cli.nivelManual || 'auto'}
                      onChange={e => updateItem('leads', cli.leadId, { nivelFidelidad: e.target.value === 'auto' ? '' : e.target.value })}>
                      <option value="auto">Automático (por compras)</option>
                      {TIERS.map(t => <option key={t.key} value={t.key}>{t.key}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="overline mb-12">Acciones de fidelización</div>
              {accionesCli.map(a => (
                <div key={a.id} className="row gap-8" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                  <input type="checkbox" checked={a.done} onChange={() => updateItem('actividades', a.id, { done: !a.done })} />
                  <div style={{ flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-3)' : 'var(--text)' }}>
                    {a.titulo} <span className="text-3">· {fmtDate(a.fecha)}</span>
                  </div>
                  <button className="btn danger sm" onClick={() => confirmDelete('la acción', () => deleteItem('actividades', a.id))}>×</button>
                </div>
              ))}
              {!accionesCli.length && <div className="text-3" style={{ fontSize: 12, padding: '4px 0 10px' }}>Sin acciones registradas.</div>}

              <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <select className="select" value={accForm.tipo} onChange={e => setAccForm({ ...accForm, tipo: e.target.value })}>{tipos.map(t => <option key={t}>{t}</option>)}</select>
                <input className="input" placeholder="Nota (opcional)" value={accForm.nota} onChange={e => setAccForm({ ...accForm, nota: e.target.value })} />
                <div className="row gap-6">
                  <input className="input" type="date" value={accForm.fecha} onChange={e => setAccForm({ ...accForm, fecha: e.target.value })} />
                  {[7, 30, 90].map(n => <button key={n} className="btn sm" onClick={() => setAccForm({ ...accForm, fecha: addDays(n) })}>+{n}d</button>)}
                </div>
                <button className="btn primary" onClick={addAccion}>+ Agregar acción</button>
              </div>
            </div>
          )}
        </div>

        <div className="section-head mt-24"><span className="section-title">Niveles de fidelidad</span></div>
        <div className="kpi-grid">
          {TIERS.map(t => (
            <div key={t.key} className="card">
              <Badge tone={t.color}>{t.key}</Badge>
              <div className="text-3 mt-8" style={{ fontSize: 11.5 }}>Desde {t.min} compra{t.min === 1 ? '' : 's'}</div>
            </div>
          ))}
        </div>
      </Page>

      {showForm && <AccionGlobalForm clientes={clientes} tipos={tipos}
        onSave={f => { addItem('actividades', { titulo: f.tipo + (f.nota ? ` · ${f.nota}` : ''), fecha: f.fecha, tipo: 'Fidelización', cliente: f.cliente, lead: f.cliente, owner: '', done: false }); setShowForm(false); toast('Acción programada') }}
        onClose={() => setShowForm(false)} />}
      {showAuto && <PlantillasModal plantillas={data.fidelidadPlantillas || []} tipos={tipos} setField={setField} onClose={() => setShowAuto(false)} />}
    </>
  )
}

function PlantillasModal({ plantillas, tipos, setField, onClose }) {
  const [nuevo, setNuevo] = useState({ titulo: '', base: 'compra', meses: 1 })
  const [nuevoTipo, setNuevoTipo] = useState('')
  function addTipo() {
    const t = nuevoTipo.trim()
    if (!t) return
    if (tipos.some(x => x.toLowerCase() === t.toLowerCase())) { toast('Ese tipo ya existe', 'error'); return }
    setField('fidelidadTipos', [...tipos, t]); setNuevoTipo(''); toast('Tipo agregado')
  }
  function removeTipo(t) {
    if (tipos.length <= 1) { toast('Debe quedar al menos un tipo', 'error'); return }
    setField('fidelidadTipos', tipos.filter(x => x !== t))
  }
  function add() {
    if (!nuevo.titulo.trim()) return
    setField('fidelidadPlantillas', [...plantillas, { id: uid(), titulo: nuevo.titulo.trim(), base: nuevo.base, meses: num(nuevo.meses) }])
    setNuevo({ titulo: '', base: 'compra', meses: 1 }); toast('Plantilla agregada')
  }
  const remove = id => setField('fidelidadPlantillas', plantillas.filter(p => p.id !== id))
  const desc = p => p.base === 'cumple' ? 'En el próximo cumpleaños' : `${p.meses} mes(es) después de la compra`

  return (
    <Modal title="Automatizaciones de fidelización" onClose={onClose} width={460}
      footer={<button className="btn" onClick={onClose}>Cerrar</button>}>
      <div className="text-3 mb-12" style={{ fontSize: 12 }}>
        Estas actividades se generan automáticamente cuando un contacto se convierte en cliente tras su primera compra. La de cumpleaños se marca como vencida si no se realiza a tiempo.
      </div>
      {plantillas.map(p => (
        <div key={p.id} className="row between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="cell-strong" style={{ fontSize: 13 }}>{p.titulo}</div>
            <div className="text-3" style={{ fontSize: 11.5 }}>{desc(p)}</div>
          </div>
          <button className="btn danger sm" onClick={() => remove(p.id)}>Quitar</button>
        </div>
      ))}
      <div className="overline" style={{ margin: '14px 0 8px' }}>Nueva automatización</div>
      <Field label="Título"><input className="input" value={nuevo.titulo} onChange={e => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="Ej. Encuesta de satisfacción" /></Field>
      <div className="form-grid cols-2">
        <Field label="Se programa">
          <select className="select" value={nuevo.base} onChange={e => setNuevo({ ...nuevo, base: e.target.value })}>
            <option value="compra">Meses después de la compra</option>
            <option value="cumple">En el próximo cumpleaños</option>
          </select>
        </Field>
        {nuevo.base === 'compra' && <Field label="Meses después"><input className="input" type="number" min="0" value={nuevo.meses} onChange={e => setNuevo({ ...nuevo, meses: e.target.value })} /></Field>}
      </div>
      <button className="btn cyan" onClick={add}>+ Agregar automatización</button>

      <div style={{ borderTop: '1px solid var(--line)', margin: '18px 0 12px' }} />
      <div className="overline mb-12">Tipos de acción de fidelización</div>
      <div className="row gap-6 wrap mb-12">
        {tipos.map(t => (
          <span key={t} className="chip">{t} <span style={{ cursor: 'pointer', color: 'var(--red)', fontWeight: 700 }} onClick={() => removeTipo(t)}>×</span></span>
        ))}
      </div>
      <div className="row gap-6">
        <input className="input" placeholder="Nuevo tipo (ej. Llamada de cortesía)" value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTipo()} />
        <button className="btn" onClick={addTipo}>+ Tipo</button>
      </div>
    </Modal>
  )
}

function AccionGlobalForm({ clientes, tipos, onSave, onClose }) {
  const [form, setForm] = useState({ cliente: '', tipo: tipos[0], fecha: today(), nota: '' })
  return (
    <Modal title="Programar acción de fidelización" onClose={onClose} width={420}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.cliente} />}>
      <Field label="Cliente">
        <select className="select" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })}>
          <option value="">— Seleccionar cliente —</option>
          {clientes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </Field>
      <Field label="Tipo de acción">
        <select className="select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{tipos.map(t => <option key={t}>{t}</option>)}</select>
      </Field>
      <Field label="Nota"><input className="input" value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} /></Field>
      <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></Field>
    </Modal>
  )
}
