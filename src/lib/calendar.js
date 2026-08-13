// Sincroniza las citas con Google Calendar vía el Apps Script (mismo webhook
// de Sheets, VITE_SHEETS_WEBHOOK_URL). Cada cita lleva un `calKey` para poder
// actualizar/eliminar su evento después. Si no hay webhook, no hace nada.
const URL_ = import.meta.env.VITE_SHEETS_WEBHOOK_URL

function post(body) {
  if (!URL_) return
  try {
    fetch(URL_, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
  } catch (e) { /* silencioso */ }
}

const titulo = c => `Cita: ${c.vehiculo || 'vehículo'}${c.placa ? ` (${c.placa})` : ''} — ${c.cliente || 'cliente'}`
const desc = c => `Muestra de vehículo.\nCliente: ${c.cliente || ''}\nVehículo: ${c.vehiculo || ''} ${c.placa || ''}\nAsesor: ${c.owner || ''}\nLugar: ${c.lugar || ''}\nNota: ${c.nota || ''}`.trim()

// ---- Genéricos (sirven para cualquier tipo de evento) ----
export function calCrearEvento({ calKey, fecha, hora, durationMin = 60, titulo, descripcion, lugar, guests }) {
  if (!fecha || !calKey) return
  post({ tipo: 'cita', accion: 'crear', calKey, fecha, hora: hora || '', durationMin, titulo, descripcion: descripcion || '', lugar: lugar || '', guests: (guests || []).filter(Boolean) })
}
export function calActualizarEvento({ calKey, oldFecha, fecha, hora, durationMin = 60, titulo, descripcion, lugar, guests }) {
  if (!calKey) return
  post({ tipo: 'cita', accion: 'actualizar', calKey, oldFecha: oldFecha || fecha, fecha, hora: hora || '', durationMin, titulo, descripcion: descripcion || '', lugar: lugar || '', guests: (guests || []).filter(Boolean) })
}
export function calEliminarEvento(calKey, fecha) {
  if (!calKey) return
  post({ tipo: 'cita', accion: 'eliminar', calKey, fecha })
}

// ---- Citas (usan los genéricos con su formato) ----
export function calCrear(cita, guests) {
  calCrearEvento({ calKey: cita.calKey, fecha: cita.fecha, hora: cita.hora, titulo: titulo(cita), descripcion: desc(cita), lugar: cita.lugar, guests })
}
export function calActualizar(cita, oldFecha, guests) {
  calActualizarEvento({ calKey: cita.calKey, oldFecha, fecha: cita.fecha, hora: cita.hora, titulo: titulo(cita), descripcion: desc(cita), lugar: cita.lugar, guests })
}
export function calEliminar(cita) {
  calEliminarEvento(cita.calKey, cita.fecha)
}

// ---- Entregas ----
const tituloEntrega = e => `Entrega: ${e.vehiculo || 'vehículo'}${e.placa ? ` (${e.placa})` : ''} — ${e.cliente || 'cliente'}`
const descEntrega = e => `Entrega de vehículo.\nCliente: ${e.cliente || ''}\nVehículo: ${e.vehiculo || ''} ${e.placa || ''}\nAsesor: ${e.owner || ''}\nLugar: ${e.entregaLugar || ''}`.trim()
export function calCrearEntrega(entrega, guests) {
  calCrearEvento({ calKey: entrega.calKey, fecha: entrega.entregaFecha, hora: entrega.entregaHora, titulo: tituloEntrega(entrega), descripcion: descEntrega(entrega), lugar: entrega.entregaLugar, guests })
}
export function calActualizarEntrega(entrega, oldFecha, guests) {
  calActualizarEvento({ calKey: entrega.calKey, oldFecha, fecha: entrega.entregaFecha, hora: entrega.entregaHora, titulo: tituloEntrega(entrega), descripcion: descEntrega(entrega), lugar: entrega.entregaLugar, guests })
}
export function calEliminarEntrega(entrega) {
  calEliminarEvento(entrega.calKey, entrega.entregaFecha)
}
