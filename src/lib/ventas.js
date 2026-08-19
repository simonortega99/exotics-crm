import { num, daysSince, addMonths, nextBirthdayDate } from './utils.js'

// Registra una venta y aplica todos sus efectos: crea la venta, genera su entrega,
// saca el vehículo del inventario (estado Vendido), convierte al lead en cliente,
// marca como Ganadas las oportunidades abiertas que correspondan y genera el plan
// de fidelización en la primera compra.
// Se usa tanto desde el módulo Ventas como al marcar una oportunidad como ganada.
// Devuelve { venta, fidelidadGeneradas }.
export function registrarVenta({ data, addItem, updateItem }, form) {
  const vehiculo = data.inventario.find(v => v.id === form.vehiculoId)
  const cliente = data.leads.find(l => l.id === form.clienteId)
  const diasVenta = vehiculo?.fechaIngreso ? daysSince(vehiculo.fechaIngreso) : 0
  const vehName = vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio || ''}`.trim() : (form.vehiculoLibre || '')

  const venta = addItem('ventas', {
    fecha: form.fecha,
    vehiculo: vehName,
    vehiculoId: form.vehiculoId || '', cliente: cliente?.nombre || '', clienteId: form.clienteId || '',
    precio: num(form.precio), comisionPct: form.comisionPct, comision: num(form.comision),
    ganancia: num(form.ganancia) || num(form.comision), owner: form.owner || 'Simón',
    fuente: form.fuente, credito: form.credito, seguro: form.seguro, nota: form.nota || '',
    referido: form.referido || '', comisionReferidoPct: form.comisionReferidoPct || '', comisionReferido: num(form.comisionReferido),
    diasVenta, esAliado: !vehiculo,
  })

  // Toda venta genera una entrega con su checklist (módulo Entregas).
  addItem('entregas', {
    ventaId: venta.id, vehiculoId: form.vehiculoId || '', vehiculo: vehName,
    clienteId: form.clienteId || '', cliente: cliente?.nombre || '', owner: form.owner || 'Simón',
    placa: vehiculo?.placa || '', motor: vehiculo?.motor || '', fechaVenta: form.fecha,
    checklist: {}, entregaFecha: '', entregaHora: '', entregaLugar: '', estado: 'En proceso',
  })

  if (vehiculo) updateItem('inventario', vehiculo.id, { estado: 'Vendido' })

  let fidelidadGeneradas = 0
  if (cliente) {
    const eraCliente = cliente.rol === 'cliente'
    updateItem('leads', cliente.id, { rol: 'cliente' })
    ;(data.oportunidades || [])
      .filter(o => o.contactoId === cliente.id && o.estado === 'Abierta' && (!vehiculo || !o.vehiculoId || o.vehiculoId === vehiculo.id))
      .forEach(o => updateItem('oportunidades', o.id, { estado: 'Ganada' }))
    // Primera compra → generar plan de fidelización automático desde las plantillas
    if (!eraCliente) {
      const plantillas = data.fidelidadPlantillas || []
      plantillas.forEach(p => {
        const fecha = p.base === 'cumple' ? nextBirthdayDate(cliente.cumple) : addMonths(form.fecha, p.meses)
        if (!fecha) return
        addItem('actividades', { titulo: p.titulo, fecha, tipo: 'Fidelización', cliente: cliente.nombre, lead: cliente.nombre, owner: form.owner || 'Simón', done: false, auto: true })
        fidelidadGeneradas++
      })
    }
  }

  return { venta, fidelidadGeneradas }
}
