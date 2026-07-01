// Helper compartido para crear una cita y su actividad "espejo" (tipo 'Cita'),
// de modo que las citas también aparezcan en el módulo Actividades.
export function crearCita(addItem, updateItem, cita) {
  const created = addItem('citas', cita)
  const act = addItem('actividades', {
    titulo: `Cita: ${cita.cliente || cita.vehiculo || 'vehículo'}`,
    fecha: cita.fecha, tipo: 'Cita', owner: cita.owner || '',
    lead: cita.cliente || '', vehiculo: cita.vehiculo || '',
    citaId: created.id, done: false,
  })
  updateItem('citas', created.id, { actId: act.id })
  return created
}
