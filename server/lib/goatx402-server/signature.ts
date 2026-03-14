import { createHmac, randomBytes, randomUUID } from 'crypto'

export function calculateSignature(params: Record<string, string>, secret: string): string {
  const filteredParams = { ...params }
  delete filteredParams.sign

  const sortedKeys = Object.keys(filteredParams)
    .filter((k) => filteredParams[k] !== '')
    .sort()

  const signStr = sortedKeys.map((k) => `${k}=${filteredParams[k]}`).join('&')
  return createHmac('sha256', secret).update(signStr).digest('hex')
}

export function signRequest(
  params: Record<string, unknown>,
  apiKey: string,
  apiSecret: string
): {
  'X-API-Key': string
  'X-Timestamp': string
  'X-Nonce': string
  'X-Sign': string
} {
  const strParams: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      strParams[k] = String(v)
    }
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = typeof randomUUID === 'function'
    ? randomUUID()
    : `${Date.now().toString(36)}-${randomBytes(12).toString('hex')}`
  strParams.api_key = apiKey
  strParams.timestamp = timestamp
  strParams.nonce = nonce

  const sign = calculateSignature(strParams, apiSecret)

  return {
    'X-API-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Sign': sign,
  }
}
