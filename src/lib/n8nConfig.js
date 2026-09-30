const KEY = 'recellfix_n8n_send_webhook'

// URL de producción del workflow "RecellFix Chat - Envío Humano" en n8n.
// Se usa como valor por defecto si el navegador no tiene una guardada;
// el usuario puede sobreescribirla desde el ícono ⚙ del chat.
const DEFAULT_WEBHOOK_URL = 'https://ingejoelramos.app.n8n.cloud/webhook/enviar-mensaje-humano'

export function getSendWebhookUrl() {
  return localStorage.getItem(KEY) || DEFAULT_WEBHOOK_URL
}

export function setSendWebhookUrl(url) {
  if (!url) {
    localStorage.removeItem(KEY)
  } else {
    localStorage.setItem(KEY, url)
  }
}
