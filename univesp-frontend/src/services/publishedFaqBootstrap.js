import {
  isMockRuntimeEnabled,
  listPublicFaq,
  listPublishedFaq,
} from '@/services/appApi'
import {
  beginPublishedFaqLoad,
  failPublishedFaqLoad,
  setPublishedFaqBundles,
} from '@/services/faqRuntime'

const OPERATIONAL_PROFILES = new Set([
  'op',
  'op_externo',
  'gestor_polos',
  'analista_area',
  'gestor_area',
])

export async function loadPublishedFaqType(faqType, { publicAccess = false } = {}) {
  if (isMockRuntimeEnabled()) {
    return { source: 'mock', faqType }
  }

  beginPublishedFaqLoad(faqType)
  try {
    const response = publicAccess
      ? await listPublicFaq({ faq_type: faqType })
      : await listPublishedFaq({ faq_type: faqType })
    const entries = Array.isArray(response.data) ? response.data : []
    setPublishedFaqBundles(faqType, entries, response.meta)
    return {
      source: 'institutional',
      faqType,
      entries,
      meta: response.meta,
    }
  } catch (error) {
    failPublishedFaqLoad(faqType, error)
    throw error
  }
}

export async function loadPublishedFaqForProfile(profileKey = '') {
  const normalized = String(profileKey || '').trim().toLowerCase()
  if (normalized === 'aluno') {
    return loadPublishedFaqType('aluno')
  }
  if (OPERATIONAL_PROFILES.has(normalized)) {
    return loadPublishedFaqType('op')
  }
  return { source: isMockRuntimeEnabled() ? 'mock' : 'institutional', skipped: true }
}
