import { ML } from '../_ml.js'

// Inicia el login OAuth: manda al usuario a autorizar la app en MercadoLibre.
export default function handler(req, res) {
  const url = `${ML.authHost}/authorization?response_type=code`
    + `&client_id=${encodeURIComponent(ML.clientId)}`
    + `&redirect_uri=${encodeURIComponent(ML.redirectUri)}`
  res.writeHead(302, { Location: url })
  res.end()
}
