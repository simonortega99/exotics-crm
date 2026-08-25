import { supabaseAdmin, getAccessToken, getAuth, mlGet, putMetric } from '../_ml.js'

const attrVal = (item, id) => {
  const a = (item.attributes || []).find(x => x.id === id)
  return a ? (a.value_name || a.value_id || '') : ''
}
const mapMotor = v => {
  const s = String(v || '').toLowerCase()
  if (s.includes('híb') || s.includes('hib')) return 'Híbrido'
  if (s.includes('éct') || s.includes('ect')) return 'Eléctrico'
  if (s.includes('diés') || s.includes('dies')) return 'Diésel'
  return 'Gasolina'
}
const toVehiculo = item => ({
  mlId: item.id,
  title: item.title || '',
  marca: attrVal(item, 'BRAND'),
  modelo: attrVal(item, 'MODEL'),
  anio: attrVal(item, 'VEHICLE_YEAR') || attrVal(item, 'YEAR'),
  km: attrVal(item, 'KILOMETERS'),
  color: attrVal(item, 'COLOR'),
  motor: mapMotor(attrVal(item, 'FUEL_TYPE')),
  precio: item.price ?? '',
  permalink: item.permalink || '',
})

// Sincroniza métricas de los vehículos VINCULADOS y detecta anuncios de ML que
// aún no están en el CRM (para revisarlos/importarlos con un clic). Los carros
// sin mlId no se tocan. Lo llama el Cron y el botón "Sincronizar ahora".
export default async function handler(req, res) {
  try {
    const sb = supabaseAdmin()
    const token = await getAccessToken(sb)
    const auth = await getAuth(sb)

    const { data: items } = await sb.from('crm_items').select('id, data').eq('collection', 'inventario')
    const inv = (items || []).map(r => ({ id: r.id, mlId: String(r.data?.mlId || '').trim() }))
    const linkedIds = new Set(inv.filter(x => x.mlId).map(x => x.mlId))

    // 1) Métricas de los vinculados
    let synced = 0
    const errores = []
    for (const v of inv.filter(x => x.mlId)) {
      const it = await mlGet(token, `/items/${v.mlId}?attributes=id,price,status,permalink,available_quantity,sold_quantity`)
      if (it._error) { errores.push(`${v.mlId}: ${it._error}`); continue }
      const vis = await mlGet(token, `/items/${v.mlId}/visits/time_window?last=30&unit=day`)
      const q = await mlGet(token, `/questions/search?item=${v.mlId}&limit=1`)
      // ML es la fuente para carros vinculados: actualiza el precio del CRM.
      const row = (items || []).find(r => r.id === v.id)
      if (row && it.price != null && Number(row.data?.precio) !== Number(it.price)) {
        await sb.from('crm_items').upsert({ id: v.id, collection: 'inventario', data: { ...row.data, precio: it.price }, updated_at: new Date().toISOString() })
      }
      await putMetric(sb, `ml_${v.id}`, {
        vehiculoId: v.id, mlId: v.mlId,
        precio: it.price ?? null, estado: it.status || '', permalink: it.permalink || '',
        disponibles: it.available_quantity ?? null, vendidos: it.sold_quantity ?? null,
        visitas30: vis && vis.total_visits != null ? vis.total_visits : null,
        preguntas: q && q.paging ? q.paging.total : null,
        syncAt: new Date().toISOString(),
      })
      synced++
    }

    // 2) Anuncios activos del vendedor que NO están vinculados → pendientes
    const pending = []
    if (auth && auth.user_id) {
      const ids = []
      let offset = 0
      for (let i = 0; i < 10; i++) {
        const s = await mlGet(token, `/users/${auth.user_id}/items/search?status=active&limit=50&offset=${offset}`)
        if (s._error || !s.results) break
        ids.push(...s.results)
        if (s.results.length < 50) break
        offset += 50
      }
      const nuevos = ids.filter(id => !linkedIds.has(id))
      for (let i = 0; i < nuevos.length; i += 20) {
        const batch = nuevos.slice(i, i + 20)
        const multi = await mlGet(token, `/items?ids=${batch.join(',')}&attributes=id,title,price,permalink,status,attributes`)
        if (Array.isArray(multi)) {
          for (const row of multi) {
            const body = row.body || row
            if (body && body.id) pending.push(toVehiculo(body))
          }
        }
      }
    }
    await putMetric(sb, 'ml_pending', { items: pending })

    await putMetric(sb, 'ml_status', {
      connected: true, lastSync: new Date().toISOString(),
      itemsSynced: synced, pendientes: pending.length, errores: errores.slice(0, 5),
    })
    res.status(200).json({ ok: true, synced, total: linkedIds.size, pendientes: pending.length, errores })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
