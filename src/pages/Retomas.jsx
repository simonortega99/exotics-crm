import { useState, Fragment } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtMoney, fmtMoneyShort, fmtDate, today, num } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, NumberInput, Kebab } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'

const vehName = v => v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : ''
function inversionTotal(r) {
  return num(r.valorCompra) + (r.gastos || []).reduce((a, g) => a + num(g.monto), 0)
}
// Rentabilidad real si hay valor de venta; si no, la esperada
function rentabilidad(r) {
  const inv = inversionTotal(r)
  if (num(r.valorVenta) > 0) return { val: num(r.valorVenta) - inv, real: true }
  if (r.precioEsperado) return { val: num(r.precioEsperado) - inv, real: false }
  return { val: null, real: false }
}

export default function Retomas() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [filtro, setFiltro] = useState('Activos')

  const esVendida = r => num(r.valorVenta) > 0
  const retomas = (data.retomas || []).filter(r => filtro === 'Todos' ? true : filtro === 'Vendidos' ? esVendida(r) : !esVendida(r))
  const invertido = retomas.reduce((a, r) => a + inversionTotal(r), 0)
  const rentTotal = retomas.reduce((a, r) => { const x = rentabilidad(r); return a + (x.val || 0) }, 0)
  const totales = data.retomas || []
  const vendidasTot = totales.filter(esVendida).length

  return (
    <>
      <Topbar title="Retomas" sub={`${totales.length} operaciones · ${vendidasTot} vendidas`}>
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Nueva retoma</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label={`Retomas (${filtro.toLowerCase()})`} value={retomas.length} accent="cyan" />
          <Kpi label="Capital invertido" value={fmtMoneyShort(invertido)} accent="ink" sub={fmtMoney(invertido)} />
          <Kpi label="Rentabilidad (real+esperada)" value={fmtMoneyShort(rentTotal)} valueClass={rentTotal >= 0 ? 'green' : 'red'} accent="green" sub={fmtMoney(rentTotal)} />
        </div>

        <div className="filters">
          <div className="seg">
            {['Activos', 'Vendidos', 'Todos'].map(e => <button key={e} className={filtro === e ? 'on' : ''} onClick={() => setFiltro(e)}>{e}</button>)}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{['Vehículo', 'Compra', 'Inversión', 'Precio esperado', 'Valor venta', 'Rentabilidad', 'Socios', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {retomas.map(r => {
                const inv = inversionTotal(r)
                const rent = rentabilidad(r)
                const open = openId === r.id
                return (
                  <Fragment key={r.id}>
                    <tr className="clickable" onClick={() => setOpenId(open ? null : r.id)}>
                      <td className="cell-strong">{r.marca} {r.modelo} <span className="text-3">{open ? '▾' : '▸'}</span></td>
                      <td className="num text-2">{r.fechaCompra ? fmtDate(r.fechaCompra) : '—'}</td>
                      <td className="cell-money">{fmtMoney(inv)}</td>
                      <td className="cell-money">{fmtMoney(r.precioEsperado)}</td>
                      <td className="cell-money">{num(r.valorVenta) > 0 ? fmtMoney(r.valorVenta) : <span className="muted">—</span>}</td>
                      <td>{rent.val !== null ? <Badge tone={rent.val >= 0 ? 'green' : 'red'}>{fmtMoney(rent.val)}{rent.real ? '' : ' est.'}</Badge> : <span className="muted">—</span>}</td>
                      <td className="text-2">{(r.participantes || []).filter(p => p.nombre).map(p => `${p.nombre} ${p.pct || 0}%`).join(' · ') || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <Kebab items={[
                          { label: 'Editar', onClick: () => setEditing(r) },
                          { label: 'Eliminar', danger: true, onClick: () => confirmDelete(`la retoma ${r.marca} ${r.modelo}`, () => deleteItem('retomas', r.id)) },
                        ]} />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{ background: 'var(--surface-2)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '6px 4px' }}>
                            <div>
                              <div className="overline mb-12">Desglose de inversión</div>
                              <Linea label="Valor de compra" value={fmtMoney(r.valorCompra)} />
                              {(r.gastos || []).map((g, i) => <Linea key={i} label={g.concepto || 'Gasto'} value={fmtMoney(g.monto)} />)}
                              <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 6, paddingTop: 6 }}><Linea label="Total invertido" value={fmtMoney(inv)} strong /></div>
                              {num(r.valorVenta) > 0 && <Linea label="Valor de venta" value={fmtMoney(r.valorVenta)} strong />}
                              {r.vehiculoInteres && <div className="text-3 mt-8" style={{ fontSize: 11.5 }}>Vinculado a inventario: {r.vehiculoInteres}</div>}
                              {r.fechaRegistro && <div className="text-3" style={{ fontSize: 11.5 }}>Registrada el {fmtDate(r.fechaRegistro)}</div>}
                            </div>
                            <div>
                              <div className="overline mb-12">Reparto por socio ({rent.real ? 'real' : 'esperado'})</div>
                              {(r.participantes || []).filter(p => p.nombre).map((p, i) => (
                                <Linea key={i} label={`${p.nombre} · ${p.pct || 0}%${num(p.monto) ? ` · aporte ${fmtMoney(p.monto)}` : ''}`} value={rent.val !== null ? fmtMoney(Math.round(rent.val * num(p.pct) / 100)) : '—'} />
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!retomas.length && <EmptyRow colSpan={8}><div className="big">Sin retomas</div>{filtro === 'Vendidos' ? 'No hay retomas vendidas.' : 'Registra tu primera operación de retoma.'}</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Page>

      {showForm && <RetomaForm title="Nueva retoma" inventario={data.inventario}
        onSave={f => { addItem('retomas', { ...f, fechaRegistro: today() }); setShowForm(false); toast('Retoma registrada') }} onClose={() => setShowForm(false)} />}
      {editing && <RetomaForm title="Editar retoma" inventario={data.inventario} initial={editing}
        onSave={f => { updateItem('retomas', editing.id, f); setEditing(null); toast('Retoma actualizada') }} onClose={() => setEditing(null)} />}
    </>
  )
}

function Linea({ label, value, strong }) {
  return (
    <div className="row between" style={{ padding: '4px 0', fontSize: 12.5 }}>
      <span className={strong ? 'cell-strong' : 'text-2'}>{label}</span>
      <span className="cell-money">{value}</span>
    </div>
  )
}

function RetomaForm({ title, inventario, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    marca: '', modelo: '', anio: '', fechaCompra: today(), valorCompra: '', precioEsperado: '', valorVenta: '',
    vehiculoId: '', vehiculoInteres: '', gastos: [],
    participantes: [{ nombre: 'Simón', pct: '' }, { nombre: 'Roberto', pct: '' }],
  })
  const set = (k, v) => setForm({ ...form, [k]: v })
  const setPart = (i, k, v) => set('participantes', form.participantes.map((p, j) => j === i ? { ...p, [k]: v } : p))
  const addPart = () => set('participantes', [...form.participantes, { nombre: '', pct: '' }])
  const delPart = i => set('participantes', form.participantes.filter((_, j) => j !== i))
  const setGasto = (i, k, v) => set('gastos', form.gastos.map((g, j) => j === i ? { ...g, [k]: v } : g))
  const addGasto = () => set('gastos', [...form.gastos, { concepto: '', monto: '' }])
  const delGasto = i => set('gastos', form.gastos.filter((_, j) => j !== i))

  function pickVeh(id) {
    const v = inventario.find(x => x.id === id)
    setForm({ ...form, vehiculoId: id, vehiculoInteres: v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : '' })
  }
  const totalPct = form.participantes.reduce((a, p) => a + num(p.pct), 0)

  return (
    <Modal title={title} onClose={onClose} width={500}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.marca.trim()} saveLabel={initial ? 'Guardar cambios' : 'Guardar'} />}>
      <div className="form-grid cols-3">
        <Field label="Marca"><input className="input" value={form.marca} onChange={e => set('marca', e.target.value)} autoFocus /></Field>
        <Field label="Modelo"><input className="input" value={form.modelo} onChange={e => set('modelo', e.target.value)} /></Field>
        <Field label="Año"><input className="input" value={form.anio} onChange={e => set('anio', e.target.value)} /></Field>
      </div>
      <Field label="Fecha de compra"><input className="input" type="date" value={form.fechaCompra || ''} onChange={e => set('fechaCompra', e.target.value)} /></Field>
      <div className="form-grid cols-3">
        <Field label="Valor de compra"><NumberInput prefix="$" value={form.valorCompra} onChange={v => set('valorCompra', v)} /></Field>
        <Field label="Precio esperado"><NumberInput prefix="$" value={form.precioEsperado} onChange={v => set('precioEsperado', v)} /></Field>
        <Field label="Valor de venta"><NumberInput prefix="$" value={form.valorVenta} onChange={v => set('valorVenta', v)} placeholder="al cerrar" /></Field>
      </div>
      <Field label="Vincular a vehículo de inventario (opcional)">
        <select className="select" value={form.vehiculoId} onChange={e => pickVeh(e.target.value)}>
          <option value="">— Sin vincular —</option>
          {inventario.map(v => <option key={v.id} value={v.id}>{vehName(v)} · {v.estado}</option>)}
        </select>
      </Field>

      <div className="row between" style={{ margin: '6px 0 8px' }}>
        <span className="field-label" style={{ margin: 0 }}>Gastos</span>
        <button className="btn sm" onClick={addGasto}>+ Gasto</button>
      </div>
      {form.gastos.map((g, i) => (
        <div key={i} className="row gap-6 mb-12">
          <input className="input" placeholder="Concepto" value={g.concepto} onChange={e => setGasto(i, 'concepto', e.target.value)} />
          <div style={{ maxWidth: 140 }}><NumberInput prefix="$" placeholder="Monto" value={g.monto} onChange={v => setGasto(i, 'monto', v)} /></div>
          <button className="btn danger sm" onClick={() => delGasto(i)}>×</button>
        </div>
      ))}

      <div className="row between" style={{ margin: '8px 0' }}>
        <span className="field-label" style={{ margin: 0 }}>Participantes {totalPct ? <span className={totalPct === 100 ? 't-green' : 't-red'}>· {totalPct}%</span> : ''}</span>
        <button className="btn sm" onClick={addPart}>+ Participante</button>
      </div>
      <div className="row gap-6" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>
        <span style={{ flex: 1 }}>Nombre</span><span style={{ width: 80 }}>%</span><span style={{ width: 140 }}>Aporte $</span><span style={{ width: 28 }} />
      </div>
      {form.participantes.map((p, i) => (
        <div key={i} className="row gap-6 mb-12">
          <input className="input" placeholder="Nombre" value={p.nombre} onChange={e => setPart(i, 'nombre', e.target.value)} />
          <input className="input" placeholder="%" style={{ maxWidth: 80 }} value={p.pct} onChange={e => setPart(i, 'pct', e.target.value)} />
          <div style={{ width: 140 }}><NumberInput prefix="$" placeholder="Aporte" value={p.monto} onChange={v => setPart(i, 'monto', v)} /></div>
          <button className="btn danger sm" onClick={() => delPart(i)}>×</button>
        </div>
      ))}
    </Modal>
  )
}
