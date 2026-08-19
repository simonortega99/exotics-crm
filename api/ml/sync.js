import { supabaseAdmin, getAccessToken, mlGet, putMetric } from '../_ml.js'

// Sincroniza precio + visitas + preguntas de cada vehículo VINCULADO (con mlId).
// Los carros sin mlId no se tocan. Lo llama el Cron de Vercel y el botón
// "Sincronizar ahora" del CRM.
export default async function handler(req, res) {
  try {
    const sb = supabaseAdmin()
    const token = await getAccessToken(sb)

    const { data: items } = await sb.from('crm_items').select('id, data').eq('collection', 'inventario')
    const vinculados = (items || [])
      .map(r => ({ id: r.id, mlId: String(r.data?.mlId || '').trim() }))
      .filter(x => x.mlId)

    let synced = 0
    const errores = []
    for (const v of vinculados) {
      const it = await mlGet(token, `/items/${v.mlId}?attributes=id,price,status,permalink,available_quantity,sold_quantity`)
      if (it._error) { errores.push(`${v.mlId}: item ${it._error}`); continue }
      const vis = await mlGet(token, `/items/${v.mlId}/visits/time_window?last=30&unit=day`)
      const q = await mlGet(token, `/questions/search?item=${v.mlId}&limit=1`)
      await putMetric(sb, `ml_${v.id}`, {
        vehiculoId: v.id,
        mlId: v.mlId,
        precio: it.price ?? null,
        estado: it.status || '',
        permalink: it.permalink || '',
        disponibles: it.available_quantity ?? null,
        vendidos: it.sold_quantity ?? null,
        visitas30: vis && vis.total_visits != null ? vis.total_visits : null,
        preguntas: q && q.paging ? q.paging.total : null,
        syncAt: new Date().toISOString(),
      })
      synced++
    }

    await putMetric(sb, 'ml_status', { connected: true, lastSync: new Date().toISOString(), itemsSynced: synced, errores: errores.slice(0, 5) })
    res.status(200).json({ ok: true, synced, total: vinculados.length, errores })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
