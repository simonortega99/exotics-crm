import { uid } from './utils.js'
import { calCrear } from './calendar.js'

// Helper compartido para crear una cita y su actividad "espejo" (tipo 'Cita'),
// de modo que las citas también aparezcan en el módulo Actividades. Además crea
// el evento en Google Calendar (con recordatorios) e invita a los `guests`.
export function crearCita(addItem, updateItem, cita, guests) {
  const calKey = uid()
  const created = addItem('citas', { ...cita, calKey })
  const act = addItem('actividades', {
    titulo: `Cita: ${cita.cliente || cita.vehiculo || 'vehículo'}`,
    fecha: cita.fecha, tipo: 'Cita', owner: cita.owner || '',
    lead: cita.cliente || '', vehiculo: cita.vehiculo || '',
    citaId: created.id, done: false,
  })
  updateItem('citas', created.id, { actId: act.id })
  calCrear({ ...created, calKey }, guests)
  return created
}
