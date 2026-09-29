const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim()
const productionAppUrl = 'https://crm-minaslab-2.vercel.app'

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export function getPasswordResetUrl() {
  if (import.meta.env.DEV && !configuredAppUrl) {
    return `${window.location.origin}/reset-password`
  }

  const appUrl = import.meta.env.PROD && configuredAppUrl && isLocalUrl(configuredAppUrl)
    ? productionAppUrl
    : (configuredAppUrl || productionAppUrl)

  return `${normalizeUrl(appUrl)}/reset-password`
}
