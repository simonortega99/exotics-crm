import { ML, supabaseAdmin, putMetric } from '../_ml.js'

// MercadoLibre redirige aquí con ?code=... tras autorizar. Intercambiamos el
// code por access_token + refresh_token y los guardamos (tabla ml_auth).
export default async function handler(req, res) {
  const code = req.query?.code
  if (!code) { res.status(400).send('Falta el parámetro code'); return }
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code', client_id: ML.clientId, client_secret: ML.clientSecret,
      code, redirect_uri: ML.redirectUri,
    })
    const r = await fetch(`${ML.api}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body })
    const j = await r.json()
    if (!r.ok || !j.access_token) {
      res.status(400).send('Error al conectar con MercadoLibre: ' + JSON.stringify(j))
      return
    }
    const sb = supabaseAdmin()
    await sb.from('ml_auth').upsert({
      id: 'ml', user_id: j.user_id, access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in || 21600) * 1000, updated_at: new Date().toISOString(),
    })
    await putMetric(sb, 'ml_status', { connected: true, sellerId: j.user_id, lastSync: null, itemsSynced: 0 })
    res.writeHead(302, { Location: `${ML.appUrl}/#/inventario` })
    res.end()
  } catch (e) {
    res.status(500).send('Error: ' + e.message)
  }
}
