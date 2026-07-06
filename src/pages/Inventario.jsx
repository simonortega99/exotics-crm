import { useState, Fragment } from 'react'
import { useStore } from '../lib/store.jsx'
import { TIPOS_VEHICULO, ESTADOS_VEHICULO, OPP_STAGES, ASESORES, THERMO_TONE, MOTORES, fmtMoney, fmtMoneyShort, fmtDate, daysSince, today, num, exportarHojaXls, diasPicoPlaca, nombresDias } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, NumberInput, Kebab } from '../components/ui.jsx'
import { toast } from '../components/feedback.jsx'
import { Download } from 'lucide-react'

const ESTADO_TONE = { Disponible: 'green', Reservado: 'amber', Vendido: 'gray' }
const THERMO = THERMO_TONE
const linkTipos = ['Consignación', 'Aliado']

export default function Inventario() {
  const { data, addItem, updateItem, deleteItemUndo } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filtro, setFiltro] = useState('Activos')
  const [openId, setOpenId] = useState(null)
  const [sort, setSort] = useState({ campo: 'vehiculo', dir: 'asc' })

  const inv = data.inventario
  const matchFiltro = v => filtro === 'Todos' ? true : filtro === 'Vendidos' ? v.estado === 'Vendido' : v.estado !== 'Vendido'
  const sortVal = (v, campo) => campo === 'vehiculo' ? `${v.marca} ${v.modelo}`.toLowerCase()
    : campo === 'anio' ? num(v.anio)
    : campo === 'precio' ? num(v.precio)
    : campo === 'comision' ? num(v.comision)
    : campo === 'dias' ? (v.fechaIngreso ? daysSince(v.fechaIngreso) : -1)
    : (v[campo] || '')
  const list = inv.filter(matchFiltro).sort((a, b) => {
    const av = sortVal(a, sort.campo), bv = sortVal(b, sort.campo)
    const c = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'asc' ? c : -c
  })
  const toggleSort = campo => setSort(s => s.campo === campo ? { campo, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' })
  const arrow = campo => sort.campo === campo ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
  const disponibles = inv.filter(v => v.estado === 'Disponible')
  const valorStock = inv.filter(v => v.estado !== 'Vendido').reduce((a, v) => a + num(v.precio), 0)
  const diasProm = disponibles.length
    ? Math.round(disponibles.reduce((a, v) => a + (v.fechaIngreso ? daysSince(v.fechaIngreso) : 0), 0) / disponibles.length)
    : 0

  function interesadosDe(vehiculoId) {
    const opps = (data.oportunidades || []).filter(o => o.vehiculoId === vehiculoId && o.estado === 'Abierta')
    const map = new Map()
    data.leads.filter(l => l.vehiculoId === vehiculoId).forEach(l => map.set(l.id, { lead: l, opp: null }))
    opps.forEach(o => { const l = data.leads.find(x => x.id === o.contactoId); map.set(l?.id || o.id, { lead: l || { nombre: o.contacto }, opp: o }) })
    return [...map.values()]
  }
  function exportar() {
    const headers = ['Marca', 'Modelo', 'Año', 'Placa', 'Motor', 'Tipo', 'Estado', 'Precio', 'Comisión %', 'Días en stock', 'Contacto', 'Referido por', '% Com. referido', 'Asesor', 'Fecha ingreso']
    const rows = list.map(v => [v.marca, v.modelo, v.anio, v.placa, v.motor, v.tipo, v.estado, v.precio, v.comision, v.fechaIngreso ? daysSince(v.fechaIngreso) : '', v.contactoNombre, v.referidoPor, v.comisionReferido, v.owner, v.fechaIngreso])
    exportarHojaXls(`Inventario_${today()}.xls`, 'Inventario · Exotics Co.', headers, rows)
    toast('Inventario exportado')
  }
  function crearOpp(lead, v) {
    addItem('oportunidades', {
      contactoId: lead.id, contacto: lead.nombre, vehiculoId: v.id,
      vehiculoInteres: `${v.marca} ${v.modelo} ${v.anio || ''}`.trim(),
      valor: v.precio || '', stage: 1, estado: 'Abierta', financiacion: false, owner: lead.owner || 'Simón', fecha: today(),
    })
    toast(`Oportunidad creada para ${lead.nombre}`)
  }

  return (
    <>
      <Topbar title="Inventario" sub={`${disponibles.length} disponibles · ${inv.filter(v => v.estado !== 'Vendido').length} activos`}>
        <button className="btn" onClick={exportar}><Download size={14} /> Exportar</button>
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Agregar vehículo</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="Disponibles" value={disponibles.length} accent="green" />
          <Kpi label="Valor en stock activo" value={fmtMoneyShort(valorStock)} valueClass="cyan" accent="cyan" sub={fmtMoney(valorStock)} />
          <Kpi label="Días promedio en stock" value={diasProm + 'd'} accent="amber" />
          <Kpi label="Vendidos" value={inv.filter(v => v.estado === 'Vendido').length} accent="ink" />
        </div>

        <div className="filters">
          <div className="seg">
            {['Activos', 'Vendidos', 'Todos'].map(e => <button key={e} className={filtro === e ? 'on' : ''} onClick={() => setFiltro(e)}>{e}</button>)}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th onClick={() => toggleSort('vehiculo')} style={{ cursor: 'pointer' }}>Vehículo{arrow('vehiculo')}</th>
                <th onClick={() => toggleSort('anio')} style={{ cursor: 'pointer' }}>Año{arrow('anio')}</th>
                <th onClick={() => toggleSort('tipo')} style={{ cursor: 'pointer' }}>Tipo{arrow('tipo')}</th>
                <th onClick={() => toggleSort('estado')} style={{ cursor: 'pointer' }}>Estado{arrow('estado')}</th>
                <th onClick={() => toggleSort('precio')} style={{ cursor: 'pointer' }}>Precio{arrow('precio')}</th>
                <th onClick={() => toggleSort('comision')} style={{ cursor: 'pointer' }}>Comisión{arrow('comision')}</th>
                <th onClick={() => toggleSort('dias')} style={{ cursor: 'pointer' }}>Días{arrow('dias')}</th>
                <th>Interesados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map(v => {
                const interesados = v.estado === 'Vendido' ? [] : interesadosDe(v.id)
                const venta = v.estado === 'Vendido' ? (data.ventas || []).find(x => x.vehiculoId === v.id) : null
                const expandible = interesados.length > 0 || !!venta
                const open = openId === v.id
                return (
                  <Fragment key={v.id}>
                    <tr className="clickable" onClick={() => setOpenId(open ? null : v.id)}>
                      <td>
                        <div className="cell-strong">{v.marca} {v.modelo} <span className="text-3">{expandible ? (open ? '▾' : '▸') : ''}</span></div>
                        {(v.placa || v.motor) && <div className="text-3" style={{ fontSize: 11 }}>{[v.placa && `Placa: ${v.placa}`, v.motor].filter(Boolean).join(' · ')}</div>}
                        <PicoPlacaLinea placa={v.placa} motor={v.motor} config={data.picoPlaca} />
                        {v.contactoNombre && <div className="text-3" style={{ fontSize: 11 }}>{v.tipo === 'Aliado' ? 'Aliado' : 'Consignante'}: {v.contactoNombre}</div>}
                        {v.referidoPor && <div className="text-3" style={{ fontSize: 11 }}>Referido: {v.referidoPor}{v.comisionReferido ? ` (${v.comisionReferido}%)` : ''}</div>}
                      </td>
                      <td className="num">{v.anio || '—'}</td>
                      <td><Badge tone="ink">{v.tipo}</Badge></td>
                      <td onClick={e => e.stopPropagation()}>
                        <select className="select" style={{ maxWidth: 130 }} value={v.estado} onChange={e => updateItem('inventario', v.id, { estado: e.target.value })}>
                          {ESTADOS_VEHICULO.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="cell-money">{fmtMoney(v.precio)}</td>
                      <td className="num">{v.comision ? v.comision + '%' : <span className="muted">—</span>}</td>
                      <td className="num text-2">{v.fechaIngreso ? daysSince(v.fechaIngreso) + 'd' : '—'}</td>
                      <td>{interesados.length ? <Badge tone="cyan">{interesados.length}</Badge> : <span className="muted">—</span>}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <Kebab items={[
                          { label: 'Editar', onClick: () => setEditing(v) },
                          { label: 'Eliminar', danger: true, onClick: () => deleteItemUndo('inventario', v, `${v.marca} ${v.modelo}`) },
                        ]} />
                      </td>
                    </tr>
                    {open && venta && (
                      <tr>
                        <td colSpan={9} style={{ background: 'var(--surface-2)' }}>
                          <div className="overline mb-12">Información de la venta</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '4px 2px' }}>
                            <DatoVenta label="Cliente" valor={venta.cliente || '—'} />
                            <DatoVenta label="Fecha" valor={fmtDate(venta.fecha)} />
                            <DatoVenta label="Precio" valor={fmtMoney(venta.precio)} />
                            <DatoVenta label="Ingreso generado" valor={fmtMoney(num(venta.ganancia) || num(venta.comision))} />
                            <DatoVenta label="Asesor" valor={venta.owner || '—'} />
                            <DatoVenta label="Fuente" valor={venta.fuente || '—'} />
                            <DatoVenta label="Crédito" valor={venta.credito || 'Ninguno'} />
                            <DatoVenta label="Seguro" valor={venta.seguro || 'Ninguno'} />
                            {venta.referido && <DatoVenta label="Referido" valor={`${venta.referido}${num(venta.comisionReferido) ? ` · ${fmtMoney(venta.comisionReferido)}` : ''}`} />}
                          </div>
                        </td>
                      </tr>
                    )}
                    {open && !venta && interesados.length > 0 && (
                      <tr>
                        <td colSpan={9} style={{ background: 'var(--surface-2)' }}>
                          <div className="overline mb-12">Leads activos interesados en este vehículo</div>
                          {interesados.map(({ lead, opp }, i) => (
                            <div key={i} className="row between" style={{ padding: '7px 2px', borderBottom: i < interesados.length - 1 ? '1px solid var(--line)' : 'none' }}>
                              <div className="row gap-8">
                                <span className="cell-strong" style={{ fontSize: 12.5 }}>{lead.nombre}</span>
                                {lead.thermo && <Badge tone={THERMO[lead.thermo] || 'gray'} dot>{lead.thermo}</Badge>}
                                {lead.tel && <span className="text-3" style={{ fontSize: 11.5 }}>{lead.tel}</span>}
                              </div>
                              <div>
                                {opp ? <Badge tone="cyan">Oportunidad · {OPP_STAGES[opp.stage]}</Badge>
                                  : <button className="btn cyan sm" onClick={() => crearOpp(lead, v)}>+ Oportunidad</button>}
                              </div>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!list.length && <EmptyRow colSpan={9}><div className="big">Sin vehículos</div>{filtro === 'Vendidos' ? 'Aún no hay ventas registradas.' : 'Agrega tu primer vehículo al inventario.'}</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Page>

      {showForm && <VehiculoForm title="Nuevo vehículo" leads={data.leads} asesores={data.asesores || ASESORES}
        onSave={f => {
          const v = addItem('inventario', f)
          if (f.tipo === 'Consignación' && f.contactoId) updateItem('leads', f.contactoId, { vehiculoConsignadoId: v.id, vehiculoConsignado: `${f.marca} ${f.modelo} ${f.anio || ''}`.trim() })
          setShowForm(false); toast('Vehículo agregado')
        }} onClose={() => setShowForm(false)} />}
      {editing && <VehiculoForm title="Editar vehículo" leads={data.leads} asesores={data.asesores || ASESORES} initial={editing}
        onSave={f => {
          updateItem('inventario', editing.id, f)
          if (f.tipo === 'Consignación' && f.contactoId) updateItem('leads', f.contactoId, { vehiculoConsignadoId: editing.id, vehiculoConsignado: `${f.marca} ${f.modelo} ${f.anio || ''}`.trim() })
          setEditing(null); toast('Vehículo actualizado')
        }} onClose={() => setEditing(null)} />}
    </>
  )
}

// Línea informativa de pico y placa para una fila del inventario.
function PicoPlacaLinea({ placa, motor, config }) {
  const dias = diasPicoPlaca(placa, motor, config)
  if (dias === 'exento') {
    return <div className="text-3" style={{ fontSize: 11 }}>Pico y placa: exento ({motor})</div>
  }
  if (!placa || dias === null) return null
  // Si aún no se configuró ningún dígito, no ensuciamos cada fila con "sin restricción".
  const hayConfig = config && Object.values(config).some(arr => (arr || []).length)
  if (!hayConfig) return null
  return (
    <div className="text-3" style={{ fontSize: 11 }}>
      Pico y placa: {dias.length ? nombresDias(dias) : 'sin restricción'}
    </div>
  )
}

function DatoVenta({ label, valor }) {
  return (
    <div>
      <div className="kpi-label">{label}</div>
      <div className="cell-strong" style={{ fontSize: 13, marginTop: 2 }}>{valor}</div>
    </div>
  )
}

function VehiculoForm({ title, leads, asesores, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    marca: '', modelo: '', anio: '', placa: '', motor: 'Gasolina', precio: '', comision: '', tipo: 'Propio', estado: 'Disponible',
    fechaIngreso: today(), owner: 'Simón', contactoId: '', contactoNombre: '', referidoPor: '', comisionReferido: '',
  })
  const set = (k, v) => setForm({ ...form, [k]: v })
  const needsLink = linkTipos.includes(form.tipo)
  const linkRol = form.tipo === 'Aliado' ? 'aliado' : 'consignante'
  const leadsLink = leads.filter(l => l.rol === linkRol)

  function pickContacto(id) {
    const l = leads.find(x => x.id === id)
    setForm({ ...form, contactoId: id, contactoNombre: l ? l.nombre : '' })
  }

  return (
    <Modal title={title} onClose={onClose} width={480}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.marca.trim() || !form.modelo.trim()} saveLabel={initial ? 'Guardar cambios' : 'Guardar'} />}>
      <div className="form-grid cols-2">
        <Field label="Marca"><input className="input" value={form.marca} onChange={e => set('marca', e.target.value)} autoFocus /></Field>
        <Field label="Modelo"><input className="input" value={form.modelo} onChange={e => set('modelo', e.target.value)} /></Field>
        <Field label="Año"><input className="input" value={form.anio} onChange={e => set('anio', e.target.value)} /></Field>
        <Field label="Placa"><input className="input" value={form.placa || ''} onChange={e => set('placa', e.target.value.toUpperCase())} placeholder="ABC123" /></Field>
        <Field label="Precio"><NumberInput prefix="$" value={form.precio} onChange={v => set('precio', v)} /></Field>
        <Field label="% Comisión"><input className="input" value={form.comision} onChange={e => set('comision', e.target.value)} placeholder="ej. 5" /></Field>
        <Field label="Tipo">
          <select className="select" value={form.tipo} onChange={e => set('tipo', e.target.value)}>{TIPOS_VEHICULO.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Motorización">
          <select className="select" value={form.motor || 'Gasolina'} onChange={e => set('motor', e.target.value)}>{MOTORES.map(m => <option key={m}>{m}</option>)}</select>
        </Field>
      </div>
      {needsLink && (
        <Field label={`Contacto (${linkRol})`}>
          <select className="select" value={form.contactoId} onChange={e => pickContacto(e.target.value)}>
            <option value="">— Sin vincular —</option>
            {leadsLink.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          {!leadsLink.length && <div className="text-3" style={{ fontSize: 11, marginTop: 4 }}>No hay contactos con rol "{linkRol}". Créalos en Contactos.</div>}
        </Field>
      )}
      <div className="form-grid cols-2">
        <Field label="Estado">
          <select className="select" value={form.estado} onChange={e => set('estado', e.target.value)}>{ESTADOS_VEHICULO.map(s => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Asesor responsable">
          <select className="select" value={form.owner || 'Simón'} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
      </div>
      <Field label="Fecha de ingreso"><input className="input" type="date" value={form.fechaIngreso || ''} onChange={e => set('fechaIngreso', e.target.value)} /></Field>
      <div className="form-grid cols-2">
        <Field label="Referido por (opcional)"><input className="input" value={form.referidoPor || ''} onChange={e => set('referidoPor', e.target.value)} placeholder="Nombre de quien refirió" /></Field>
        <Field label="% Comisión referido"><input className="input" value={form.comisionReferido || ''} onChange={e => set('comisionReferido', e.target.value)} placeholder="ej. 2" /></Field>
      </div>
    </Modal>
  )
}
