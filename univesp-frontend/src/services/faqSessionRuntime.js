import {
  advanceFaqSession,
  recordFaqEvent,
  startFaqSession,
  isMockRuntimeEnabled,
} from '@/services/appApi'

const STORAGE_KEY = 'univesp.faqSession.v3'
let operationQueue = Promise.resolve()

function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    return value?.faq_session_id ? value : null
  } catch {
    return null
  }
}

function writeSession(value) {
  if (!value?.faq_session_id) {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
  const safe = {
    faq_session_id: String(value.faq_session_id),
    bundle_key: String(value.bundle_key || ''),
    bundle_version_id: String(value.bundle_version_id || ''),
    persona: String(value.persona || ''),
    path: Array.isArray(value.path) ? value.path.map(String) : [],
    expires_at: String(value.expires_at || ''),
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  return safe
}

function nodeLineage(node, lineage = []) {
  const source = lineage.length ? lineage : node?.runtime?.lineage || []
  return source
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function isV3Node(node) {
  return String(node?.runtime_schema_version || '').startsWith('3.0.0')
}

export function getActiveFaqSession() {
  return readSession()
}

export function clearActiveFaqSession() {
  operationQueue = Promise.resolve()
  writeSession(null)
}

export function ensureFaqSessionForNode(node, lineage = [], persona = 'student') {
  if (isMockRuntimeEnabled() || !isV3Node(node)) {
    return Promise.resolve(null)
  }
  const bundleKey = String(node?.bundle_id || '').trim()
  const bundleVersionId = String(node?.bundle_version_id || '').trim()
  const path = nodeLineage(node, lineage)
  if (!bundleKey || !bundleVersionId || !path.length) {
    return Promise.reject(new Error('Lineage v3 incompleto para iniciar a jornada.'))
  }

  operationQueue = operationQueue.catch(() => null).then(async () => {
    let active = readSession()
    const sameVersion =
      active?.bundle_key === bundleKey &&
      active?.bundle_version_id === bundleVersionId &&
      active?.persona === persona
    const start = async () => {
      const response = await startFaqSession({
        bundle_key: bundleKey,
        bundle_version_id: bundleVersionId,
        persona,
        origin: persona === 'student' ? 'portal' : 'op_assisted',
      })
      return writeSession(response.data)
    }
    if (!sameVersion) {
      active = await start()
    }
    if (JSON.stringify(active.path) !== JSON.stringify(path)) {
      try {
        const response = await advanceFaqSession(active.faq_session_id, {
          node_id: path.at(-1),
          path,
          event_id: crypto.randomUUID(),
        })
        active = writeSession(response.data)
      } catch (error) {
        if (error?.status !== 410 && error?.code !== 'FAQ_SESSION_EXPIRED') throw error
        active = await start()
        if (JSON.stringify(active.path) !== JSON.stringify(path)) {
          const response = await advanceFaqSession(active.faq_session_id, {
            node_id: path.at(-1),
            path,
            event_id: crypto.randomUUID(),
          })
          active = writeSession(response.data)
        }
      }
    }
    return active
  })
  return operationQueue
}

export async function recordFaqJourneyEvent(eventName, node, metadata = {}) {
  if (isMockRuntimeEnabled() || !isV3Node(node)) {
    return null
  }
  const active = await operationQueue.catch(() => readSession())
  if (!active?.faq_session_id) {
    return null
  }
  return recordFaqEvent({
    event_id: crypto.randomUUID(),
    event_name: eventName,
    faq_session_id: active.faq_session_id,
    node_id: String(node?.id || active.path.at(-1) || ''),
    metadata,
  })
}
