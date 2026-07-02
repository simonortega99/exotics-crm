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

export function calCrear(cita, guests) {
  if (!cita.fecha || !cita.calKey) return
  post({ tipo: 'cita', accion: 'crear', calKey: cita.calKey, fecha: cita.fecha, hora: cita.hora || '', durationMin: 60, titulo: titulo(cita), descripcion: desc(cita), lugar: cita.lugar || '', guests: (guests || []).filter(Boolean) })
}
export function calActualizar(cita, oldFecha, guests) {
  if (!cita.calKey) return
  post({ tipo: 'cita', accion: 'actualizar', calKey: cita.calKey, oldFecha: oldFecha || cita.fecha, fecha: cita.fecha, hora: cita.hora || '', durationMin: 60, titulo: titulo(cita), descripcion: desc(cita), lugar: cita.lugar || '', guests: (guests || []).filter(Boolean) })
}
export function calEliminar(cita) {
  if (!cita.calKey) return
  post({ tipo: 'cita', accion: 'eliminar', calKey: cita.calKey, fecha: cita.fecha })
}
