import { createHmac, randomUUID } from 'node:crypto'

export class FrappeApiError extends Error {
  constructor(message, { status = 502, code = 'FRAPPE_API_ERROR', payload = null } = {}) {
    super(message)
    this.name = 'FrappeApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export function buildSignedContext(user, requestId = randomUUID(), now = Math.floor(Date.now() / 1000)) {
  const secret = required('UNIVESP_BFF_SHARED_SECRET')
  const encoded = Buffer.from(
    JSON.stringify({
      email: String(user.email || '').trim().toLowerCase(),
      name: String(user.displayName || user.display_name || user.name || ''),
      ra: String(user.ra || ''),
      flow: String(user.flow || ''),
    }),
  ).toString('base64url')
  const timestamp = String(now)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${encoded}`).digest('hex')

  return {
    'X-Univesp-User-Context': encoded,
    'X-Univesp-Timestamp': timestamp,
    'X-Univesp-Signature': signature,
    'X-Request-ID': requestId,
  }
}
export function buildSignedSimulationContext(simulation, now = Math.floor(Date.now() / 1000)) {
  if (!simulation) return {}
  const secret = required('UNIVESP_BFF_SHARED_SECRET')
  const encoded = Buffer.from(JSON.stringify(simulation)).toString('base64url')
  const timestamp = String(now)
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.simulation.${encoded}`)
    .digest('hex')

  return {
    'X-Univesp-Simulation-Context': encoded,
    'X-Univesp-Simulation-Timestamp': timestamp,
    'X-Univesp-Simulation-Signature': signature,
  }
}



export async function callFrappe(method, options = {}) {
  const requestId = options.requestId || randomUUID()
  const origin = String(process.env.FRAPPE_ORIGIN || 'http://127.0.0.1:8000').replace(/\/+$/, '')
  const url = new URL(`/api/method/univesp_atendimento.api.v1.${method}`, origin)
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `token ${required('FRAPPE_API_KEY')}:${required('FRAPPE_API_SECRET')}`,
    'X-Univesp-Gateway-Key': required('UNIVESP_EDGE_SHARED_SECRET'),
    'X-Frappe-Site-Name': process.env.FRAPPE_SITE_NAME || 'crm.localhost',
    ...buildSignedContext(options.user || {}, requestId),
  }
  Object.assign(headers, buildSignedSimulationContext(options.simulation))
  Object.assign(headers, options.headers || {})
  let body
  if (options.rawBody) {
    body = options.rawBody
    if (options.contentType) headers['Content-Type'] = options.contentType
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.FRAPPE_REQUEST_TIMEOUT_MS || 30000),
  )
  let response
  try {
    response = await fetch(url, {
      method: options.httpMethod || (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: controller.signal,
      ...(options.rawBody ? { duplex: 'half' } : {}),
    })
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Tempo limite ao consultar o Frappe.' : 'Frappe indisponivel.'
    throw new FrappeApiError(message, { code: 'FRAPPE_UNAVAILABLE' })
  } finally {
    clearTimeout(timeout)
  }

  if (options.rawResponse && response.ok) return response
  const payload = await parsePayload(response)
  if (!response.ok) {
    throw new FrappeApiError(extractMessage(payload), {
      status: publicStatus(response.status),
      code: frappeErrorCode(response.status, payload),
      payload,
    })
  }
  return payload?.message ?? payload
}

function required(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new FrappeApiError(`Configuracao obrigatoria ausente: ${name}.`, { code: 'BFF_CONFIG_ERROR' })
  return value
}

async function parsePayload(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export function extractDiagnosticDetails(payload) {
  if (!payload || typeof payload !== 'object') return ''
  const serverMessage = parseServerMessage(payload._server_messages)
  if (serverMessage) return serverMessage
  const nested = payload.message
  if (nested && typeof nested === 'object') {
    const nestedMessage = parseServerMessage(nested._server_messages) || nested.message
    if (nestedMessage && nestedMessage !== nested.exc_type) return String(nestedMessage).trim()
  }
  const exception = String(payload.exception || '').trim()
  if (exception) {
    const match = exception.match(/(?:ValidationError|PermissionError|ConflictError):\s*(.+)$/m)
    if (match?.[1]) return match[1].trim()
    const colonIndex = exception.lastIndexOf(':')
    if (colonIndex !== -1) {
      const detail = exception.slice(colonIndex + 1).trim().split('\n')[0]
      if (detail && detail !== payload.exc_type) return detail
    }
  }
  const exc = String(payload.exc || '').trim()
  if (exc) {
    const line = exc
      .split('\n')
      .map((item) => item.trim())
      .find((item) => /ValidationError:/.test(item))
    if (line) return line.split('ValidationError:').pop().trim()
  }
  return ''
}

function extractMessage(payload) {
  const diagnostic = extractDiagnosticDetails(payload)
  if (diagnostic) return diagnostic

  if (typeof payload?.message === 'string' && payload.message && payload.message !== payload?.exc_type) {
    return payload.message
  }
  const exceptionLine = String(payload?.exception || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('Traceback') && !line.includes('File "'))
  if (exceptionLine && exceptionLine !== payload?.exc_type) return exceptionLine
  if (typeof payload?.message === 'string') return payload.message
  if (payload?.exc_type) return payload.exc_type
  return 'Falha ao processar a solicitacao no Frappe.'
}

function publicStatus(status) {
  return [400, 401, 403, 404, 409, 410, 413, 417, 422, 429].includes(status) ? status : 502
}

function frappeErrorCode(status, payload) {
	const serialized = JSON.stringify(payload || {})
	if (/UnivespConflictError|KnowledgeV3ConflictError/i.test(serialized)) return 'CONFLICT'
	if (/UnivespValidationError|KnowledgeV3ValidationError/i.test(serialized)) return 'VALIDATION_ERROR'
	if (/KnowledgeSessionExpiredError/i.test(serialized)) return 'FAQ_SESSION_EXPIRED'
	if (/desativado no Atendimento/i.test(serialized)) return 'ACCESS_DISABLED'
	if (/sem perfil ativo/i.test(serialized)) return 'PROFILE_NOT_ASSIGNED'
  if (status === 401) return 'AUTHENTICATION_REQUIRED'
  if (status === 403) return 'PERMISSION_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  return status >= 500 ? 'FRAPPE_UNAVAILABLE' : 'FRAPPE_REQUEST_REJECTED'
}

function parseServerMessage(value) {
  if (!value) return ''
  try {
    const entries = JSON.parse(value)
    const first = entries.map((item) => JSON.parse(item)).find((item) => item?.message)
    return String(first?.message || '').replace(/<[^>]+>/g, '').trim()
  } catch {
    return ''
  }
}
