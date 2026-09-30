const KEY = 'recellfix_n8n_send_webhook'

export function getSendWebhookUrl() {
  return localStorage.getItem(KEY) || ''
}

export function setSendWebhookUrl(url) {
  if (!url) {
    localStorage.removeItem(KEY)
  } else {
    localStorage.setItem(KEY, url)
  }
}
